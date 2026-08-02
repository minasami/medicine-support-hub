/**
 * Gemma 4 via Google AI (Gemini API host).
 * Models: gemma-4-e2b-it | gemma-4-e4b-it | gemma-4-26b-a4b-it | gemma-4-31b-it
 * Docs: https://ai.google.dev/gemma/docs/core
 *
 * Set VITE_GOOGLE_AI_API_KEY (AI Studio key). Never commit real keys.
 * Responses are educational only — not a substitute for a pharmacist/physician.
 */

export type GemmaModelId =
  | "gemma-4-e2b-it"
  | "gemma-4-e4b-it"
  | "gemma-4-26b-a4b-it"
  | "gemma-4-31b-it";

const DEFAULT_MODEL: GemmaModelId = "gemma-4-26b-a4b-it";

const SYSTEM = `You are a careful medicines-information assistant for Medicine Support Hub (Egypt).
Rules:
- Educational only; never diagnose or prescribe.
- Prefer concise Arabic + English when helpful.
- If data is incomplete, say what is missing.
- Do not invent regulatory (EDA) status or prices.`;

function apiKey(): string | null {
  const k = import.meta.env.VITE_GOOGLE_AI_API_KEY as string | undefined;
  return k && k.trim() ? k.trim() : null;
}

export function isGemmaConfigured(): boolean {
  return !!apiKey();
}

export async function gemmaGenerate(options: {
  prompt: string;
  model?: GemmaModelId;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const key = apiKey();
  if (!key) {
    throw new Error(
      "Gemma 4 is not configured. Set VITE_GOOGLE_AI_API_KEY from Google AI Studio.",
    );
  }

  const model = options.model || DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxOutputTokens ?? 512,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Gemma API ${res.status}: ${errText.slice(0, 200) || res.statusText}`,
    );
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || "")
      .join("") || "";
  if (!text.trim()) throw new Error("Gemma returned an empty response.");
  return text.trim();
}

/** Short patient-facing brief after barcode / encyclopedia hit. */
export async function gemmaProductBrief(input: {
  name_en: string;
  name_ar?: string;
  manufacturer?: string;
  barcode?: string;
  product_type?: string;
  price_egp?: number | null;
}): Promise<string> {
  const prompt = `Given this pack identification, write a short (max 120 words) neutral product brief for a patient in Egypt.
Name (EN): ${input.name_en}
Name (AR): ${input.name_ar || "—"}
Manufacturer: ${input.manufacturer || "—"}
Barcode: ${input.barcode || "—"}
Type: ${input.product_type || "—"}
Listed price (EGP, may be retail snapshot): ${input.price_egp ?? "—"}
Include: what the name suggests the product is for (if clear), remind to read the leaflet and ask a pharmacist, and that price may vary.`;

  return gemmaGenerate({
    prompt,
    model: "gemma-4-26b-a4b-it",
    maxOutputTokens: 320,
  });
}
