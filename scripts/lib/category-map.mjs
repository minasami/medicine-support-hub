/**
 * Curated EgyptDwa → platform category resolver.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAP_PATH = path.join(__dirname, "../data/egyptdwa-category-map.json");

let _cache = null;

function loadMap() {
  if (_cache) return _cache;
  if (!fs.existsSync(MAP_PATH)) {
    _cache = { version: 0, map: {}, overrides_by_name_token: {}, default: { slug: "general", en: "General", ar: "عام" } };
    return _cache;
  }
  _cache = JSON.parse(fs.readFileSync(MAP_PATH, "utf8"));
  return _cache;
}

function normKey(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u0623\u0625\u0622]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0629/g, "\u0647")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Resolve category from EgyptDwa product fields.
 * Priority: name-token override → exact map → partial map key → default.
 * @returns {{ slug, en, ar, source }}
 */
export function resolveCategory(product) {
  const cfg = loadMap();
  const name = String(
    product?.display_name || product?.name_en || product?.name_ar || "",
  ).toLowerCase();
  const rawCat = String(product?.category || product?.category_ar || "").trim();

  // 1) Brand / INN token overrides (fixes mislabeled source categories)
  const overrides = cfg.overrides_by_name_token || {};
  for (const [token, cat] of Object.entries(overrides)) {
    if (token && name.includes(token.toLowerCase())) {
      return { ...cat, source: `override:${token}` };
    }
  }

  // 2) Exact category title
  const map = cfg.map || {};
  if (rawCat && map[rawCat]) {
    return { ...map[rawCat], source: "exact" };
  }

  // 3) Normalized / partial key match
  const nk = normKey(rawCat);
  if (nk) {
    for (const [k, cat] of Object.entries(map)) {
      if (normKey(k) === nk) return { ...cat, source: "norm_exact" };
    }
    for (const [k, cat] of Object.entries(map)) {
      const kk = normKey(k);
      if (kk && (nk.includes(kk) || kk.includes(nk))) {
        return { ...cat, source: "partial" };
      }
    }
  }

  // 4) Fallback: keep original Arabic title as ar, generic slug
  if (rawCat) {
    return {
      slug: "uncategorized",
      en: rawCat,
      ar: rawCat,
      source: "passthrough",
    };
  }
  return { ...(cfg.default || { slug: "general", en: "General", ar: "عام" }), source: "default" };
}

export function applyCategoryMap(product) {
  const resolved = resolveCategory(product);
  return {
    ...product,
    category: resolved.en,
    category_ar: resolved.ar,
    category_slug: resolved.slug,
    category_map_source: resolved.source,
  };
}
