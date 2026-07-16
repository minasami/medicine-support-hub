import React, { createContext, useContext, useEffect, useState } from "react";
import { ROLE_HOME, useRole, type UserRole } from "./role";
import { rememberAuthDestination } from "./auth-return";

interface AuthContextType {
  loading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: (nextPath?: string) => void;
  activateSession: (
    session: StaffSession,
  ) => Promise<{ isStaff: boolean; home?: string }>;
  logout: () => Promise<void>;
}

type StaffSession = {
  access_token: string;
  refresh_token?: string;
  user?: { id: string; email?: string };
};
type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STAFF_SESSION_KEY = "medicine_support_staff_session";
const ENTERPRISE_SESSION_KEY = "medicine_support_patient_session";

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error("Supabase environment variables are missing.");
  return { url, key };
}

function mapRole(role: string): NonNullable<UserRole> | null {
  const r = role.toLowerCase();
  if (["admin", "platform_admin", "super_admin"].includes(r))
    return "PLATFORM_ADMIN";
  if (r === "reviewer") return "REVIEWER";
  if (r === "physician") return "PHYSICIAN";
  if (r === "pharmacist") return "PHARMACIST";
  if (r === "pharmacy_assistant") return "PHARMACY_ASSISTANT";
  if (r === "coordinator" || r === "delivery_man") return "DELIVERY_MAN";
  if (r === "data_entry") return "DATA_ENTRY";
  if (r === "branch_manager") return "BRANCH_MANAGER";
  if (r === "cosmetician") return "COSMETICIAN";
  return null;
}

function saveSession(session: StaffSession | null) {
  if (session) {
    const serialized = JSON.stringify(session);
    localStorage.setItem(STAFF_SESSION_KEY, serialized);
    localStorage.setItem(ENTERPRISE_SESSION_KEY, serialized);
  } else {
    localStorage.removeItem(STAFF_SESSION_KEY);
    localStorage.removeItem(ENTERPRISE_SESSION_KEY);
  }
}

function loadSession(): StaffSession | null {
  try {
    return JSON.parse(localStorage.getItem(STAFF_SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function readOAuthSession(): StaffSession | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  window.history.replaceState(
    null,
    document.title,
    window.location.pathname + window.location.search,
  );
  const session = {
    access_token: accessToken,
    refresh_token: params.get("refresh_token") || undefined,
  };
  localStorage.setItem(ENTERPRISE_SESSION_KEY, JSON.stringify(session));
  return session;
}

async function hydrate(session: StaffSession): Promise<StaffSession> {
  if (session.user?.id) return session;
  const { url, key } = getConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) throw new Error("Could not read authenticated user.");
  const user = await response.json();
  return { ...session, user: { id: user.id, email: user.email } };
}

async function profileFor(session: StaffSession): Promise<ProfileRow> {
  const { url, key } = getConfig();
  const current = await hydrate(session);
  const response = await fetch(
    `${url}/rest/v1/profiles?select=id,full_name,role,is_active&id=eq.${current.user?.id}&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${current.access_token}` },
    },
  );
  const rows = await response.json();
  if (!response.ok)
    throw new Error(rows?.message || "Could not read user profile.");
  if (!rows?.length)
    throw new Error("No platform profile exists for this account.");
  return rows[0];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser } = useRole();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<StaffSession | null>(
    () => readOAuthSession() ?? loadSession(),
  );

  async function applySession(next: StaffSession | null) {
    if (!next) {
      saveSession(null);
      setSession(null);
      setUser(null);
      return;
    }
    const current = await hydrate(next);
    const profile = await profileFor(current);
    if (!profile.is_active)
      throw new Error("This platform account is inactive.");
    const role = mapRole(profile.role);
    if (!role)
      throw new Error("This account does not have a staff platform role.");
    saveSession(current);
    setSession(current);
    setUser({
      id: 1,
      username: current.user?.email ?? profile.id,
      role,
      displayName: profile.full_name || current.user?.email || "Platform user",
      branchId: null,
    });
  }

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    applySession(session)
      .catch(() => {
        localStorage.removeItem(STAFF_SESSION_KEY);
        setSession(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { url, key } = getConfig();
      const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok)
        return {
          ok: false,
          error: data.error_description || data.msg || "Login failed",
        };
      await applySession(data);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  };

  const loginWithGoogle = (nextPath?: string) => {
    const { url } = getConfig();
    if (nextPath) rememberAuthDestination("staff", nextPath);
    const redirectTo = `${window.location.origin}/portal`;
    window.location.assign(
      `${url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`,
    );
  };

  const activateSession = async (next: StaffSession) => {
    try {
      const current = await hydrate(next);
      const profile = await profileFor(current);
      if (!profile.is_active) return { isStaff: false };
      const nextRole = mapRole(profile.role);
      if (!nextRole) return { isStaff: false };
      saveSession(current);
      setSession(current);
      setUser({
        id: 1,
        username: current.user?.email ?? profile.id,
        role: nextRole,
        displayName:
          profile.full_name || current.user?.email || "Platform user",
        branchId: null,
      });
      return { isStaff: true, home: ROLE_HOME[nextRole] };
    } catch {
      return { isStaff: false };
    }
  };

  const logout = async () => {
    saveSession(null);
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ loading, login, loginWithGoogle, activateSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
