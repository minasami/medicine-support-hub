import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const topics = new Set(["platform_updates", "medicine_updates", "company_updates", "marketplace_updates", "learning_updates", "favorite_updates"]);
const audienceTypes = new Set(["all", "topic", "users", "medicine", "company", "role"]);
const protectedRoute = /^\/(admin|workspace|dashboard|account|portal|login|track|pharmacy|reviewer|physician|employee|delivery|branch-manager|data-entry|clinical-assistant|health-record|clinical)(\/|$)/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "private, no-store" } });

function cleanTarget(value: unknown) {
  const raw = String(value || "/").trim();
  let relative = "/";
  if (raw.startsWith("/")) relative = raw;
  else {
    try {
      const parsed = new URL(raw);
      if (parsed.hostname === "medicine-support-hub.vercel.app") relative = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch { relative = "/"; }
  }
  if (protectedRoute.test(relative)) throw new Error("Push campaigns cannot link directly to protected workspace or health-record routes.");
  return relative.slice(0, 500);
}
function preferenceAllows(preference: Record<string, unknown> | undefined, topic: string) { return preference?.[topic] !== false; }

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration is incomplete" }, 500);
  const authorization = req.headers.get("Authorization") || "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Authentication required" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);
  const { data: profile, error: profileError } = await admin.from("profiles").select("id,role,is_active").eq("id", userData.user.id).maybeSingle();
  if (profileError || !profile?.is_active || !["admin", "platform_admin", "super_admin"].includes(profile.role)) return json({ error: "Active platform administrator access required" }, 403);

  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: "Invalid JSON payload" }, 400); }
  if (input.containsProtectedHealthInformation === true || (input.data as Record<string, unknown> | undefined)?.contains_protected_health_information === true) return json({ error: "Protected health information is not allowed in push notifications" }, 400);

  const title = String(input.title || "").trim().slice(0, 120);
  const body = String(input.body || "").trim().slice(0, 500);
  const topic = topics.has(String(input.topic)) ? String(input.topic) : "platform_updates";
  const audienceType = audienceTypes.has(String(input.audienceType)) ? String(input.audienceType) : "topic";
  const audienceValues = Array.isArray(input.audienceValues) ? input.audienceValues.map((value) => String(value).trim()).filter(Boolean).slice(0, 500) : [];
  const imageUrl = typeof input.imageUrl === "string" && /^https:\/\//.test(input.imageUrl) ? input.imageUrl.slice(0, 1000) : null;
  let targetUrl: string;
  try { targetUrl = cleanTarget(input.targetUrl); } catch (error) { return json({ error: error instanceof Error ? error.message : "Invalid target URL" }, 400); }
  if (title.length < 2 || body.length < 2) return json({ error: "Title and message are required" }, 400);
  if (["users", "role", "medicine", "company"].includes(audienceType) && !audienceValues.length) return json({ error: `Audience values are required for ${audienceType} campaigns` }, 400);

  const { data: campaign, error: campaignError } = await admin.from("notification_campaigns").insert({
    title, body, audience_type: audienceType, audience_values: audienceValues, notification_topic: topic,
    target_url: targetUrl, icon_url: "/pwa-icon.svg", image_url: imageUrl,
    data: { source: "admin_notification_center", intelligent_template: Boolean(input.intelligentTemplate), contains_protected_health_information: false },
    status: "sending", started_at: new Date().toISOString(), created_by: userData.user.id,
  }).select("id").single();
  if (campaignError || !campaign) return json({ error: campaignError?.message || "Could not create campaign" }, 400);

  let allowedUsers: Set<string> | null = null;
  if (audienceType === "users") allowedUsers = new Set(audienceValues);
  if (audienceType === "role") {
    const { data: rows, error } = await admin.from("profiles").select("id").eq("is_active", true).in("role", audienceValues);
    if (error) return json({ error: error.message }, 500);
    allowedUsers = new Set((rows || []).map((row) => row.id));
  }
  if (audienceType === "medicine" || audienceType === "company") {
    const entityType = audienceType;
    const { data: rows, error } = await admin.from("public_entity_favorites").select("user_id").eq("entity_type", entityType).in("entity_key", audienceValues);
    if (error) return json({ error: error.message }, 500);
    allowedUsers = new Set((rows || []).map((row) => row.user_id));
  }

  const { data: allSubscriptions, error: subscriptionError } = await admin.from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth_key,topics,failure_count")
    .eq("is_enabled", true).limit(5000);
  if (subscriptionError) {
    await admin.from("notification_campaigns").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", campaign.id);
    return json({ error: subscriptionError.message }, 500);
  }

  const userIds = [...new Set((allSubscriptions || []).map((row) => row.user_id).filter(Boolean))];
  const { data: preferenceRows } = userIds.length ? await admin.from("notification_preferences").select("*").in("user_id", userIds) : { data: [] };
  const preferences = new Map((preferenceRows || []).map((row) => [row.user_id, row]));
  const selected = (allSubscriptions || []).filter((subscription) => {
    if (allowedUsers && (!subscription.user_id || !allowedUsers.has(subscription.user_id))) return false;
    if (audienceType === "topic" && !(subscription.topics || []).includes(topic)) return false;
    if (subscription.user_id && !preferenceAllows(preferences.get(subscription.user_id), topic)) return false;
    return true;
  });

  const { data: credentials, error: credentialsError } = await admin.rpc("get_web_push_credentials");
  const credential = Array.isArray(credentials) ? credentials[0] : credentials;
  if (credentialsError || !credential?.public_key || !credential?.private_key) {
    await admin.from("notification_campaigns").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", campaign.id);
    return json({ error: "Web-push credentials are unavailable" }, 500);
  }
  webpush.setVapidDetails(credential.subject || "mailto:jesussavedmina@gmail.com", credential.public_key, credential.private_key);

  const payload = JSON.stringify({ campaignId: campaign.id, title, body, url: targetUrl, icon: "/pwa-icon.svg", badge: "/pwa-icon.svg", image: imageUrl, topic, timestamp: Date.now() });
  let delivered = 0, failed = 0;
  const deliveryRows: Array<Record<string, unknown>> = [];
  const targetedUsers = new Set(selected.map((row) => row.user_id).filter(Boolean));

  for (let index = 0; index < selected.length; index += 40) {
    const batch = selected.slice(index, index + 40);
    await Promise.allSettled(batch.map(async (subscription) => {
      try {
        const response = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, payload, { TTL: 86400, urgency: topic === "medicine_updates" ? "normal" : "low" });
        delivered += 1;
        deliveryRows.push({ campaign_id: campaign.id, user_id: subscription.user_id, subscription_id: subscription.id, status: "sent", provider_status: response.statusCode, sent_at: new Date().toISOString() });
        await admin.from("push_subscriptions").update({ failure_count: 0, last_error: null, last_success_at: new Date().toISOString(), last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", subscription.id);
      } catch (cause) {
        failed += 1;
        const statusCode = Number((cause as { statusCode?: number })?.statusCode || 0) || null;
        const failureMessage = cause instanceof Error ? cause.message.slice(0, 500) : "Push delivery failed";
        const expired = statusCode === 404 || statusCode === 410;
        deliveryRows.push({ campaign_id: campaign.id, user_id: subscription.user_id, subscription_id: subscription.id, status: expired ? "expired" : "failed", provider_status: statusCode, failure_reason: failureMessage });
        await admin.from("push_subscriptions").update({ is_enabled: expired ? false : true, failure_count: Number(subscription.failure_count || 0) + 1, last_error: failureMessage, updated_at: new Date().toISOString() }).eq("id", subscription.id);
      }
    }));
  }
  if (deliveryRows.length) await admin.from("notification_deliveries").insert(deliveryRows);
  if (targetedUsers.size) await admin.from("user_notifications").insert([...targetedUsers].map((userId) => ({ user_id: userId, campaign_id: campaign.id, title, body, target_url: targetUrl, notification_topic: topic, entity_type: audienceType === "medicine" ? "medicine" : audienceType === "company" ? "company" : null, entity_key: ["medicine", "company"].includes(audienceType) ? audienceValues[0] || null : null })));

  const finalStatus = delivered > 0 || selected.length === 0 ? "sent" : "failed";
  await admin.from("notification_campaigns").update({ status: finalStatus, attempted_count: selected.length, delivered_count: delivered, failed_count: failed, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", campaign.id);
  return json({ campaignId: campaign.id, status: finalStatus, audienceType, matchedUsers: targetedUsers.size, attempted: selected.length, delivered, failed });
});
