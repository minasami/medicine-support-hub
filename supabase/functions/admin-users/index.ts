import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

type ProfilePatch = {
  username?: string | null;
  full_name?: string | null;
  role?: string;
  is_active?: boolean;
  phone?: string | null;
  address?: string | null;
  birthdate?: string | null;
  city?: string | null;
  gender?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
};

type AuthPatch = {
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
  ban_duration?: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function changedFields(input: Record<string, unknown>) {
  return Object.entries(input).filter(([, value]) => value !== undefined).map(([key]) => key);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase service configuration" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return json({ error: "Missing authorization token" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

  const requesterId = authData.user.id;
  const { data: requesterProfile, error: requesterError } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", requesterId)
    .maybeSingle();

  if (requesterError) return json({ error: requesterError.message }, 500);
  if (!requesterProfile?.is_active || !["admin", "platform_admin", "super_admin"].includes(requesterProfile.role)) {
    return json({ error: "Platform admin access required" }, 403);
  }

  if (req.method === "GET") {
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("id, username, full_name, role, is_active, phone, address, birthdate, city, gender, emergency_contact_name, emergency_contact_phone, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (profileError) return json({ error: profileError.message }, 500);

    const { data: userList, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (listError) return json({ error: listError.message }, 500);

    const authById = new Map(userList.users.map((user) => [user.id, user]));
    const users = (profiles ?? []).map((profile) => {
      const authUser = authById.get(profile.id);
      return {
        ...profile,
        email: authUser?.email ?? null,
        auth_phone: authUser?.phone ?? null,
        email_confirmed_at: authUser?.email_confirmed_at ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        banned_until: authUser?.banned_until ?? null,
        user_metadata: authUser?.user_metadata ?? {},
        app_metadata: authUser?.app_metadata ?? {},
      };
    });

    return json({ users });
  }

  if (req.method === "PATCH") {
    const payload = await req.json().catch(() => null) as null | { user_id?: string; profile?: ProfilePatch; auth?: AuthPatch };
    if (!payload?.user_id) return json({ error: "user_id is required" }, 400);

    const profilePatch = payload.profile ?? {};
    const authPatch = payload.auth ?? {};
    const profileFields = changedFields(profilePatch as Record<string, unknown>);
    const authFields = changedFields(authPatch as Record<string, unknown>);

    if (authFields.length) {
      const { error } = await admin.auth.admin.updateUserById(payload.user_id, authPatch);
      if (error) return json({ error: error.message }, 400);
    }

    if (profileFields.length) {
      const { error } = await admin
        .from("profiles")
        .update(profilePatch)
        .eq("id", payload.user_id);
      if (error) return json({ error: error.message }, 400);
    }

    await admin.from("platform_admin_user_audit").insert({
      admin_user_id: requesterId,
      target_user_id: payload.user_id,
      action: "update_user",
      changed_fields: [...profileFields.map((field) => `profile.${field}`), ...authFields.map((field) => `auth.${field}`)],
    });

    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
});
