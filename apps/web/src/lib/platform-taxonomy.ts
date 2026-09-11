/**
 * Platform taxonomy (active learning / crowdsourced catalog enrichment).
 *
 * Global picker values (dosage_form, route, category, drug_class, ingredient,
 * strength, product_line) live in Appwrite collection `platform_taxonomy`.
 * User "+ Add new" writes here so other sessions can read the value on next load.
 *
 * See docs/PLATFORM_TAXONOMY_ACTIVE_LEARNING.md
 */

import { Client, Databases, ID, Permission, Query, Role } from "appwrite";

const ENDPOINT =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_ENDPOINT) ||
  "https://fra.cloud.appwrite.io/v1";
const PROJECT_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_PROJECT_ID) ||
  "6a54ac3a00272c02d6e0";
const DATABASE_ID =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_DATABASE_ID) ||
  "medicine_support_hub";
const COLLECTION_ID = "platform_taxonomy";
const MEDICINES_COLLECTION =
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.VITE_APPWRITE_MEDICINES_COLLECTION_ID) ||
  "medicines";

export type TaxonomyKind =
  | "dosage_form"
  | "route"
  | "category"
  | "drug_class"
  | "ingredient"
  | "strength"
  | "product_line";

export type TaxonomyOption = {
  label: string;
  value: string;
  meta?: string;
};

const OVERLAY_KEY = "msh_platform_taxonomy_overlay_v1";
const LIST_CACHE_TTL_MS = 5 * 60 * 1000;

type OverlayStore = Record<string, Record<string, string>>; // kind -> value_key -> value

const memoryLists = new Map<TaxonomyKind, { at: number; options: TaxonomyOption[] }>();
const inFlight = new Map<TaxonomyKind, Promise<TaxonomyOption[]>>();

function getDatabases(): Databases | null {
  try {
    if (!PROJECT_ID) return null;
    const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID);
    return new Databases(client);
  } catch {
    return null;
  }
}

export function normalizeTaxonomyKey(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function readOverlay(): OverlayStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeOverlay(store: OverlayStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function upsertOverlay(kind: TaxonomyKind, value: string) {
  const key = normalizeTaxonomyKey(value);
  if (!key) return;
  const store = readOverlay();
  if (!store[kind]) store[kind] = {};
  if (!store[kind][key]) store[kind][key] = value.trim();
  writeOverlay(store);
}

function mergeOverlay(
  kind: TaxonomyKind,
  options: TaxonomyOption[],
): TaxonomyOption[] {
  const byKey = new Map<string, TaxonomyOption>();
  for (const opt of options) {
    const k = normalizeTaxonomyKey(opt.value);
    if (!k) continue;
    if (!byKey.has(k)) byKey.set(k, opt);
  }
  const overlay = readOverlay()[kind] || {};
  for (const [k, v] of Object.entries(overlay)) {
    if (!byKey.has(k)) byKey.set(k, { label: v, value: v });
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
  );
}

function bumpMemory(kind: TaxonomyKind, value: string) {
  const trimmed = value.trim();
  const key = normalizeTaxonomyKey(trimmed);
  if (!key) return;
  const prev = memoryLists.get(kind)?.options || [];
  if (prev.some((o) => normalizeTaxonomyKey(o.value) === key)) {
    memoryLists.set(kind, { at: Date.now(), options: prev });
    return;
  }
  memoryLists.set(kind, {
    at: Date.now(),
    options: [{ label: trimmed, value: trimmed }, ...prev],
  });
}

/**
 * Load global options for a taxonomy kind from Appwrite `platform_taxonomy`.
 * Merges local overlay so a just-added value appears before remote refresh.
 */
export async function loadTaxonomyOptions(
  kind: TaxonomyKind,
  opts?: { force?: boolean; limit?: number },
): Promise<TaxonomyOption[]> {
  const limit = opts?.limit ?? 2000;
  if (!opts?.force) {
    const cached = memoryLists.get(kind);
    if (cached && Date.now() - cached.at < LIST_CACHE_TTL_MS) {
      return mergeOverlay(kind, cached.options);
    }
    const pending = inFlight.get(kind);
    if (pending) return pending.then((o) => mergeOverlay(kind, o));
  }

  const task = (async () => {
    const db = getDatabases();
    const collected: TaxonomyOption[] = [];
    const seen = new Set<string>();

    if (db) {
      try {
        let cursor: string | undefined;
        let pages = 0;
        const maxPages = Math.ceil(limit / 100);
        while (pages < maxPages) {
          const queries = [
            Query.equal("kind", kind),
            Query.limit(100),
            Query.orderAsc("value"),
          ];
          if (cursor) queries.push(Query.cursorAfter(cursor));
          const res = await db.listDocuments(DATABASE_ID, COLLECTION_ID, queries);
          if (!res.documents.length) break;
          for (const doc of res.documents) {
            const value = String((doc as any).value || "").trim();
            const key = normalizeTaxonomyKey(
              String((doc as any).value_key || value),
            );
            if (!value || !key || seen.has(key)) continue;
            seen.add(key);
            collected.push({ label: value, value });
          }
          cursor = res.documents[res.documents.length - 1].$id;
          pages++;
          if (res.documents.length < 100) break;
        }
      } catch (err) {
        console.warn("[platform-taxonomy] list failed:", err);
      }
    }

    memoryLists.set(kind, { at: Date.now(), options: collected });
    return collected;
  })();

  inFlight.set(kind, task);
  try {
    const options = await task;
    return mergeOverlay(kind, options);
  } finally {
    inFlight.delete(kind);
  }
}

export type PersistTaxonomyResult = {
  ok: boolean;
  value: string;
  created: boolean;
  error?: string;
};

/**
 * Persist a user "+ Add new" value globally.
 * Immediately updates local overlay + memory so the current picker refreshes,
 * then writes to Appwrite so other users see it on next load.
 * Deduplicates case-insensitively via value_key (+ unique index).
 */
export async function persistTaxonomyValue(
  kind: TaxonomyKind,
  rawValue: string,
  actor?: { userId?: string | null; email?: string | null },
): Promise<PersistTaxonomyResult> {
  const value = String(rawValue || "").trim();
  const valueKey = normalizeTaxonomyKey(value);
  if (!value || !valueKey) {
    return { ok: false, value: "", created: false, error: "empty" };
  }
  if (value.length > 255) {
    return { ok: false, value, created: false, error: "too_long" };
  }

  upsertOverlay(kind, value);
  bumpMemory(kind, value);

  const db = getDatabases();
  if (!db) {
    return { ok: true, value, created: false, error: "no_client" };
  }

  const payload = {
    kind,
    value,
    value_key: valueKey,
    source: "user_add",
    created_by: String(actor?.userId || actor?.email || "anonymous").slice(0, 128),
    usage_count: 1,
  };

  try {
    // Prefer lookup by unique (kind, value_key) to avoid duplicate creates.
    const existing = await db.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal("kind", kind),
      Query.equal("value_key", valueKey),
      Query.limit(1),
    ]);
    if (existing.documents.length > 0) {
      const doc = existing.documents[0];
      try {
        await db.updateDocument(DATABASE_ID, COLLECTION_ID, doc.$id, {
          usage_count: Number((doc as any).usage_count || 1) + 1,
          value,
        });
      } catch {
        /* read-only role — still OK for UX */
      }
      memoryLists.delete(kind);
      return { ok: true, value, created: false };
    }

    await db.createDocument(
      DATABASE_ID,
      COLLECTION_ID,
      ID.unique(),
      payload,
      [Permission.read(Role.any()), Permission.update(Role.any())],
    );
    memoryLists.delete(kind);
    return { ok: true, value, created: true };
  } catch (err: any) {
    const msg = String(err?.message || err || "");
    if (err?.code === 409 || /already exists|unique/i.test(msg)) {
      memoryLists.delete(kind);
      return { ok: true, value, created: false };
    }
    console.warn("[platform-taxonomy] persist failed:", msg);
    return { ok: false, value, created: false, error: msg.slice(0, 200) };
  }
}

/**
 * Build scientific API options: taxonomy ingredients + drug_class hints from medicines.
 */
export async function loadScientificIngredientOptions(): Promise<
  { label: string; value: string; meta?: string; drugClasses: string[] }[]
> {
  const ingredients = await loadTaxonomyOptions("ingredient");

  const byName = new Map<
    string,
    { label: string; value: string; drugClasses: Set<string> }
  >();

  for (const ing of ingredients) {
    const key = normalizeTaxonomyKey(ing.value);
    if (!key) continue;
    byName.set(key, {
      label: ing.value,
      value: ing.value,
      drugClasses: new Set(),
    });
  }

  const db = getDatabases();
  if (db) {
    try {
      let cursor: string | undefined;
      for (let page = 0; page < 15; page++) {
        const queries = [
          Query.limit(100),
          Query.orderAsc("$id"),
          Query.isNotNull("scientific_name"),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        const res = await db.listDocuments(
          DATABASE_ID,
          MEDICINES_COLLECTION,
          queries,
        );
        if (!res.documents.length) break;
        for (const doc of res.documents) {
          const name = String((doc as any).scientific_name || "").trim();
          if (!name || /^active (pharmaceutical )?ingredient/i.test(name)) continue;
          const cls = String((doc as any).drug_class || "").trim();
          const key = normalizeTaxonomyKey(name);
          if (!byName.has(key)) {
            byName.set(key, {
              label: name,
              value: name,
              drugClasses: new Set(),
            });
          }
          if (cls && !/^therapeutic category$/i.test(cls)) {
            byName.get(key)!.drugClasses.add(cls);
          }
        }
        cursor = res.documents[res.documents.length - 1].$id;
        if (res.documents.length < 100) break;
      }
    } catch (err) {
      console.warn("[platform-taxonomy] medicines enrich failed:", err);
    }
  }

  return Array.from(byName.values())
    .map((row) => {
      const classList = Array.from(row.drugClasses);
      const isCombo = /[+\/&,;|]/.test(row.value) || row.value.length > 48;
      return {
        label: row.label,
        value: row.value,
        meta: classList[0]
          ? isCombo
            ? `Combination · ${classList[0]}`
            : classList[0]
          : isCombo
            ? "Combination API"
            : undefined,
        drugClasses: classList,
      };
    })
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
}

/** Invalidate in-memory caches (e.g. after bulk seed). */
export function invalidateTaxonomyCache(kind?: TaxonomyKind) {
  if (kind) {
    memoryLists.delete(kind);
    inFlight.delete(kind);
  } else {
    memoryLists.clear();
    inFlight.clear();
  }
}
