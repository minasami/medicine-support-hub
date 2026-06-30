import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<void>;
  signInWithGoogle: () => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (profile: Partial<PatientProfile>) => Promise<void>;
  supabaseFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
};

const PatientAuthContext = createContext<PatientAuthContextValue | undefined>(undefined);
const STORAGE_KEY = "medicine_support_patient_session";
const STAFF_STORAGE_KEY = "medicine_support_staff_session";
const EXPIRY_SKEW_SECONDS = 60;

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

function normalizeSession(data: any): SupabaseSession {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? (data.expires_in ? now + Number(data.expires_in) : undefined),
    expires_in: data.expires_in,
    user: data.user ? { id: data.user.id, email: data.user.email } : data.user,
  };
}

function loadSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(STAFF_STORAGE_KEY);
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
  const expiresAt = expiresIn ? Math.floor(Date.now() / 1000) + Number(expiresIn) : undefined;
  window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
  return { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt };
}

export function PatientAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SupabaseSession | null>(() => readOAuthSession() ?? loadSession());
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  function applySession(next: SupabaseSession | null) {
    setSession(next);
    saveSession(next);
  }

  async function refreshSession(current: SupabaseSession): Promise<SupabaseSession> {
    if (!current.refresh_token) throw new Error("Session expired. Please sign in again.");
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || "Session expired. Please sign in again.");
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
    const h: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  async function supabaseFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const { url, key } = getConfig();
    let current = await getValidSession();
    const requestHeaders: Record<string, string> = {
      apikey: key,
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (current?.access_token) requestHeaders.Authorization = `Bearer ${current.access_token}`;

    let response = await fetch(`${url}${path}`, { ...init, headers: requestHeaders });
    let text = await response.text();
    let data = text ? JSON.parse(text) : null;

    const isExpired = !response.ok && typeof data?.message === "string" && data.message.toLowerCase().includes("jwt expired");
    if (isExpired && current?.refresh_token) {
      current = await refreshSession(current);
      response = await fetch(`${url}${path}`, {
        ...init,
        headers: { ...requestHeaders, Authorization: `Bearer ${current.access_token}` },
      });
      text = await response.text();
      data = text ? JSON.parse(text) : null;
    }

    if (!response.ok) throw new Error(data?.message || data?.error_description || data?.error || "Request failed");
    return data as T;
  }

  async function hydrateSession(current: SupabaseSession): Promise<SupabaseSession> {
    let valid = current;
    const now = Math.floor(Date.now() / 1000);
    if (valid.expires_at && valid.expires_at <= now + EXPIRY_SKEW_SECONDS) valid = await refreshSession(valid);
    if (valid.user?.id) return valid;
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${valid.access_token}` } });
    if (!response.ok) return valid;
    const user = await response.json();
    return { ...valid, user: { id: user.id, email: user.email } };
  }

  async function refreshProfile() {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    const rows = await supabaseFetch<PatientProfile[]>(`/rest/v1/profiles?select=id,full_name,phone,address,birthdate,city,gender,emergency_contact_name,emergency_contact_phone&id=eq.${session.user.id}&limit=1`);
    setProfile(rows[0] ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        if (session?.access_token && (!session.user?.id || (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + EXPIRY_SKEW_SECONDS))) {
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
    return () => { cancelled = true; };
  }, [session?.access_token, session?.user?.id]);

  async function signIn(email: string, password: string) {
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || "Sign in failed");
    applySession(normalizeSession(data));
  }

  async function signUp(email: string, password: string, fullName: string, phone: string) {
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/signup`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password, data: { full_name: fullName, phone } }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || "Sign up failed");
    if (data.access_token) applySession(normalizeSession(data));
  }

  function signInWithGoogle() {
    const { url } = getConfig();
    const redirectTo = `${window.location.origin}/account`;
    window.location.assign(`${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  }

  function signOut() {
    applySession(null);
    setProfile(null);
  }

  async function updateProfile(next: Partial<PatientProfile>) {
    if (!session?.user?.id) throw new Error("You must sign in first.");
    const updated = await supabaseFetch<PatientProfile[]>(`/rest/v1/profiles?id=eq.${session.user.id}&select=*`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(next) });
    setProfile(updated[0] ?? null);
  }

  return (
    <PatientAuthContext.Provider value={{ session, profile, loading, isAuthenticated: !!session?.access_token, signIn, signUp, signInWithGoogle, signOut, refreshProfile, updateProfile, supabaseFetch }}>
      {children}
    </PatientAuthContext.Provider>
  );
}

export function usePatientAuth() {
  const ctx = useContext(PatientAuthContext);
  if (!ctx) throw new Error("usePatientAuth must be used within PatientAuthProvider");
  return ctx;
}
