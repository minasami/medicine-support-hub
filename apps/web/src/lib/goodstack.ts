/**
 * Goodstack (global nonprofit verification + monetary donation rails).
 *
 * Publishable key may be used from the browser for Organisation Search.
 * Secret key must only be used in Appwrite Functions / server code.
 *
 * Docs: https://docs.goodstack.io/
 * See also: docs/GOODSTACK_INTEGRATION.md
 */

const API_BASE = "https://api.goodstack.io/v1";

function publishableKey(): string {
  try {
    return String(
      (typeof import.meta !== "undefined" &&
        (import.meta as any).env?.VITE_GOODSTACK_PUBLISHABLE_KEY) ||
        "",
    ).trim();
  } catch {
    return "";
  }
}

/** True when frontend can call public Goodstack search. */
export function isGoodstackConfigured(): boolean {
  return publishableKey().startsWith("pk_");
}

export type GoodstackVerificationStatus =
  | "unknown"
  | "pending"
  | "verified"
  | "rejected";

export type GoodstackOrganisation = {
  id: string;
  name: string;
  countryCode?: string | null;
  registryId?: string | null;
  registryName?: string | null;
  description?: string | null;
  website?: string | null;
  claimed?: boolean;
  raw?: Record<string, unknown>;
};

export type SearchOrganisationsParams = {
  query: string;
  /** ISO country code, e.g. EG */
  countryCode?: string;
  /** Official registry id when known */
  registryId?: string;
  limit?: number;
  cursor?: string | null;
};

export type SearchOrganisationsResult = {
  items: GoodstackOrganisation[];
  totalResults?: number;
  exhaustiveTotalResults?: boolean;
  nextCursor?: string | null;
  configured: boolean;
  error?: string | null;
};

function mapOrganisation(doc: Record<string, unknown>): GoodstackOrganisation {
  const id = String(doc.id || doc.organisationId || "");
  return {
    id,
    name: String(doc.name || doc.displayName || "Organisation"),
    countryCode: (doc.countryCode as string) || (doc.country as string) || null,
    registryId: (doc.registryId as string) || null,
    registryName: (doc.registryName as string) || null,
    description: (doc.description as string) || null,
    website: (doc.website as string) || (doc.url as string) || null,
    claimed: Boolean(doc.claimed),
    raw: doc,
  };
}

/**
 * Search verified / listed nonprofits via Goodstack.
 * Safe for browser use with the publishable key only.
 */
export async function searchOrganisations(
  params: SearchOrganisationsParams,
): Promise<SearchOrganisationsResult> {
  const key = publishableKey();
  if (!key.startsWith("pk_")) {
    return {
      items: [],
      configured: false,
      error: "Goodstack publishable key not configured (VITE_GOODSTACK_PUBLISHABLE_KEY)",
    };
  }

  const q = (params.query || "").trim();
  if (q.length < 2 && !params.registryId) {
    return { items: [], configured: true, error: null };
  }

  const url = new URL(`${API_BASE}/organisations/search`);
  if (q) url.searchParams.set("query", q);
  if (params.countryCode) url.searchParams.set("countryCode", params.countryCode);
  if (params.registryId) url.searchParams.set("registryId", params.registryId);
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: key,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        items: [],
        configured: true,
        error: `Goodstack search failed (${res.status}) ${body.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const list = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.results)
        ? data.results
        : Array.isArray(data.organisations)
          ? data.organisations
          : [];

    const items = (list as Record<string, unknown>[]).map(mapOrganisation);

    return {
      items,
      totalResults:
        typeof data.totalResults === "number"
          ? data.totalResults
          : typeof data.total === "number"
            ? data.total
            : items.length,
      exhaustiveTotalResults: Boolean(data.exhaustiveTotalResults),
      nextCursor: (data.nextCursor as string) || null,
      configured: true,
      error: null,
    };
  } catch (err) {
    return {
      items: [],
      configured: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Retrieve a single organisation by Goodstack id (publishable or secret depending on endpoint policy).
 * Falls back gracefully when not configured.
 */
export async function retrieveOrganisation(
  organisationId: string,
): Promise<GoodstackOrganisation | null> {
  const key = publishableKey();
  const id = (organisationId || "").trim();
  if (!key.startsWith("pk_") || !id) return null;

  try {
    const res = await fetch(`${API_BASE}/organisations/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: key,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const doc = (data.data as Record<string, unknown>) || data;
    return mapOrganisation(doc);
  } catch {
    return null;
  }
}

/**
 * Monetary donation sessions require the secret key on the server.
 * Call an Appwrite Function / backend route that wraps:
 *   POST https://api.goodstack.io/v1/donation-sessions
 */
export type CreateDonationSessionRequest = {
  organisationId: string;
  successUrl?: string;
  cancelUrl?: string;
  language?: string;
  metadata?: Record<string, string>;
};

export type CreateDonationSessionResult = {
  ok: boolean;
  url?: string;
  sessionId?: string;
  error?: string;
};

/**
 * Placeholder client → platform backend. Replace `endpoint` when Function is deployed.
 */
export async function requestDonationSession(
  body: CreateDonationSessionRequest,
  endpoint = "/api/goodstack/donation-session",
): Promise<CreateDonationSessionResult> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      url: String(data.url || data.donationUrl || ""),
      sessionId: data.id ? String(data.id) : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** UI helper for badges */
export function verificationBadgeLabel(
  status: GoodstackVerificationStatus,
  lang: "en" | "ar" = "en",
): string {
  if (status === "verified") {
    return lang === "ar" ? "موثّق عبر Goodstack" : "Goodstack Verified";
  }
  if (status === "pending") {
    return lang === "ar" ? "تحقق قيد المراجعة" : "Verification pending";
  }
  if (status === "rejected") {
    return lang === "ar" ? "لم يُعتمد" : "Not verified";
  }
  return lang === "ar" ? "غير مربوط" : "Not linked";
}
