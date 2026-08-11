/**
 * Resolve a packshot candidate from Open Product Facts when barcode is known.
 * Never treated as company-verified until reviewed.
 */

import { lookupOpenProductFacts } from "./open-product-facts";

export type PackshotCandidate = {
  image_url: string;
  product_name?: string;
  brands?: string;
  source: string;
  barcode: string;
};

export async function resolvePackshotFromBarcode(
  barcode: string | null | undefined,
): Promise<PackshotCandidate | null> {
  const code = String(barcode || "").replace(/\D/g, "");
  if (code.length < 8) return null;
  const hit = await lookupOpenProductFacts(code);
  if (!hit) return null;
  const image = hit.image_front_url || hit.image_url;
  if (!image) return null;
  return {
    image_url: image,
    product_name: hit.product_name_en || hit.product_name,
    brands: hit.brands,
    source: hit.source,
    barcode: code,
  };
}
