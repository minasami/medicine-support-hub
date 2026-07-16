import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("COMPANY_APPROVAL_FROM_EMAIL") || Deno.env.get("CARE_NETWORK_FROM_EMAIL");
  const replyTo = Deno.env.get("CARE_NETWORK_SUPPORT_EMAIL");
  const siteUrl = (Deno.env.get("PUBLIC_SITE_URL") || "https://medicinesupport.app").replace(/\/+$/, "");
  const authorization = request.headers.get("Authorization") || "";

  if (!supabaseUrl || !publishableKey || !serviceRoleKey || !resendKey || !from) {
    return json({ error: "Email delivery is not configured" }, 500);
  }

  const caller = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userResult } = await caller.auth.getUser();
  if (!userResult.user) return json({ error: "Authentication required" }, 401);

  const { data: allowed, error: permissionError } = await caller.rpc("platform_user_has_permission", {
    target_permission: "industry.review",
    target_organization: null,
  });
  if (permissionError || !allowed) return json({ error: "Industry review permission required" }, 403);

  let input: { claim_id?: string };
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const claimId = String(input.claim_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(claimId)) return json({ error: "Invalid claim" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claim, error: claimError } = await admin
    .from("industry_company_profile_claims")
    .select("id,proposed_company_name,work_email,status,company_slug,approval_email_sent_at")
    .eq("id", claimId)
    .single();
  if (claimError || !claim) return json({ error: "Claim not found" }, 404);
  if (claim.status !== "approved") return json({ error: "Claim is not approved" }, 409);
  if (claim.approval_email_sent_at) return json({ sent: true, alreadySent: true });

  const companyName = escapeHtml(String(claim.proposed_company_name));
  const companyUrl = `${siteUrl}/companies/${encodeURIComponent(String(claim.company_slug || ""))}`;
  const workspaceUrl = `${siteUrl}/industry`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [claim.work_email],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject: `Your ${claim.proposed_company_name} company access is approved`,
      html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;line-height:1.6;color:#17343a"><h1 style="font-size:24px">Company access approved</h1><p>Your representation request for <strong>${companyName}</strong> has been approved.</p><p>You can now complete the company About section, publish services and manufacturing capabilities, explain what makes the company distinctive, and submit medicine products for governed review.</p><p><a href="${workspaceUrl}" style="display:inline-block;background:#19747e;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Open company workspace</a></p><p><a href="${companyUrl}">View the public company profile</a></p><hr><p dir="rtl">تمت الموافقة على طلب تمثيل شركة <strong>${companyName}</strong>. يمكنك الآن استكمال نبذة الشركة وخدماتها وقدراتها وإضافة المنتجات للمراجعة.</p><p dir="rtl"><a href="${workspaceUrl}">فتح مساحة عمل الشركة</a></p></div>`,
    }),
  });
  const result = await response.json();
  if (!response.ok) return json({ error: result?.message || "Email provider rejected the message" }, 502);

  await admin
    .from("industry_company_profile_claims")
    .update({ approval_email_sent_at: new Date().toISOString() })
    .eq("id", claimId)
    .is("approval_email_sent_at", null);

  return json({ sent: true, id: result?.id || null });
});
