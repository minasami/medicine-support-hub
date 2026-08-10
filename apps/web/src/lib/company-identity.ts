/**
 * Canonical company identity for Egyptian pharma labels.
 * Merges spelling variants (Med-Care, Medcare, Med care) under one company.
 *
 * Use resolveCompanyIdentity() before portfolio filters, facets, and display.
 */

import { normalizeCompanyName } from "@/lib/search-engine";

export type CanonicalCompany = {
  /** Stable machine id */
  id: string;
  /** URL / storage slug */
  slug: string;
  /** Preferred UI label */
  displayName: string;
  /** Normalized keys that map to this company */
  keys: string[];
  /** Optional regex aliases (raw text, case-insensitive) */
  patterns?: RegExp[];
};

/**
 * Curated registry — add major Egyptian groups + known orthography variants.
 * keys are outputs of normalizeCompanyName (lowercase alphanumeric, no spaces).
 */
export const CANONICAL_COMPANIES: CanonicalCompany[] = [
  {
    id: "med-care",
    slug: "med-care",
    displayName: "Med-Care",
    keys: [
      "medcare",
      "medcareegypt",
      "medcarepharma",
      "medcarepharmaceuticals",
      "medcarefactory",
      "medcaretoll",
    ],
    patterns: [
      /\bmed[\s.\-_/]*care\b/i,
      /\bmedcare\b/i,
    ],
  },
  {
    id: "soul-pharma",
    slug: "soul-pharma",
    displayName: "Soul Pharma",
    keys: [
      "soul",
      "soulpharma",
      "soulpharmaceuticals",
      "soulpharmaegypt",
    ],
    patterns: [/\bsoul[\s.\-_/]*pharma\b/i, /\bsoulpharma\b/i],
  },
  {
    id: "smartec",
    slug: "smartec",
    displayName: "Smartec",
    keys: ["smartec", "smartecpharma", "smartecpharmaceuticals"],
    patterns: [/\bsmartec\b/i],
  },
  {
    id: "eva-pharma",
    slug: "eva-pharma",
    displayName: "Eva Pharma",
    keys: ["eva", "evapharma", "evapharmaceuticals", "evaegypt"],
    patterns: [/\beva[\s.\-_/]*pharma\b/i, /\beva\s*pharma\b/i],
  },
  {
    id: "pharco",
    slug: "pharco",
    displayName: "Pharco",
    keys: ["pharco", "pharcopharma", "pharcopharmaceuticals", "pharcogroup"],
    patterns: [/\bpharco\b/i],
  },
  {
    id: "amoun",
    slug: "amoun",
    displayName: "Amoun",
    keys: ["amoun", "amounpharma", "amounpharmaceutical"],
    patterns: [/\bamoun\b/i],
  },
  {
    id: "hikma",
    slug: "hikma",
    displayName: "Hikma",
    keys: ["hikma", "hikmapharma", "hikmapharmaceuticals"],
    patterns: [/\bhikma\b/i],
  },
  {
    id: "gsk",
    slug: "gsk",
    displayName: "GSK",
    keys: ["gsk", "glaxosmithkline", "glaxo"],
    patterns: [/\bgsk\b/i, /glaxo\s*smith\s*kline/i],
  },
  {
    id: "sanofi",
    slug: "sanofi",
    displayName: "Sanofi",
    keys: ["sanofi", "sanofiegypt", "aventis"],
    patterns: [/\bsanofi\b/i],
  },
  {
    id: "novartis",
    slug: "novartis",
    displayName: "Novartis",
    keys: ["novartis", "sandoz"],
    patterns: [/\bnovartis\b/i],
  },
  {
    id: "pfizer",
    slug: "pfizer",
    displayName: "Pfizer",
    keys: ["pfizer", "pfizeregypt"],
    patterns: [/\bpfizer\b/i],
  },
  {
    id: "abbott",
    slug: "abbott",
    displayName: "Abbott",
    keys: ["abbott", "abbottegypt"],
    patterns: [/\babbott\b/i],
  },
];

const KEY_TO_COMPANY = new Map<string, CanonicalCompany>();
for (const c of CANONICAL_COMPANIES) {
  for (const k of c.keys) {
    KEY_TO_COMPANY.set(k, c);
  }
  KEY_TO_COMPANY.set(c.id.replace(/-/g, ""), c);
  KEY_TO_COMPANY.set(normalizeCompanyName(c.displayName), c);
  KEY_TO_COMPANY.set(normalizeCompanyName(c.slug.replace(/-/g, " ")), c);
}

export type ResolvedCompany = {
  id: string;
  slug: string;
  displayName: string;
  /** Original raw fragment matched */
  raw: string;
  /** true when matched a known canonical entry */
  known: boolean;
};

/**
 * Collapse whitespace / punctuation variants without destroying meaning.
 * "Med-Care" | "Med care" | "Medcare" → comparable form.
 */
export function softNormalizeCompanyLabel(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[._/,|•·]+/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve any manufacturer / company string to a canonical identity when known.
 * Dual labels ("SMARTEC > SOULPHARMA") should be split first, then each part resolved.
 */
export function resolveCompanyIdentity(
  raw: string | null | undefined,
): ResolvedCompany {
  const original = String(raw || "").trim();
  if (!original) {
    return {
      id: "",
      slug: "",
      displayName: "",
      raw: "",
      known: false,
    };
  }

  const soft = softNormalizeCompanyLabel(original);
  const key = normalizeCompanyName(original);

  // 1) Direct key map
  const byKey = KEY_TO_COMPANY.get(key);
  if (byKey) {
    return {
      id: byKey.id,
      slug: byKey.slug,
      displayName: byKey.displayName,
      raw: original,
      known: true,
    };
  }

  // 2) Soft label contains registry key as whole token
  for (const c of CANONICAL_COMPANIES) {
    for (const k of c.keys) {
      // med care vs medcare
      const softKey = k.replace(/([a-z])([a-z]+)/, "$1 $2"); // weak
      if (key === k || key.includes(k) && k.length >= 4) {
        // Prefer longer key matches to avoid "eva" false positives inside other words
        if (k.length >= 4 || key === k) {
          return {
            id: c.id,
            slug: c.slug,
            displayName: c.displayName,
            raw: original,
            known: true,
          };
        }
      }
    }
    if (c.patterns) {
      for (const re of c.patterns) {
        if (re.test(original) || re.test(soft)) {
          return {
            id: c.id,
            slug: c.slug,
            displayName: c.displayName,
            raw: original,
            known: true,
          };
        }
      }
    }
  }

  // 3) Unknown — still produce a stable slug from soft label
  const slug = soft
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, "-")
    .replace(/^-|-$/g, "") || "company";

  return {
    id: slug,
    slug,
    displayName: original.replace(/\s+/g, " ").trim(),
    raw: original,
    known: false,
  };
}

/** True when two labels refer to the same canonical company. */
export function companiesEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ra = resolveCompanyIdentity(a);
  const rb = resolveCompanyIdentity(b);
  if (!ra.id || !rb.id) return false;
  if (ra.known && rb.known) return ra.id === rb.id;
  if (ra.id === rb.id) return true;
  // fallback: normalized key equality
  return (
    normalizeCompanyName(String(a || "")) ===
    normalizeCompanyName(String(b || ""))
  );
}

/** Display name: prefer canonical when known. */
export function displayCompanyName(raw: string | null | undefined): string {
  const r = resolveCompanyIdentity(raw);
  return r.known ? r.displayName : String(raw || "").trim();
}

/**
 * Resolve every party in a dual manufacturer string.
 * "SMARTEC > SOULPHARMA" → [Smartec, Soul Pharma]
 */
export function resolveManufacturerParties(
  raw: string | null | undefined,
): ResolvedCompany[] {
  const s = String(raw || "").trim();
  if (!s) return [];
  const parts = s
    .split(/\s*[>\/|•·]+\s*|\s*[()]\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
  const list = parts.length > 1 ? parts : [s];
  const out: ResolvedCompany[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    const r = resolveCompanyIdentity(p);
    const k = r.id || r.displayName.toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** True if product manufacturer parties include this company. */
export function manufacturerIncludesCompany(
  manufacturer: string | null | undefined,
  companySlugOrName: string,
): boolean {
  const target = resolveCompanyIdentity(companySlugOrName);
  if (!target.id) return false;
  const parties = resolveManufacturerParties(manufacturer);
  return parties.some((p) => p.id === target.id || companiesEquivalent(p.raw, target.displayName));
}
