import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DISCLAIMER_AR, DISCLAIMER_EN, POPULAR, searchMedicines } from "./catalog.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(ROOT, "data", "price-snapshot.json");
const WATCHLIST_PATH = join(ROOT, "data", "price-watchlist.json");

export const ALERT_DISCLAIMER_EN =
  "Alerts compare Medicine Support Hub catalog snapshots only. They are not pharmacy quotes and not a guarantee a shelf price changed.";
export const ALERT_DISCLAIMER_AR =
  "التنبيهات تقارن لقطات كتالوج منصة دعم الدواء فقط. ليست عرض صيدلية ولا تأكيد أن سعر الرف تغيّر.";

export function loadWatchlist() {
  if (existsSync(WATCHLIST_PATH)) {
    return JSON.parse(readFileSync(WATCHLIST_PATH, "utf8"));
  }
  return {
    threshold_pct: 5,
    items: POPULAR.map((item) => ({ query: item.query })),
  };
}

export function loadSnapshot() {
  if (existsSync(SNAPSHOT_PATH)) {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  }
  return { observed_at: null, items: {} };
}

export function saveSnapshot(snapshot) {
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
}

export async function runPriceAlerts({ persist = false } = {}) {
  const watch = loadWatchlist();
  const previous = loadSnapshot();
  const threshold = Number(process.env.PRICE_ALERT_THRESHOLD_PCT || watch.threshold_pct || 5);
  const now = new Date().toISOString();
  const items = {};
  const rows = [];
  const alerts = [];

  for (const item of watch.items || []) {
    const query = String(item.query || "").trim();
    if (!query) continue;
    const hits = await searchMedicines(query, 1);
    const product = hits[0] || null;
    const price = product?.current_price_egp ?? null;
    const key = String(product?.canonical_id || query);
    const current = {
      query,
      canonical_id: product?.canonical_id || null,
      name_en: product?.name_en || null,
      name_ar: product?.name_ar || null,
      manufacturer: product?.manufacturer || null,
      price_egp: price,
      url: product?.url || null,
      observed_at: now,
    };
    items[key] = current;
    const prev = previous.items?.[key] || previous.items?.[query];
    const prevPrice = prev?.price_egp ?? null;
    let change_pct = null;
    if (price != null && prevPrice != null && prevPrice > 0) {
      change_pct = Number((((price - prevPrice) / prevPrice) * 100).toFixed(2));
    }
    const fired = change_pct != null && Math.abs(change_pct) >= threshold;
    rows.push({ ...current, previous_egp: prevPrice, change_pct, alert: fired });
    if (fired) {
      alerts.push({
        query,
        name_en: current.name_en,
        name_ar: current.name_ar,
        from_egp: prevPrice,
        to_egp: price,
        change_pct,
        url: current.url,
      });
    }
  }

  const snapshot = { observed_at: now, threshold_pct: threshold, items };
  if (persist) saveSnapshot(snapshot);

  return {
    observed_at: now,
    threshold_pct: threshold,
    watch_count: (watch.items || []).length,
    alert_count: alerts.length,
    first_snapshot: !previous.observed_at,
    alerts,
    rows,
    disclaimer_en: ALERT_DISCLAIMER_EN,
    disclaimer_ar: ALERT_DISCLAIMER_AR,
    catalog_disclaimer_en: DISCLAIMER_EN,
    catalog_disclaimer_ar: DISCLAIMER_AR,
  };
}

export function listPriceWatchlist() {
  const watch = loadWatchlist();
  const snapshot = loadSnapshot();
  return {
    threshold_pct: watch.threshold_pct,
    items: watch.items,
    last_snapshot_at: snapshot.observed_at,
    tracked_keys: Object.keys(snapshot.items || {}).length,
    disclaimer_en: ALERT_DISCLAIMER_EN,
    disclaimer_ar: ALERT_DISCLAIMER_AR,
  };
}

async function notifyWebhook(result) {
  const url = process.env.PRICE_ALERT_WEBHOOK;
  if (!url || !result.alert_count) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  });
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  const persist = process.argv.includes("--write") || process.env.PRICE_ALERTS_WRITE === "1";
  const result = await runPriceAlerts({ persist });
  console.log(JSON.stringify(result, null, 2));
  await notifyWebhook(result).catch((err) => {
    console.error("webhook failed", err.message);
  });
  if (result.alert_count && process.env.PRICE_ALERTS_FAIL_ON_ALERT === "1") process.exit(2);
}
