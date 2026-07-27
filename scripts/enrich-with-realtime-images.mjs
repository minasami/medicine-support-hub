process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { promises as fs } from "node:fs";
import path from "node:path";

const apiKey = "ak_3bis7w01t48d1dblvj732ocy9g8itm7sxi27rdb88j7udmw";

const FORMULAS_TO_SEARCH = [
  { id: "hero-baby-1", query: "Hero Baby 1 Nutrasense milk 400g Egypt pharmacy" },
  { id: "hero-baby-2", query: "Hero Baby 2 follow up milk 400g Egypt pharmacy" },
  { id: "hero-baby-lf", query: "Hero Baby LF lactose free 400g Egypt pharmacy" },
  { id: "hero-baby-ar", query: "Hero Baby AR anti reflux 400g Egypt pharmacy" },
  { id: "bebelac-1", query: "Bebelac 1 infant milk 400g Egypt" },
  { id: "bebelac-2", query: "Bebelac 2 follow up milk 400g Egypt" },
  { id: "bebelac-lf", query: "Bebelac LF lactose free 400g Egypt" },
  { id: "bebelac-ar", query: "Bebelac Extra Care AR 400g Egypt" },
  { id: "bebelac-ec", query: "Bebelac Extra Care EC 400g Egypt" },
  { id: "nan-optipro-1", query: "NAN OPTIPRO 1 Nestlé 400g Egypt" },
  { id: "nan-optipro-2", query: "NAN OPTIPRO 2 Nestlé 400g Egypt" },
  { id: "nan-lf", query: "NAN AL 110 LF lactose free Nestlé 400g Egypt" },
  { id: "nan-ar", query: "NAN AR anti reflux Nestlé 400g Egypt" },
  { id: "aptamil-1", query: "Aptamil Advance 1 milk 400g Egypt" },
  { id: "aptamil-lf", query: "Aptamil LF lactose free 400g Egypt" },
  { id: "novalac-1", query: "Novalac 1 infant milk 400g Egypt" },
  { id: "novalac-ar", query: "Novalac AR anti reflux 400g Egypt" },
  { id: "similac-gold-1", query: "Similac Gold 1 HMO 400g Egypt" },
  { id: "similac-total-comfort", query: "Similac Total Comfort 400g Egypt" },
];

async function fetchRealImage(query) {
  console.log(`[RealtimeSearch] Querying Google Images for: "${query}"...`);
  const params = new URLSearchParams({ query, limit: "3" });
  try {
    const res = await fetch(`https://api.openwebninja.com/realtime-image-search/search?${params}`, {
      headers: { "X-API-Key": apiKey }
    });
    if (!res.ok) {
      console.error(`Failed ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const items = data.data || [];
    for (const item of items) {
      const url = item.thumbnail_url || item.url;
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        return url;
      }
    }
  } catch (err) {
    console.error(`Exception searching "${query}":`, err.message);
  }
  return null;
}

async function runEnrichment() {
  const imageMap = {};

  for (const item of FORMULAS_TO_SEARCH) {
    const imageUrl = await fetchRealImage(item.query);
    if (imageUrl) {
      imageMap[item.id] = imageUrl;
      console.log(`✓ Mapped ${item.id} ➔ ${imageUrl}`);
    }
  }

  console.log("\n[Enrichment Result] Map of authentic formula canister photos:");
  console.log(JSON.stringify(imageMap, null, 2));

  // Update baby-formulas-data.ts with these exact authentic photo URLs
  const dataPath = path.join(process.cwd(), "apps/web/src/data/baby-formulas-data.ts");
  let content = await fs.readFile(dataPath, "utf8");

  for (const [id, url] of Object.entries(imageMap)) {
    const regex = new RegExp(`(id:\\s*"${id}"[\\s\\S]*?image_url:\\s*)"[^"]+"`, "m");
    content = content.replace(regex, `$1"${url}"`);
  }

  await fs.writeFile(dataPath, content, "utf8");
  console.log("\n✓ Updated apps/web/src/data/baby-formulas-data.ts with real Google Images formula canister packaging photos!");
}

runEnrichment();
