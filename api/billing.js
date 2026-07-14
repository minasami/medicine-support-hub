import { appUrl, requireUser, serviceRest, stripeClient } from "./_billing-server.js";
import { errorStatus, sendJson, sha256 } from "./_platform-server.js";

export const config = { api: { bodyParser: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function queryValue(value) {
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

async function rawBody(request) {
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === "string") return Buffer.from(request.body);
  if (request.body && typeof request.body === "object") {
    return Buffer.from(JSON.stringify(request.body));
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function jsonBody(request) {
  const raw = await rawBody(request);
  if (!raw.length) return {};
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 });
  }
}

function paymentMetadata(payment, userId) {
  return Object.fromEntries(
    Object.entries({
      payment_request_id: payment.id,
      user_id: userId,
      purpose: payment.purpose,
      target_type: payment.target_type,
      target_id: payment.target_id,
    })
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );
}

async function checkout(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { message: "Method not allowed." });
  try {
    const context = await requireUser(request);
    const paymentRequestId = String((await jsonBody(request)).payment_request_id || "");
    if (!UUID.test(paymentRequestId)) {
      throw Object.assign(new Error("A valid payment request is required."), { statusCode: 400 });
    }

    const rows = await serviceRest(
      `/rest/v1/platform_payment_requests?select=*&id=eq.${paymentRequestId}&limit=1`,
    );
    const payment = rows?.[0];
    if (!payment || payment.user_id !== context.user.id) {
      throw Object.assign(new Error("Payment request not found."), { statusCode: 404 });
    }
    if (!["pending", "checkout_created"].includes(payment.status)) {
      throw Object.assign(new Error("This payment request is no longer payable."), { statusCode: 409 });
    }
    if (payment.expires_at && Date.parse(payment.expires_at) <= Date.now()) {
      throw Object.assign(new Error("This payment request has expired."), { statusCode: 410 });
    }

    const existing = await serviceRest(
      `/rest/v1/platform_payment_transactions?select=stripe_checkout_session_id&payment_request_id=eq.${payment.id}&limit=1`,
    );
    const stripe = stripeClient();
    if (existing?.[0]?.stripe_checkout_session_id) {
      const prior = await stripe.checkout.sessions.retrieve(existing[0].stripe_checkout_session_id);
      if (prior.url) return sendJson(response, 200, { url: prior.url });
    }

    const lineItem =
      payment.mode === "subscription"
        ? { price: payment.stripe_price_id, quantity: 1 }
        : {
            price_data: {
              currency: payment.currency,
              unit_amount: Number(payment.amount_minor),
              product_data: { name: payment.description },
            },
            quantity: 1,
          };
    const origin = appUrl(request);
    const metadata = paymentMetadata(payment, context.user.id);
    const session = await stripe.checkout.sessions.create(
      {
        mode: payment.mode,
        customer_email: context.user.email,
        line_items: [lineItem],
        client_reference_id: context.user.id,
        metadata,
        subscription_data: payment.mode === "subscription" ? { metadata } : undefined,
        success_url: `${origin}/account?payment=success&request_id=${payment.id}`,
        cancel_url: `${origin}/account?payment=canceled&request_id=${payment.id}`,
      },
      { idempotencyKey: `checkout-${payment.idempotency_key}` },
    );

    await serviceRest("/rest/v1/platform_payment_transactions?on_conflict=payment_request_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        payment_request_id: payment.id,
        user_id: context.user.id,
        stripe_checkout_session_id: session.id,
        amount_minor: payment.amount_minor,
        currency: payment.currency,
        payment_status: "checkout_created",
        metadata: { purpose: payment.purpose },
      }),
    });
    await serviceRest(`/rest/v1/platform_payment_requests?id=eq.${payment.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "checkout_created", updated_at: new Date().toISOString() }),
    });
    return sendJson(response, 200, { url: session.url });
  } catch (error) {
    return sendJson(response, errorStatus(error), {
      message: error.message || "Could not start checkout.",
    });
  }
}

async function portal(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { message: "Method not allowed." });
  try {
    const context = await requireUser(request);
    const rows = await serviceRest(
      `/rest/v1/user_billing_accounts?select=stripe_customer_id&user_id=eq.${context.user.id}&limit=1`,
    );
    const customer = rows?.[0]?.stripe_customer_id;
    if (!customer) {
      throw Object.assign(new Error("No billing account exists yet."), { statusCode: 404 });
    }
    const session = await stripeClient().billingPortal.sessions.create({
      customer,
      return_url: `${appUrl(request)}/account`,
    });
    return sendJson(response, 200, { url: session.url });
  } catch (error) {
    return sendJson(response, errorStatus(error), {
      message: error.message || "Could not open billing portal.",
    });
  }
}

function subscriptionRow(subscription) {
  const userId = subscription.metadata?.user_id || subscription.metadata?.supabase_user_id;
  const active = ["active", "trialing"].includes(subscription.status);
  if (!userId) return null;
  return {
    user_id: userId,
    stripe_customer_id: String(subscription.customer),
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items.data[0]?.price?.id || null,
    subscription_status: subscription.status,
    subscription_code: active
      ? subscription.metadata?.subscription_code || "company_subscription"
      : "none",
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };
}

async function updatePaymentRequest(id, body) {
  if (!id) return;
  await serviceRest(`/rest/v1/platform_payment_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
  });
}

async function webhook(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { message: "Method not allowed." });
  let event;
  try {
    const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "");
    if (!secret) throw new Error("Webhook secret is unavailable.");
    const raw = await rawBody(request);
    event = stripeClient().webhooks.constructEvent(
      raw,
      String(request.headers["stripe-signature"] || ""),
      secret,
    );

    const seen = await serviceRest(
      `/rest/v1/stripe_webhook_events?select=stripe_event_id&stripe_event_id=eq.${event.id}&limit=1`,
    );
    if (seen?.length) return sendJson(response, 200, { received: true, duplicate: true });

    await serviceRest("/rest/v1/stripe_webhook_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        stripe_event_id: event.id,
        event_type: event.type,
        livemode: event.livemode,
        payload_sha256: sha256(raw),
      }),
    });

    if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      const session = event.data.object;
      await serviceRest(
        `/rest/v1/platform_payment_transactions?stripe_checkout_session_id=eq.${session.id}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
            stripe_subscription_id:
              typeof session.subscription === "string" ? session.subscription : null,
            amount_minor: session.amount_total,
            currency: session.currency,
            payment_status: "paid",
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        },
      );
      await updatePaymentRequest(session.metadata?.payment_request_id, { status: "paid" });
    } else if (["checkout.session.expired", "checkout.session.async_payment_failed"].includes(event.type)) {
      const session = event.data.object;
      await updatePaymentRequest(session.metadata?.payment_request_id, {
        status: event.type.endsWith("expired") ? "expired" : "failed",
      });
    } else if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      const row = subscriptionRow(event.data.object);
      if (row) {
        await serviceRest("/rest/v1/user_billing_accounts?on_conflict=user_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(row),
        });
      }
    }

    await serviceRest(`/rest/v1/stripe_webhook_events?stripe_event_id=eq.${event.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      }),
    });
    return sendJson(response, 200, { received: true });
  } catch (error) {
    if (event?.id) {
      await serviceRest(`/rest/v1/stripe_webhook_events?stripe_event_id=eq.${event.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          processing_status: "failed",
          error_message: String(error.message || "Processing failed").slice(0, 500),
        }),
      }).catch(() => undefined);
    }
    return sendJson(response, 400, { message: "Invalid webhook." });
  }
}

export default async function handler(request, response) {
  const action = queryValue(request.query?.action).toLowerCase();
  if (action === "checkout") return checkout(request, response);
  if (action === "portal") return portal(request, response);
  if (action === "webhook") return webhook(request, response);
  return sendJson(response, 404, { message: "Unknown billing action." });
}
