import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: { id: string; email?: string };
};

export type PatientProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  birthdate: string | null;
  city: string | null;
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

type PatientAuthContextValue = {
  session: SupabaseSession | null;
  profile: PatientProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    redirectTo?: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  signInWithGoogle: () => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (profile: Partial<PatientProfile>) => Promise<void>;
  updateEmail: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  supabaseFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
};

const PatientAuthContext = createContext<PatientAuthContextValue | undefined>(
  undefined,
);
const STORAGE_KEY = "medicine_support_patient_session";
const STAFF_STORAGE_KEY = "medicine_support_staff_session";
const EXPIRY_SKEW_SECONDS = 60;
const READ_ONLY_RPC =
  /^\/rest\/v1\/rpc\/(search_|recent_|database_storage_admin_health$|notification_admin_summary$)/;

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

function normalizeSession(data: any): SupabaseSession {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at:
      data.expires_at ??
      (data.expires_in ? now + Number(data.expires_in) : undefined),
    expires_in: data.expires_in,
    user: data.user ? { id: data.user.id, email: data.user.email } : data.user,
  };
}

function loadSession(): SupabaseSession | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(STAFF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: SupabaseSession | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

function readOAuthSession(): SupabaseSession | null {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  const refreshToken = params.get("refresh_token") ?? undefined;
  const expiresIn = params.get("expires_in");
  const expiresAt = expiresIn
    ? Math.floor(Date.now() / 1000) + Number(expiresIn)
    : undefined;
  window.history.replaceState(
    null,
    document.title,
    window.location.pathname + window.location.search,
  );
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  };
}

function parseBody(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function isStatementTimeout(data: any, text: string) {
  const combined = [data?.message, data?.error, data?.details, data?.hint, text]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    data?.code === "57014" ||
    combined.includes("statement timeout") ||
    combined.includes("canceling statement")
  );
}

function isRetryableRead(path: string, init: RequestInit) {
  const method = String(init.method || "GET").toUpperCase();
  return method === "GET" || (method === "POST" && READ_ONLY_RPC.test(path));
}

function timeoutMessage() {
  return "This page query took too long. Please retry, narrow the search, or open the page again in a moment.";
}

export function PatientAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<SupabaseSession | null>(
    () => readOAuthSession() ?? loadSession(),
  );
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  function applySession(next: SupabaseSession | null) {
    setSession(next);
    saveSession(next);
  }

  async function refreshSession(
    current: SupabaseSession,
  ): Promise<SupabaseSession> {
    if (!current.refresh_token)
      throw new Error("Session expired. Please sign in again.");
    const { url, key } = getConfig();
    const response = await fetch(
      `${url}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error_description ||
          data.msg ||
          "Session expired. Please sign in again.",
      );
    const refreshed = normalizeSession(data);
    applySession(refreshed);
    return refreshed;
  }

  async function getValidSession(): Promise<SupabaseSession | null> {
    if (!session?.access_token) return null;
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at <= now + EXPIRY_SKEW_SECONDS) {
      return refreshSession(session);
    }
    return session;
  }

  const headers = useMemo(() => {
    const { key } = getConfig();
    const h: Record<string, string> = {
      apikey: key,
      "Content-Type": "application/json",
    };
    if (session?.access_token)
      h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  async function supabaseFetch<T = unknown>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const { url, key } = getConfig();
    let current = await getValidSession();
    const requestHeaders: Record<string, string> = {
      apikey: key,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (current?.access_token)
      requestHeaders.Authorization = `Bearer ${current.access_token}`;

    const execute = async (authorization?: string) => {
      const response = await fetch(`${url}${path}`, {
        ...init,
        headers: authorization
          ? { ...requestHeaders, Authorization: authorization }
          : requestHeaders,
      });
      const text = await response.text();
      return { response, text, data: parseBody(text) };
    };

    let result = await execute();
    const isExpired =
      !result.response.ok &&
      typeof result.data?.message === "string" &&
      result.data.message.toLowerCase().includes("jwt expired");

    if (isExpired && current?.refresh_token) {
      current = await refreshSession(current);
      result = await execute(`Bearer ${current.access_token}`);
    }

    if (
      !result.response.ok &&
      isStatementTimeout(result.data, result.text) &&
      isRetryableRead(path, init)
    ) {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      result = await execute(
        current?.access_token ? `Bearer ${current.access_token}` : undefined,
      );
    }

    if (!result.response.ok) {
      if (isStatementTimeout(result.data, result.text))
        throw new Error(timeoutMessage());
      throw new Error(
        result.data?.message ||
          result.data?.error_description ||
          result.data?.error ||
          "Request failed",
      );
    }
    return result.data as T;
  }

  async function hydrateSession(
    current: SupabaseSession,
  ): Promise<SupabaseSession> {
    let valid = current;
    const now = Math.floor(Date.now() / 1000);
    if (valid.expires_at && valid.expires_at <= now + EXPIRY_SKEW_SECONDS)
      valid = await refreshSession(valid);
    if (valid.user?.id) return valid;
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${valid.access_token}` },
    });
    if (!response.ok) return valid;
    const user = await response.json();
    return { ...valid, user: { id: user.id, email: user.email } };
  }

  async function refreshProfile() {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    const rows = await supabaseFetch<PatientProfile[]>(
      `/rest/v1/profiles?select=id,full_name,phone,address,birthdate,city,gender,emergency_contact_name,emergency_contact_phone&id=eq.${session.user.id}&limit=1`,
    );
    setProfile(rows[0] ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        if (
          session?.access_token &&
          (!session.user?.id ||
            (session.expires_at &&
              session.expires_at <=
                Math.floor(Date.now() / 1000) + EXPIRY_SKEW_SECONDS))
        ) {
          const hydrated = await hydrateSession(session);
          if (!cancelled) applySession(hydrated);
          return;
        }
        saveSession(session);
        await refreshProfile();
      } catch {
        if (!cancelled) {
          applySession(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, session?.user?.id]);

  async function signIn(email: string, password: string) {
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error_description || data.msg || "Sign in failed");
    applySession(normalizeSession(data));
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string,
    phone: string,
    redirectTo?: string,
  ) {
    const { url, key } = getConfig();
    const endpoint = redirectTo
      ? `${url}/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`
      : `${url}/auth/v1/signup`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        data: { full_name: fullName, phone },
      }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error_description || data.msg || "Sign up failed");
    if (data.access_token) applySession(normalizeSession(data));
    return { requiresEmailConfirmation: !data.access_token };
  }

  function signInWithGoogle() {
    const { url } = getConfig();
    const redirectTo = `${window.location.origin}/account`;
    window.location.assign(
      `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
    );
  }

  function signOut() {
    applySession(null);
    setProfile(null);
  }

  async function updateProfile(next: Partial<PatientProfile>) {
    if (!session?.user?.id) throw new Error("You must sign in first.");
    const updated = await supabaseFetch<PatientProfile[]>(
      `/rest/v1/profiles?id=eq.${session.user.id}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(next),
      },
    );
    setProfile(updated[0] ?? null);
  }

  async function updateEmail(email: string, redirectTo?: string) {
    const current = await getValidSession();
    if (!current?.access_token) throw new Error("You must sign in first.");
    const { url, key } = getConfig();
    const endpoint = redirectTo
      ? `${url}/auth/v1/user?redirect_to=${encodeURIComponent(redirectTo)}`
      : `${url}/auth/v1/user`;
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        apikey: key,
        Authorization: `Bearer ${current.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.msg || data.message || "Email change failed");
  }

  async function updatePassword(currentPassword: string, newPassword: string) {
    const current = await getValidSession();
    if (!current?.access_token) throw new Error("You must sign in first.");
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: key,
        Authorization: `Bearer ${current.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_password: currentPassword,
        password: newPassword,
      }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.msg || data.message || "Password change failed");
  }

  return (
    <PatientAuthContext.Provider
      value={{
        session,
        profile,
        loading,
        isAuthenticated: !!session?.access_token,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfile,
        updateEmail,
        updatePassword,
        supabaseFetch,
      }}
    >
      {children}
    </PatientAuthContext.Provider>
  );
}

export function usePatientAuth() {
  const ctx = useContext(PatientAuthContext);
  if (!ctx)
    throw new Error("usePatientAuth must be used within PatientAuthProvider");
  return ctx;
}
