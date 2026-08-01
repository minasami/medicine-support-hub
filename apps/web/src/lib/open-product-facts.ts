/**
 * Open *Facts barcode enrichment (Open Product Facts / Food / Beauty).
 * Public read API — no key required. Used as last-resort barcode metadata
 * when Appwrite + static encyclopedia miss the code.
 *
 * Docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
 * Hosts:
 *   https://world.openproductsfacts.org
 *   https://world.openfoodfacts.org
 *   https://world.openbeautyfacts.org
 */

export type OpenFactsProduct = {
  code: string;
  product_name?: string;
  product_name_en?: string;
  product_name_ar?: string;
  brands?: string;
  categories?: string;
  image_url?: string;
  image_front_url?: string;
  quantity?: string;
  product_type?: string;
  source: "openproductsfacts" | "openfoodfacts" | "openbeautyfacts";
};

const HOSTS: {
  host: string;
  source: OpenFactsProduct["source"];
}[] = [
  { host: "https://world.openproductsfacts.org", source: "openproductsfacts" },
  { host: "https://world.openbeautyfacts.org", source: "openbeautyfacts" },
  { host: "https://world.openfoodfacts.org", source: "openfoodfacts" },
];

function digits(code: string): string {
  return String(code || "").replace(/\D/g, "");
}

async function fetchHost(
  host: string,
  source: OpenFactsProduct["source"],
  code: string,
): Promise<OpenFactsProduct | null> {
  const url = `${host}/api/v2/product/${encodeURIComponent(code)}.json`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        // Identify the app per Open Food Facts API etiquette
        "User-Agent":
          "MedicineSupportHub/1.0 (https://medicinesupport.app; barcode-lookup)",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.status !== 1 || !data?.product) return null;
    const p = data.product;
    const name =
      p.product_name_en ||
      p.product_name ||
      p.generic_name_en ||
      p.generic_name ||
      "";
    if (!name && !p.brands) return null;
    return {
      code,
      product_name: name || p.brands,
      product_name_en: p.product_name_en || name,
      product_name_ar: p.product_name_ar || undefined,
      brands: p.brands || undefined,
      categories: p.categories || undefined,
      image_url: p.image_url || p.image_front_url || undefined,
      image_front_url: p.image_front_url || undefined,
      quantity: p.quantity || undefined,
      product_type: p.product_type || source.replace("open", "").replace("facts", ""),
      source,
    };
  } catch {
    return null;
  }
}

/**
 * Look up a barcode across Open Product / Beauty / Food Facts.
 * Stops at the first successful product hit.
 */
export async function lookupOpenProductFacts(
  rawBarcode: string,
): Promise<OpenFactsProduct | null> {
  const code = digits(rawBarcode);
  if (code.length < 8) return null;

  for (const { host, source } of HOSTS) {
    const hit = await fetchHost(host, source, code);
    if (hit) return hit;
  }
  return null;
}
