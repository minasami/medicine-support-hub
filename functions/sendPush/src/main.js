/**
 * sendPush — Appwrite Messaging (primary), not Firebase Admin.
 *
 * Architecture:
 *   - Android/iOS transport may still be FCM/APNs, but that provider is
 *     configured in **Appwrite Console → Messaging → Providers**
 *     (createFcmProvider / createApnsProvider). The app and this function
 *     talk only to Appwrite.
 *   - Device tokens are registered as Account push targets
 *     (account.createPushTarget) and optionally mirrored in `fcm_tokens`.
 *   - This function calls Messaging.createPush({ users | targets | topics }).
 *
 * Trigger (wire in Console when ready):
 *   databases.*.collections.orders.documents.*.update
 *   — or donation_requests / pharmacy order collections.
 *
 * Env:
 *   APPWRITE_ENDPOINT / APPWRITE_FUNCTION_API_ENDPOINT
 *   APPWRITE_PROJECT_ID / APPWRITE_FUNCTION_PROJECT_ID
 *   APPWRITE_API_KEY  (scopes: users.read, messaging.write, databases.read)
 *   APPWRITE_DATABASE_ID=medicine_support_hub
 *   FCM_TOKENS_COLLECTION_ID=fcm_tokens  (optional mirror lookup)
 *   APPWRITE_MESSAGING_PROVIDER_ID  (optional FCM provider id for target create)
 *   APPWRITE_MESSAGING_TOPIC  (optional default topic)
 *
 * Do NOT set FIREBASE_* for this function — provider credentials live in Console.
 */

import { Client, Databases, ID, Messaging, Query, Users } from "node-appwrite";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_TOKENS = process.env.FCM_TOKENS_COLLECTION_ID || "fcm_tokens";
const DEFAULT_TOPIC = process.env.APPWRITE_MESSAGING_TOPIC || "";

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

function getClient() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key =
    process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});

  const body = parseBody(req);
  // Appwrite event payloads often nest under body / payload
  const eventData =
    typeof body.data === "string"
      ? (() => {
          try {
            return JSON.parse(body.data);
          } catch {
            return {};
          }
        })()
      : body.data || body;

  const userId =
    body.user_id ||
    body.userId ||
    eventData.user_id ||
    eventData.userId ||
    eventData.patient_id ||
    null;
  const title = body.title || eventData.title || "Medicine Support Hub";
  const message =
    body.body || body.message || eventData.body || eventData.message || "";
  const data =
    (body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? body.data
      : null) ||
    eventData.push_data ||
    {};
  const topics = body.topics || (DEFAULT_TOPIC ? [DEFAULT_TOPIC] : undefined);
  const targets = body.targets; // explicit Appwrite target ids
  const users = body.users || (userId ? [userId] : undefined);
  const draft = body.draft === true;

  const client = getClient();
  if (!client) {
    return json(res, 500, {
      success: false,
      error: "Missing Appwrite credentials (ENDPOINT/PROJECT/API_KEY)",
    });
  }

  const messaging = new Messaging(client);
  const databases = new Databases(client);
  const usersApi = new Users(client);

  // Optional: ensure push targets exist from fcm_tokens mirror for this user
  let ensuredTargets = [];
  if (userId && (!targets || !targets.length)) {
    try {
      const listed = await databases.listDocuments(DB, COL_TOKENS, [
        Query.equal("user_id", userId),
        Query.limit(20),
      ]);
      for (const row of listed.documents) {
        if (!row.token) continue;
        // Prefer sending via users[] — Appwrite resolves the user's push targets.
        // If caller asked for target-level send, we can create/update server targets.
        if (body.ensure_targets) {
          try {
            const targetId = `fcm_${String(row.$id).slice(0, 20)}`;
            const providerId = process.env.APPWRITE_MESSAGING_PROVIDER_ID;
            try {
              await usersApi.createTarget(
                userId,
                targetId,
                "push",
                row.token,
                providerId || undefined,
                row.platform || "android",
              );
            } catch {
              await usersApi.updateTarget(
                userId,
                targetId,
                row.token,
                providerId || undefined,
                row.platform || "android",
              );
            }
            ensuredTargets.push(targetId);
          } catch (e) {
            log(`ensure target skip: ${e.message || e}`);
          }
        }
      }
      log(
        `fcm_tokens mirror rows=${listed.documents.length}; ensured=${ensuredTargets.length}`,
      );
    } catch (e) {
      log(`fcm_tokens mirror read: ${e.message || e}`);
    }
  }

  const hasAudience =
    (users && users.length) ||
    (targets && targets.length) ||
    (ensuredTargets.length) ||
    (topics && topics.length);

  if (!hasAudience) {
    return json(res, 400, {
      success: false,
      error:
        "Provide user_id / users[] / targets[] / topics[] — Appwrite Messaging needs an audience",
      hint: "Client should register devices with account.createPushTarget after Capacitor PushNotifications.register()",
    });
  }

  try {
    const messageId = body.message_id || ID.unique();
    const msg = await messaging.createPush(
      messageId,
      title,
      message,
      topics && topics.length ? topics : undefined,
      users && users.length ? users : undefined,
      targets && targets.length
        ? targets
        : ensuredTargets.length
          ? ensuredTargets
          : undefined,
      Object.keys(data || {}).length ? data : undefined,
      body.action,
      body.image,
      body.icon,
      body.sound,
      body.color,
      body.tag,
      body.badge,
      draft,
      body.scheduled_at,
    );

    log(`Appwrite Messaging push created: ${msg.$id}`);
    return json(res, 200, {
      success: true,
      provider: "appwrite_messaging",
      message_id: msg.$id,
      status: msg.status,
      delivery: {
        users: users || [],
        targets: targets || ensuredTargets || [],
        topics: topics || [],
      },
      note: "FCM/APNs credentials belong in Appwrite Console Messaging providers — not in this function.",
    });
  } catch (err) {
    error(`Messaging.createPush failed: ${err.message || err}`);
    return json(res, 500, {
      success: false,
      provider: "appwrite_messaging",
      error: String(err.message || err),
      hint: "Configure an FCM/APNs provider in Appwrite Console → Messaging. Ensure API key has messaging.write + users.read.",
    });
  }
};
