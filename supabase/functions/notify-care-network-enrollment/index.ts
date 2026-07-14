import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });

type ClaimedApplication = {
  application_id: string;
  requested_name: string;
  entity_type: string;
  city: string | null;
  country: string | null;
  submitted_by: string;
  created_at: string;
};

type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  failure_count: number;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration is incomplete" }, 500);

  let input: { application_id?: string; delivery_token?: string };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }
  const applicationId = String(input.application_id || "").trim();
  const deliveryToken = String(input.delivery_token || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(applicationId) || !/^[0-9a-f]{64}$/i.test(deliveryToken)) {
    return json({ error: "Invalid delivery capability" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: claimRows, error: claimError } = await admin.rpc("claim_care_network_push_job", {
    p_application_id: applicationId,
    p_delivery_token: deliveryToken,
  });
  const claim = (Array.isArray(claimRows) ? claimRows[0] : claimRows) as ClaimedApplication | undefined;
  if (claimError || !claim) {
    return json({ error: "Delivery capability is invalid, expired, or already used" }, 409);
  }

  let campaignId: string | null = null;
  try {
    const location = [claim.city, claim.country].filter(Boolean).join(", ");
    const entityLabel = claim.entity_type.replaceAll("_", " ");
    const title = "New care network enrollment request";
    const body = `${claim.requested_name} applied as ${entityLabel}${location ? ` in ${location}` : ""}. Review identity, licensing and evidence.`.slice(0, 500);
    const targetUrl = `/admin?tab=care-network&request=${encodeURIComponent(claim.application_id)}`;

    const { data: campaign, error: campaignError } = await admin
      .from("notification_campaigns")
      .insert({
        title,
        body,
        audience_type: "role",
        audience_values: ["admin", "platform_admin", "super_admin"],
        notification_topic: "care_network_requests",
        target_url: targetUrl,
        icon_url: "/pwa-icon.svg",
        data: {
          source: "care_network_enrollment_trigger",
          visibility: "private",
          application_id: claim.application_id,
          contains_protected_health_information: false,
        },
        status: "sending",
        started_at: new Date().toISOString(),
        created_by: claim.submitted_by,
      })
      .select("id")
      .single();
    if (campaignError || !campaign) throw new Error(campaignError?.message || "Could not create private notification campaign");
    campaignId = campaign.id;

    const { data: adminProfiles, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("is_active", true)
      .in("role", ["admin", "platform_admin", "super_admin"])
      .limit(500);
    if (profileError) throw new Error(profileError.message);
    const adminIds = (adminProfiles || []).map((row) => row.id).filter(Boolean);

    const { data: subscriptionRows, error: subscriptionError } = adminIds.length
      ? await admin
          .from("push_subscriptions")
          .select("id,user_id,endpoint,p256dh,auth_key,failure_count")
          .eq("is_enabled", true)
          .in("user_id", adminIds)
          .limit(1000)
      : { data: [], error: null };
    if (subscriptionError) throw new Error(subscriptionError.message);
    const subscriptions = (subscriptionRows || []) as Subscription[];

    const { data: credentialsRows, error: credentialsError } = await admin.rpc("get_web_push_credentials");
    const credentials = Array.isArray(credentialsRows) ? credentialsRows[0] : credentialsRows;
    if (credentialsError || !credentials?.public_key || !credentials?.private_key) {
      throw new Error("Web-push credentials are unavailable");
    }
    webpush.setVapidDetails(
      credentials.subject || "mailto:jesussavedmina@gmail.com",
      credentials.public_key,
      credentials.private_key,
    );

    const payload = JSON.stringify({
      campaignId,
      title,
      body,
      url: targetUrl,
      icon: "/pwa-icon.svg",
      badge: "/pwa-icon.svg",
      topic: "care_network_requests",
      timestamp: Date.now(),
      requireInteraction: true,
      applicationId: claim.application_id,
      actions: [
        { action: "approve", title: "Approve" },
        { action: "reject", title: "Refuse" },
      ],
    });

    let delivered = 0;
    let failed = 0;
    const deliveries: Array<Record<string, unknown>> = [];
    for (let index = 0; index < subscriptions.length; index += 25) {
      const batch = subscriptions.slice(index, index + 25);
      await Promise.allSettled(
        batch.map(async (subscription) => {
          try {
            const response = await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
              },
              payload,
              { TTL: 86_400, urgency: "high" },
            );
            delivered += 1;
            deliveries.push({
              campaign_id: campaignId,
              user_id: subscription.user_id,
              subscription_id: subscription.id,
              status: "sent",
              provider_status: response.statusCode,
              sent_at: new Date().toISOString(),
            });
            await admin
              .from("push_subscriptions")
              .update({
                failure_count: 0,
                last_error: null,
                last_success_at: new Date().toISOString(),
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", subscription.id);
          } catch (cause) {
            failed += 1;
            const statusCode = Number((cause as { statusCode?: number })?.statusCode || 0) || null;
            const failureMessage = cause instanceof Error ? cause.message.slice(0, 500) : "Push delivery failed";
            const expired = statusCode === 404 || statusCode === 410;
            deliveries.push({
              campaign_id: campaignId,
              user_id: subscription.user_id,
              subscription_id: subscription.id,
              status: expired ? "expired" : "failed",
              provider_status: statusCode,
              failure_reason: failureMessage,
            });
            await admin
              .from("push_subscriptions")
              .update({
                is_enabled: expired ? false : true,
                failure_count: Number(subscription.failure_count || 0) + 1,
                last_error: failureMessage,
                updated_at: new Date().toISOString(),
              })
              .eq("id", subscription.id);
          }
        }),
      );
    }

    if (deliveries.length) await admin.from("notification_deliveries").insert(deliveries);
    if (adminIds.length) {
      await admin
        .from("user_notifications")
        .update({ campaign_id: campaignId })
        .in("user_id", adminIds)
        .eq("entity_type", "healthcare_entity_application")
        .eq("entity_key", claim.application_id)
        .is("campaign_id", null);
    }

    const finalStatus = delivered > 0 || subscriptions.length === 0 ? "sent" : "failed";
    await admin
      .from("notification_campaigns")
      .update({
        status: finalStatus,
        attempted_count: subscriptions.length,
        delivered_count: delivered,
        failed_count: failed,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    await admin.rpc("complete_care_network_push_job", {
      p_application_id: applicationId,
      p_delivery_token: deliveryToken,
      p_status: finalStatus === "sent" ? "sent" : "failed",
      p_error: finalStatus === "sent" ? null : "No enabled administrator push subscription accepted the notification.",
    });

    return json({
      applicationId,
      campaignId,
      administrators: adminIds.length,
      attempted: subscriptions.length,
      delivered,
      failed,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 1000) : "Care-network push failed";
    if (campaignId) {
      await admin
        .from("notification_campaigns")
        .update({ status: "failed", failed_count: 1, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", campaignId);
    }
    await admin.rpc("complete_care_network_push_job", {
      p_application_id: applicationId,
      p_delivery_token: deliveryToken,
      p_status: "failed",
      p_error: message,
    }).catch(() => undefined);
    return json({ error: message }, 500);
  }
});
