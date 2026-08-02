/**
 * Draft autosave for "Talk to the Founder" requests.
 *
 * - Debounced localStorage writes
 * - Schema version + field validation
 * - Expires after DRAFT_TTL_MS
 * - Clears when empty or after successful submit
 * - Cross-tab sync via `storage` events
 */

export type FounderLeadDraftFields = {
  contact_name: string;
  email: string;
  phone: string;
  organization_name: string;
  organization_type: string;
  lead_type: string;
  country: string;
  beneficiaries_estimate: string;
  message: string;
};

type DraftEnvelope = {
  v: number;
  updatedAt: number;
  fields: FounderLeadDraftFields;
};

export const FOUNDER_DRAFT_KEY = "msh_founder_lead_draft_v2";
const LEGACY_DRAFT_KEY = "msh_founder_lead_draft_v1";
const DRAFT_VERSION = 2;
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEBOUNCE_MS = 400;

const DEFAULT_FIELDS = (): FounderLeadDraftFields => ({
  contact_name: "",
  email: "",
  phone: "",
  organization_name: "",
  organization_type: "ngo",
  lead_type: "partnership",
  country: "",
  beneficiaries_estimate: "",
  message: "",
});

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function asString(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  return String(value);
}

function sanitizeFields(
  input: Partial<FounderLeadDraftFields> | Record<string, unknown> | null | undefined,
): FounderLeadDraftFields {
  const base = DEFAULT_FIELDS();
  if (!input || typeof input !== "object") return base;
  return {
    contact_name: asString(input.contact_name).slice(0, 200),
    email: asString(input.email).slice(0, 320),
    phone: asString(input.phone).slice(0, 40),
    organization_name: asString(input.organization_name).slice(0, 200),
    organization_type: asString(input.organization_type, "ngo").slice(0, 64),
    lead_type: asString(input.lead_type, "partnership").slice(0, 64),
    country: asString(input.country).slice(0, 80),
    beneficiaries_estimate: asString(input.beneficiaries_estimate).slice(0, 20),
    message: asString(input.message).slice(0, 4000),
  };
}

/** True if the user typed anything worth keeping. */
export function isMeaningfulDraft(fields: FounderLeadDraftFields): boolean {
  return Boolean(
    fields.contact_name.trim() ||
      fields.email.trim() ||
      fields.phone.trim() ||
      fields.organization_name.trim() ||
      fields.country.trim() ||
      fields.message.trim() ||
      fields.beneficiaries_estimate.trim() ||
      (fields.lead_type && fields.lead_type !== "partnership") ||
      (fields.organization_type && fields.organization_type !== "ngo"),
  );
}

function parseEnvelope(raw: string | null): DraftEnvelope | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;

    // v2 envelope
    const env = data as DraftEnvelope;
    if (env.v === DRAFT_VERSION && env.fields && typeof env.updatedAt === "number") {
      if (Date.now() - env.updatedAt > DRAFT_TTL_MS) return null;
      return {
        v: DRAFT_VERSION,
        updatedAt: env.updatedAt,
        fields: sanitizeFields(env.fields),
      };
    }

    // legacy v1: flat payload fields
    const legacy = data as Record<string, unknown>;
    if (legacy.contact_name != null || legacy.email != null || legacy.message != null) {
      return {
        v: DRAFT_VERSION,
        updatedAt: Date.now(),
        fields: sanitizeFields({
          contact_name: asString(legacy.contact_name),
          email: asString(legacy.email),
          phone: asString(legacy.phone),
          organization_name: asString(legacy.organization_name),
          organization_type: asString(legacy.organization_type, "ngo"),
          lead_type: asString(legacy.lead_type, "partnership"),
          country: asString(legacy.country),
          beneficiaries_estimate:
            legacy.beneficiaries_estimate != null
              ? String(legacy.beneficiaries_estimate)
              : "",
          message: asString(legacy.message),
        }),
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function loadFounderDraft(): FounderLeadDraftFields | null {
  if (!isBrowser()) return null;
  try {
    const primary = parseEnvelope(localStorage.getItem(FOUNDER_DRAFT_KEY));
    if (primary && isMeaningfulDraft(primary.fields)) {
      return primary.fields;
    }
    // migrate legacy key once
    const legacy = parseEnvelope(localStorage.getItem(LEGACY_DRAFT_KEY));
    if (legacy && isMeaningfulDraft(legacy.fields)) {
      writeEnvelope(legacy.fields);
      try {
        localStorage.removeItem(LEGACY_DRAFT_KEY);
      } catch {
        /* ignore */
      }
      return legacy.fields;
    }
  } catch {
    return null;
  }
  return null;
}

function writeEnvelope(fields: FounderLeadDraftFields): void {
  if (!isBrowser()) return;
  const envelope: DraftEnvelope = {
    v: DRAFT_VERSION,
    updatedAt: Date.now(),
    fields: sanitizeFields(fields),
  };
  localStorage.setItem(FOUNDER_DRAFT_KEY, JSON.stringify(envelope));
}

export function clearFounderDraft(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(FOUNDER_DRAFT_KEY);
    localStorage.removeItem(LEGACY_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

/** Immediate write (no debounce) — used on blur / beforeunload / submit path. */
export function flushFounderDraft(fields: FounderLeadDraftFields): void {
  if (!isBrowser()) return;
  try {
    if (!isMeaningfulDraft(fields)) {
      clearFounderDraft();
      return;
    }
    writeEnvelope(fields);
  } catch {
    /* quota / private mode */
  }
}

type DebouncedSaver = {
  save: (fields: FounderLeadDraftFields) => void;
  flush: (fields?: FounderLeadDraftFields) => void;
  cancel: () => void;
};

/**
 * Create a debounced saver instance (one per component mount).
 */
export function createDebouncedDraftSaver(delayMs = DEBOUNCE_MS): DebouncedSaver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: FounderLeadDraftFields | null = null;

  const flush = (fields?: FounderLeadDraftFields) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const next = fields ?? pending;
    pending = null;
    if (next) flushFounderDraft(next);
  };

  const save = (fields: FounderLeadDraftFields) => {
    pending = fields;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (pending) {
        flushFounderDraft(pending);
        pending = null;
      }
    }, delayMs);
  };

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
  };

  return { save, flush, cancel };
}

export type DraftListener = (fields: FounderLeadDraftFields | null) => void;

/** Subscribe to draft changes from other tabs. */
export function subscribeFounderDraft(listener: DraftListener): () => void {
  if (!isBrowser()) return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key !== FOUNDER_DRAFT_KEY && event.key !== LEGACY_DRAFT_KEY) return;
    if (event.newValue == null) {
      listener(null);
      return;
    }
    const env = parseEnvelope(event.newValue);
    listener(env && isMeaningfulDraft(env.fields) ? env.fields : null);
  };

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function getFounderDraftMeta(): { updatedAt: number | null; hasDraft: boolean } {
  if (!isBrowser()) return { updatedAt: null, hasDraft: false };
  try {
    const env = parseEnvelope(localStorage.getItem(FOUNDER_DRAFT_KEY));
    if (!env || !isMeaningfulDraft(env.fields)) {
      return { updatedAt: null, hasDraft: false };
    }
    return { updatedAt: env.updatedAt, hasDraft: true };
  } catch {
    return { updatedAt: null, hasDraft: false };
  }
}
