/**
 * order-status-webhook — on orders.update notify user + pharmacy via Appwrite Messaging.
 * Wire event: databases.medicine_support_hub.collections.orders.documents.*.update
 */
import { Client, Databases, ID, Messaging } from "node-appwrite";
import { z } from "zod";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_PHARM = "pharmacies";

const EventSchema = z
  .object({
    $id: z.string().optional(),
    user_id: z.string().optional(),
    pharmacy_id: z.string().optional(),
    status: z.string().optional(),
    quote_price: z.number().optional(),
    current_quote_id: z.string().optional(),
  })
  .passthrough();

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
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

function eventDocument(body) {
  const nested =
    typeof body.data === "string"
      ? (() => {
          try {
            return JSON.parse(body.data);
          } catch {
            return {};
          }
        })()
      : body.data || body;
  if (nested && (nested.$id || nested.status || nested.user_id)) return nested;
  return body;
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

async function push(messaging, userId, title, body, data, log) {
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
    log(`push ${userId}: ${e.message || e}`);
    return null;
  }
}

function statusCopy(status) {
  const map = {
    sent: "Prescription sent to pharmacy",
    pharmacy_reviewing: "Pharmacy is reviewing your prescription",
    quoted: "Pharmacy sent a quote",
    confirmed: "Order confirmed",
    preparing: "Pharmacy is preparing your order",
    ready: "Order is ready for pickup/delivery",
    delivered: "Order delivered",
    cancelled: "Order cancelled",
  };
  return map[status] || `Order status: ${status}`;
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const body = parseBody(req);
  const doc = eventDocument(body);
  const parsed = EventSchema.safeParse(doc);
  if (!parsed.success) {
    return json(res, 400, { success: false, error: "Invalid event payload", issues: parsed.error.issues });
  }
  const order = parsed.data;
  if (!order.$id || !order.status) {
    return json(res, 200, { success: true, skipped: true, reason: "No order id/status" });
  }

  const client = getClient();
  if (!client) {
    return json(res, 500, { success: false, error: "Missing Appwrite credentials" });
  }
  const messaging = new Messaging(client);
  const db = new Databases(client);

  const title = "Order update";
  const message = statusCopy(order.status);
  const data = {
    order_id: order.$id,
    status: order.status,
    deep_link: `/order/${order.$id}`,
  };

  const results = { user: null, pharmacy: null };

  results.user = await push(messaging, order.user_id, title, message, data, log);

  let pharmacyNotifyUser = order.pharmacy_id;
  try {
    if (order.pharmacy_id) {
      const ph = await db.getDocument(DB, COL_PHARM, order.pharmacy_id);
      pharmacyNotifyUser = ph.owner_user_id || ph.user_id || ph.notify_user_id || order.pharmacy_id;
    }
  } catch (e) {
    log(`pharmacy lookup: ${e.message || e}`);
  }
  results.pharmacy = await push(
    messaging,
    pharmacyNotifyUser,
    "Order update",
    `Order ${String(order.$id).slice(0, 8)} → ${order.status}`,
    { ...data, deep_link: `/pharmacy/quote/${order.$id}` },
    log,
  );

  log(`order-status-webhook ${order.$id} ${order.status} user=${results.user} pharm=${results.pharmacy}`);
  return json(res, 200, { success: true, order_id: order.$id, status: order.status, push: results });
};
