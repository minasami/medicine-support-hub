/**
 * pharmacy-update-quote — versioned quotes for Rx negotiation.
 * Locks when order status is confirmed|preparing|ready|delivered.
 * Notifies patient via Appwrite Messaging (sendPush / Messaging.createPush).
 */
import { Client, Databases, ID, Messaging, Query } from "node-appwrite";
import { z } from "zod";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_ORDERS = "orders";
const COL_QUOTES = "order_quotes";
const COL_MSGS = "order_messages";
const LOCKED = new Set(["confirmed", "preparing", "ready", "delivered"]);

const InputSchema = z.object({
  order_id: z.string().min(1),
  pharmacy_id: z.string().min(1),
  quoted_items: z
    .array(
      z.object({
        drug_name: z.string().min(1),
        dose: z.string().optional(),
        frequency: z.string().optional(),
        duration: z.string().optional(),
        quantity: z.number().nonnegative().optional(),
        price: z.number().nonnegative().optional(),
        alternative_of: z.string().optional(),
        reason: z.string().optional(),
        confidence: z.number().optional(),
      }),
    )
    .min(1),
  total_price: z.number().nonnegative(),
  notes: z.string().optional().default(""),
  currency: z.string().optional().default("EGP"),
});

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-appwrite-project,x-appwrite-key",
  });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function getClient() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

async function notifyUser(messaging, userId, title, body, data, log) {
  if (!userId) return null;
  try {
    const msg = await messaging.createPush(
      ID.unique(),
      title,
      body,
      undefined,
      [userId],
      undefined,
      data || undefined,
    );
    return msg.$id;
  } catch (e) {
    log(`Messaging.createPush: ${e.message || e}`);
    return null;
  }
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const parsed = InputSchema.safeParse(parseBody(req));
  if (!parsed.success) {
    return json(res, 400, {
      success: false,
      error: "Invalid input",
      issues: parsed.error.issues,
    });
  }
  const input = parsed.data;
  const client = getClient();
  if (!client) {
    return json(res, 500, { success: false, error: "Missing Appwrite credentials" });
  }
  const db = new Databases(client);
  const messaging = new Messaging(client);

  try {
    const order = await db.getDocument(DB, COL_ORDERS, input.order_id);
    if (LOCKED.has(String(order.status))) {
      return json(res, 409, {
        success: false,
        error: "Quote locked after confirmation",
        status: order.status,
      });
    }
    if (order.pharmacy_id && order.pharmacy_id !== input.pharmacy_id) {
      return json(res, 403, {
        success: false,
        error: "pharmacy_id does not match order",
      });
    }

    const prior = await db.listDocuments(DB, COL_QUOTES, [
      Query.equal("order_id", input.order_id),
      Query.orderDesc("version"),
      Query.limit(1),
    ]);
    const nextVersion =
      prior.documents[0] && Number(prior.documents[0].version)
        ? Number(prior.documents[0].version) + 1
        : 1;

    // supersede previous active quotes
    for (const q of prior.documents) {
      if (q.status === "active" || q.status === "sent") {
        try {
          await db.updateDocument(DB, COL_QUOTES, q.$id, { status: "superseded" });
        } catch (e) {
          log(`supersede ${q.$id}: ${e.message || e}`);
        }
      }
    }

    const quote = await db.createDocument(DB, COL_QUOTES, ID.unique(), {
      order_id: input.order_id,
      pharmacy_id: input.pharmacy_id,
      quoted_items_json: JSON.stringify(input.quoted_items),
      total_price: input.total_price,
      notes: input.notes || "",
      status: "sent",
      version: nextVersion,
      currency: input.currency || "EGP",
    });

    await db.updateDocument(DB, COL_ORDERS, input.order_id, {
      status: "quoted",
      current_quote_id: quote.$id,
      quote_price: input.total_price,
      currency: input.currency || "EGP",
    });

    try {
      await db.createDocument(DB, COL_MSGS, ID.unique(), {
        order_id: input.order_id,
        sender_id: input.pharmacy_id,
        sender_role: "system",
        message: `Pharmacy sent quote v${nextVersion}: ${input.total_price} ${input.currency || "EGP"}${input.notes ? ` — ${input.notes}` : ""}`,
        attachments: "[]",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      log(`order_messages: ${e.message || e}`);
    }

    const pushId = await notifyUser(
      messaging,
      order.user_id,
      "New pharmacy quote",
      `Your quote is ${input.total_price} ${input.currency || "EGP"} (v${nextVersion})`,
      { order_id: input.order_id, quote_id: quote.$id, deep_link: `/order/${input.order_id}` },
      log,
    );

    return json(res, 200, {
      success: true,
      quote_id: quote.$id,
      version: nextVersion,
      order_id: input.order_id,
      push_message_id: pushId,
    });
  } catch (err) {
    error(String(err.message || err));
    return json(res, 500, { success: false, error: String(err.message || err) });
  }
};
