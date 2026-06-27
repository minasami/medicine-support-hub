import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
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

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

function loadSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
  return { access_token: accessToken, refresh_token: refreshToken };
}

export function PatientAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SupabaseSession | null>(() => readOAuthSession() ?? loadSession());
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = useMemo(() => {
    const { key } = getConfig();
    const h: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  async function supabaseFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const { url } = getConfig();
    const response = await fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) throw new Error(data?.message || data?.error_description || data?.error || "Request failed");
    return data as T;
  }

  async function hydrateSession(current: SupabaseSession): Promise<SupabaseSession> {
    if (current.user?.id) return current;
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${current.access_token}` } });
    if (!response.ok) return current;
    const user = await response.json();
    return { ...current, user: { id: user.id, email: user.email } };
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
        if (session?.access_token && !session.user?.id) {
          const hydrated = await hydrateSession(session);
          if (!cancelled) setSession(hydrated);
          return;
        }
        saveSession(session);
        await refreshProfile();
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
    setSession(data);
  }

  async function signUp(email: string, password: string, fullName: string, phone: string) {
    const { url, key } = getConfig();
    const response = await fetch(`${url}/auth/v1/signup`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password, data: { full_name: fullName, phone } }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || data.msg || "Sign up failed");
    if (data.access_token) setSession(data);
  }

  function signInWithGoogle() {
    const { url } = getConfig();
    const redirectTo = `${window.location.origin}/account`;
    window.location.assign(`${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  }

  function signOut() {
    setSession(null);
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
