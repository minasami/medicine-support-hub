/**
 * Session-scoped enrichment overlays applied from the federated panel.
 * Stored in localStorage so apply works without an immediate Appwrite write
 * (admin/company write-back can be layered later).
 */

const KEY = "msh_session_medicine_enrichment_v1";

export type SessionEnrichmentPatch = {
  scientific_name?: string;
  drug_class?: string;
  indications?: string;
  manufacturer?: string;
  image_url?: string;
  who_essential?: boolean;
  rxcui?: string;
  pubchem_cid?: string;
  provenance?: Record<string, string>;
  applied_at?: string;
};

type Store = Record<string, SessionEnrichmentPatch>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

function productKey(product: {
  id?: string | null;
  canonical_id?: number | string | null;
  name_en?: string | null;
}): string {
  if (product.id) return `id:${product.id}`;
  if (product.canonical_id != null && product.canonical_id !== "")
    return `cid:${product.canonical_id}`;
  const n = (product.name_en || "").trim().toLowerCase();
  return n ? `name:${n}` : "unknown";
}

export function getSessionEnrichment(product: {
  id?: string | null;
  canonical_id?: number | string | null;
  name_en?: string | null;
}): SessionEnrichmentPatch | null {
  if (typeof window === "undefined") return null;
  const store = readStore();
  return store[productKey(product)] || null;
}

export function applySessionEnrichment(
  product: {
    id?: string | null;
    canonical_id?: number | string | null;
    name_en?: string | null;
  },
  patch: SessionEnrichmentPatch,
): SessionEnrichmentPatch {
  const store = readStore();
  const key = productKey(product);
  const next: SessionEnrichmentPatch = {
    ...(store[key] || {}),
    ...patch,
    provenance: {
      ...(store[key]?.provenance || {}),
      ...(patch.provenance || {}),
    },
    applied_at: new Date().toISOString(),
  };
  store[key] = next;
  writeStore(store);
  return next;
}

export function mergeProductWithSession<T extends Record<string, unknown>>(product: T): T {
  const overlay = getSessionEnrichment({
    id: product.id != null ? String(product.id) : null,
    canonical_id:
      product.canonical_id != null
        ? (product.canonical_id as number | string)
        : null,
    name_en: product.name_en != null ? String(product.name_en) : null,
  });
  if (!overlay) return product;
  const out = { ...product } as T;
  for (const k of [
    "scientific_name",
    "drug_class",
    "indications",
    "manufacturer",
    "image_url",
  ] as const) {
    const cur = out[k as keyof T];
    const empty =
      cur == null || (typeof cur === "string" && !String(cur).trim());
    const next = overlay[k];
    if (empty && next != null && next !== "") {
      (out as any)[k] = next;
    }
  }
  if (overlay.who_essential) (out as any).who_essential = true;
  return out;
}
