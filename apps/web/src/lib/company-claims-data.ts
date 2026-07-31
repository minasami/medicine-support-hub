/**
 * Company representative claims — Appwrite first, localStorage mirror.
 * Replaces silent Supabase REST posts that fail after the migration.
 */
import { Client, Databases, ID, Query } from "appwrite";

const ENDPOINT =
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  import.meta.env.VITE_APPWRITE_DATABASE_ID || "medicine_support_hub";
const TABLE_ID =
  import.meta.env.VITE_APPWRITE_CLAIMS_COLLECTION_ID || "company_profile_claims";

const LS_KEYS = [
  "msh_representative_claims_v1",
  "msh_company_claims_v1",
  "msh_industry_claims_v1",
] as const;

export type CompanyClaimRecord = {
  id?: string;
  company_slug: string;
  company_name: string;
  proposed_company_name?: string;
  company_type?: string;
  work_email: string;
  user_email?: string;
  user_id?: string | null;
  mobile_phone?: string;
  role_title?: string;
  website?: string;
  notes?: string;
  status: "pending" | "under_review" | "approved" | "rejected" | string;
  is_approved: boolean;
  verification_score?: number;
  requested_by?: string;
  reviewer_notes?: string | null;
  reviewed_at?: string | null;
  automated_recommendation?: string;
  created_at?: string;
};

let db: Databases | null = null;
let appwriteReady: boolean | null = null;

function getDb(): Databases {
  if (!db) {
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
    db = new Databases(client);
  }
  return db;
}

function mirrorLocal(claim: CompanyClaimRecord) {
  if (typeof window === "undefined") return;
  try {
    for (const key of LS_KEYS) {
      const raw = localStorage.getItem(key);
      let list: CompanyClaimRecord[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];
      const id = claim.id;
      list = list.filter((c) => c.id !== id && c.work_email !== claim.work_email);
      list.unshift(claim);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {
    /* ignore */
  }
}

function readLocalAll(): CompanyClaimRecord[] {
  if (typeof window === "undefined") return [];
  const out: CompanyClaimRecord[] = [];
  const seen = new Set<string>();
  try {
    for (const key of LS_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) continue;
      for (const c of list) {
        const k = String(c.id || `${c.work_email}:${c.company_slug}`);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c);
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export async function probeClaimsTable(): Promise<boolean> {
  if (appwriteReady != null) return appwriteReady;
  try {
    await getDb().listDocuments(DATABASE_ID, TABLE_ID, [Query.limit(1)]);
    appwriteReady = true;
  } catch {
    appwriteReady = false;
  }
  return appwriteReady;
}

export async function submitCompanyClaim(
  input: Omit<CompanyClaimRecord, "status" | "is_approved"> & {
    status?: string;
    is_approved?: boolean;
  },
): Promise<{ claim: CompanyClaimRecord; storage: "appwrite" | "localStorage" }> {
  const claim: CompanyClaimRecord = {
    ...input,
    proposed_company_name: input.proposed_company_name || input.company_name,
    status: input.status || "pending",
    is_approved: input.is_approved === true,
    verification_score: input.verification_score ?? 50,
    automated_recommendation:
      input.automated_recommendation || "ready_for_admin_review",
    created_at: input.created_at || new Date().toISOString(),
  };

  const ready = await probeClaimsTable();
  if (ready) {
    try {
      const docId = claim.id?.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 36) || ID.unique();
      const { id: _drop, created_at: _c, ...data } = claim;
      const doc = await getDb().createDocument(DATABASE_ID, TABLE_ID, docId, {
        ...data,
        user_id: data.user_id || "",
        website: data.website || "",
        notes: data.notes || "",
        mobile_phone: data.mobile_phone || "",
        role_title: data.role_title || "",
        reviewer_notes: data.reviewer_notes || "",
        reviewed_at: data.reviewed_at || "",
      });
      const saved: CompanyClaimRecord = {
        ...claim,
        id: doc.$id,
        created_at: doc.$createdAt || claim.created_at,
      };
      mirrorLocal(saved);
      return { claim: saved, storage: "appwrite" };
    } catch (err) {
      console.warn("[company-claims] Appwrite create failed, local only", err);
    }
  }

  const localId = claim.id || `claim_${Date.now()}`;
  const local = { ...claim, id: localId };
  mirrorLocal(local);
  return { claim: local, storage: "localStorage" };
}

export async function listCompanyClaims(options?: {
  status?: string;
  workEmail?: string;
  limit?: number;
}): Promise<{ claims: CompanyClaimRecord[]; storage: "appwrite" | "localStorage" }> {
  const limit = options?.limit ?? 100;
  const ready = await probeClaimsTable();

  if (ready) {
    try {
      const queries = [Query.limit(limit), Query.orderDesc("$createdAt")];
      if (options?.status) queries.push(Query.equal("status", options.status));
      if (options?.workEmail)
        queries.push(Query.equal("work_email", options.workEmail.toLowerCase()));
      const res = await getDb().listDocuments(DATABASE_ID, TABLE_ID, queries);
      const claims = res.documents.map((d) => ({
        id: d.$id,
        company_slug: String(d.company_slug || ""),
        company_name: String(d.company_name || ""),
        proposed_company_name: String(d.proposed_company_name || d.company_name || ""),
        company_type: String(d.company_type || ""),
        work_email: String(d.work_email || "").toLowerCase(),
        user_email: String(d.user_email || "").toLowerCase(),
        user_id: d.user_id ? String(d.user_id) : null,
        mobile_phone: String(d.mobile_phone || ""),
        role_title: String(d.role_title || ""),
        website: String(d.website || ""),
        notes: String(d.notes || ""),
        status: String(d.status || "pending"),
        is_approved: Boolean(d.is_approved),
        verification_score: Number(d.verification_score ?? 50),
        requested_by: String(d.requested_by || ""),
        reviewer_notes: d.reviewer_notes ? String(d.reviewer_notes) : null,
        reviewed_at: d.reviewed_at ? String(d.reviewed_at) : null,
        automated_recommendation: String(d.automated_recommendation || ""),
        created_at: d.$createdAt,
      })) as CompanyClaimRecord[];
      return { claims, storage: "appwrite" };
    } catch (err) {
      console.warn("[company-claims] list failed", err);
    }
  }

  let claims = readLocalAll();
  if (options?.status)
    claims = claims.filter((c) => c.status === options.status);
  if (options?.workEmail) {
    const e = options.workEmail.toLowerCase();
    claims = claims.filter(
      (c) =>
        c.work_email?.toLowerCase() === e || c.user_email?.toLowerCase() === e,
    );
  }
  return { claims: claims.slice(0, limit), storage: "localStorage" };
}

export async function reviewCompanyClaim(
  claimId: string,
  decision: "approved" | "rejected",
  reviewerNotes?: string | null,
): Promise<CompanyClaimRecord | null> {
  const is_approved = decision === "approved";
  const status = decision;
  const reviewed_at = new Date().toISOString();
  const patch = {
    status,
    is_approved,
    reviewer_notes: reviewerNotes || "",
    reviewed_at,
  };

  const ready = await probeClaimsTable();
  if (ready) {
    try {
      const doc = await getDb().updateDocument(
        DATABASE_ID,
        TABLE_ID,
        claimId,
        patch,
      );
      const saved: CompanyClaimRecord = {
        id: doc.$id,
        company_slug: String(doc.company_slug || ""),
        company_name: String(doc.company_name || ""),
        work_email: String(doc.work_email || ""),
        status: String(doc.status),
        is_approved: Boolean(doc.is_approved),
        reviewer_notes: reviewerNotes || null,
        reviewed_at,
      };
      mirrorLocal({ ...saved, proposed_company_name: saved.company_name });
      return saved;
    } catch (err) {
      console.warn("[company-claims] review Appwrite failed", err);
    }
  }

  // localStorage-only approve (same browser)
  const all = readLocalAll();
  const hit = all.find((c) => c.id === claimId);
  if (!hit) return null;
  const updated = { ...hit, ...patch };
  mirrorLocal(updated);
  return updated;
}

export async function findClaimForEmail(
  email: string,
): Promise<CompanyClaimRecord | null> {
  const { claims } = await listCompanyClaims({
    workEmail: email.toLowerCase().trim(),
    limit: 5,
  });
  return claims[0] || null;
}
