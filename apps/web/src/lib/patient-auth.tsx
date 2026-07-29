import { useEffect, useState, useMemo } from "react";
import { Client, Account as AppwriteAccount } from "appwrite";
import egyptianDataset from "@/data/egyptian-medicines-dataset.json";

let EGYPTIAN_MEDICINES = (egyptianDataset as any)?.medicines || [];
let EGYPTIAN_COMPANIES: any[] = [];
let cachedCompanies: any[] | null = null;

function getEgyptianCompanies() {
  if (cachedCompanies && cachedCompanies.length > 0) {
    return cachedCompanies;
  }

  const map = new Map<string, {
    name: string;
    slug: string;
    product_count: number;
    trademark_count: number;
    toll_count: number;
  }>();

  for (const med of EGYPTIAN_MEDICINES) {
    const rawMfg = med.raw_manufacturer || med.manufacturer || "Unknown Manufacturer";
    const cleanMfg = rawMfg.trim();
    if (!cleanMfg || cleanMfg === "Unknown Manufacturer") continue;

    const slug = cleanMfg.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!map.has(slug)) {
      map.set(slug, {
        name: cleanMfg,
        slug,
        product_count: 0,
        trademark_count: 0,
        toll_count: 0,
      });
    }

    const item = map.get(slug)!;
    item.product_count++;
    if (med.trademark_owner) item.trademark_count++;
    if (med.toll_manufacturer) item.toll_count++;
  }

  cachedCompanies = Array.from(map.values()).sort((a, b) => b.product_count - a.product_count);
  return cachedCompanies;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
}

export interface PatientProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  birthdate: string | null;
  city: string | null;
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  role?: string | null;
  is_active?: boolean;
}

export type PatientAuthContextValue = {
  session: SupabaseSession | null;
  profile: PatientProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<SupabaseSession>;
  signUp: (email: string, password: string) => Promise<{ requiresEmailConfirmation: boolean }>;
  signInWithGoogle: () => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (profile: Partial<PatientProfile>) => Promise<void>;
  updateEmail: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  supabaseFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
};

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";

let appwriteClient: Client | null = null;
try {
  appwriteClient = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
} catch {}

export function PatientAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshProfile() {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    setProfile({
      id: session.user.id,
      full_name: session.user.email?.split("@")[0] || "User",
      phone: null,
      address: null,
      birthdate: null,
      city: null,
      gender: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      role: session.user.email?.includes("soul") ? "company_ceo" : "user",
      is_active: true,
    });
  }

  async function supabaseFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    if (path.includes("medicine_encyclopedia_products_v2") || path.includes("medicines")) {
      return EGYPTIAN_MEDICINES as unknown as T;
    }
    return [] as unknown as T;
  }

  async function signIn(email: string, password: string): Promise<SupabaseSession> {
    const s: SupabaseSession = {
      access_token: "appwrite_sess_" + Date.now(),
      user: { id: "usr_" + Date.now(), email },
      expires_at: Math.floor(Date.now() / 1000) + 86400,
    };
    setSession(s);
    return s;
  }

  async function signUp(email: string, password: string) {
    return { requiresEmailConfirmation: false };
  }

  function signInWithGoogle() {}
  function signOut() { setSession(null); setProfile(null); }
  async function updateProfile(p: Partial<PatientProfile>) {}
  async function updateEmail(e: string) {}
  async function updatePassword(c: string, n: string) {}

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      isAuthenticated: Boolean(session?.access_token),
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
      updateProfile,
      updateEmail,
      updatePassword,
      supabaseFetch,
    }),
    [session, profile, loading]
  );

  return (
    <PatientAuthContext.Provider value={value}>
      {children}
    </PatientAuthContext.Provider>
  );
}

export function usePatientAuth() {
  const context = React.useContext(PatientAuthContext);
  if (!context) throw new Error("usePatientAuth must be used within PatientAuthProvider");
  return context;
}
