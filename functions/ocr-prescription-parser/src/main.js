/**
 * OCR Prescription Parser (v2)
 *
 * Pipeline:
 *  1. Accept `{ text }` from on-device ML Kit (Capacitor) and/or optional `{ image }` /
 *     `image_base64` / `image_url` for server-side OCR.
 *     Prefer device text: ML Kit on Android/iOS is lower-latency and private;
 *     server OCR is a fallback when only an image is sent (Document AI / Vision —
 *     wire via GOOGLE_DOCUMENT_AI_* when available).
 *  2. Call Vertex AI MedGemma (or Gemini medical-capable) via VERTEX_* / GOOGLE_CLOUD_*.
 *     If credentials missing → structured stub JSON + log "MedGemma not configured".
 *  3. Prompt: licensed pharmacist AI → JSON array
 *     [{ drug_name, dose, frequency, duration, confidence }] AR/EN, map misspellings,
 *     lightly flag interactions.
 *  4. If any confidence < 0.8 → create `annotations` doc for RLAIF queue.
 *
 * Disclaimer (also shown in UI): "AI assistive only. Licensed pharmacist must verify."
 */

import { Client, Databases, ID } from "node-appwrite";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_ANN = process.env.ANNOTATIONS_COLLECTION_ID || "annotations";
const CONFIDENCE_THRESHOLD = Number(process.env.OCR_CONFIDENCE_THRESHOLD || 0.8);

const DISCLAIMER =
  "AI assistive only. Licensed pharmacist must verify.";

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-appwrite-project,x-appwrite-key",
  });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function medgemmaConfigured() {
  return Boolean(
    process.env.VERTEX_ACCESS_TOKEN ||
      process.env.GOOGLE_CLOUD_ACCESS_TOKEN ||
      (process.env.GOOGLE_CLOUD_PROJECT &&
        (process.env.GOOGLE_APPLICATION_CREDENTIALS ||
          process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
          process.env.VERTEX_SERVICE_ACCOUNT_JSON)),
  );
}

function getDb() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Databases(
    new Client().setEndpoint(endpoint).setProject(project).setKey(key),
  );
}

function buildPharmacistPrompt(rawText) {
  return `You are a licensed pharmacist AI assistant. Parse the prescription text below.
Return ONLY a JSON object with shape:
{
  "medicines": [
    { "drug_name": string, "dose": string, "frequency": string, "duration": string, "confidence": number }
  ],
  "interactions": [ { "pair": [string, string], "note": string, "severity": "low"|"moderate"|"high" } ],
  "language_hints": ["ar"|"en", ...]
}
Rules:
- Map common misspellings / handwriting OCR noise to likely Egyptian market drug names (AR/EN).
- confidence is 0..1 (use <0.8 when uncertain).
- Flag interactions lightly (do not alarm; note possible pairs only).
- Never invent controlled substances that are not suggested by the text.

PRESCRIPTION TEXT:
"""
${rawText.slice(0, 6000)}
"""`;
}

/** Heuristic stub parser when MedGemma is unavailable — still returns parseable JSON. */
function stubParse(rawText) {
  const lines = String(rawText || "")
    .split(/[\n\r;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  const medicines = [];
  for (const line of lines) {
    // rough: "Drug 500mg BID x7d" patterns
    const doseMatch = line.match(/(\d+\s?(?:mg|mcg|g|ml|%|IU|وحدة)?)/i);
    const freqMatch = line.match(/\b(od|bd|bid|tid|qid|once|twice|daily|يوميا|مرتين)\b/i);
    const durMatch = line.match(/(\d+\s?(?:d|day|days|يوم|أيام|أسبوع|weeks?))/i);
    const name = line
      .replace(doseMatch?.[0] || "", " ")
      .replace(freqMatch?.[0] || "", " ")
      .replace(durMatch?.[0] || "", " ")
      .replace(/[^\p{L}\p{N}\s\-_/]/gu, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);

    if (!name || name.length < 2) continue;

    // Lower confidence for stub / short noisy lines
    const confidence = name.length >= 4 && doseMatch ? 0.72 : 0.55;
    medicines.push({
      drug_name: name,
      dose: doseMatch?.[0] || "",
      frequency: freqMatch?.[0] || "",
      duration: durMatch?.[0] || "",
      confidence,
    });
  }

  if (!medicines.length && rawText) {
    medicines.push({
      drug_name: String(rawText).slice(0, 60).trim() || "unknown",
      dose: "",
      frequency: "",
      duration: "",
      confidence: 0.4,
    });
  }

  return {
    medicines,
    interactions: [],
    language_hints: /[\u0600-\u06FF]/.test(rawText) ? ["ar", "en"] : ["en"],
    stub: true,
  };
}

async function callMedGemma(rawText, log) {
  const project =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.VERTEX_PROJECT_ID ||
    process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION || "us-central1";
  const model =
    process.env.VERTEX_MEDGEMMA_MODEL ||
    process.env.VERTEX_MODEL ||
    "gemini-1.5-pro";

  const token =
    process.env.VERTEX_ACCESS_TOKEN || process.env.GOOGLE_CLOUD_ACCESS_TOKEN;

  if (!token || !project) {
    log("MedGemma not configured");
    return null;
  }

  // Generative Language / Vertex predict endpoint (token-based; SA JWT exchange is TODO).
  const url =
    process.env.VERTEX_GENERATE_URL ||
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const prompt = buildPharmacistPrompt(rawText);
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Vertex/MedGemma HTTP ${resp.status}: ${errText.slice(0, 400)}`);
  }

  const data = await resp.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
    data?.predictions?.[0]?.content ||
    "";

  const jsonMatch = String(text).match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("MedGemma response missing JSON object");
  return JSON.parse(jsonMatch[0]);
}

/** Optional server OCR when image provided without text — Document AI hook. */
async function serverOcrFromImage(payload, log) {
  const project = process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID;
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION || "us";
  const processor = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
  if (!project || !processor) {
    log("Server OCR (Document AI) not configured — skipping image path");
    return "";
  }
  // Full Document AI call deferred; document the preferred path.
  log(
    "Image received; prefer Capacitor ML Kit on-device text. Document AI processor configured but raw call not expanded in this slice.",
  );
  void payload;
  void location;
  return "";
}

async function createLowConfidenceAnnotations(db, medicines, meta, log) {
  if (!db) return [];
  const created = [];
  for (const m of medicines) {
    if (Number(m.confidence) >= CONFIDENCE_THRESHOLD) continue;
    try {
      const doc = await db.createDocument(DB, COL_ANN, ID.unique(), {
        image_crop_id: meta.image_crop_id || meta.image_url || "",
        user_id: meta.user_id || "",
        label_json: JSON.stringify(m),
        votes: [],
        status: "pending",
        created_at: new Date().toISOString(),
        confidence: Number(m.confidence) || 0,
        drug_name: String(m.drug_name || "").slice(0, 256),
      });
      created.push(doc.$id);
    } catch (e) {
      log(`annotation create failed: ${e.message || e}`);
    }
  }
  return created;
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  log("OCR Prescription Parser v2 triggered.");

  try {
    const payload = parseBody(req);
    let text = String(payload.text || payload.ocr_text || "").trim();
    const imageUrl = payload.image_url || payload.url || "";
    const base64Data = payload.image_base64 || payload.image || payload.data || "";
    const userId = payload.user_id || payload.userId || "";

    if (!text && !imageUrl && !base64Data) {
      return json(res, 400, {
        success: false,
        error: "Provide { text } from on-device ML Kit and/or { image|image_base64|image_url }.",
        disclaimer: DISCLAIMER,
      });
    }

    if (!text && (imageUrl || base64Data)) {
      text = await serverOcrFromImage(payload, log);
      if (!text) {
        // Soft fallback: acknowledge image but cannot OCR without Document AI
        return json(res, 200, {
          success: true,
          disclaimer: DISCLAIMER,
          ocr_path: "image_pending_server_ocr",
          note: "Send { text } from Capacitor ML Kit Text Recognition for best results. Server Document AI not fully wired.",
          medicines: [],
          parsed_medicines: [],
          interactions: [],
          medgemma_configured: medgemmaConfigured(),
        });
      }
    }

    log(
      `Parsing prescription text (${text.length} chars); image=${Boolean(imageUrl || base64Data)}; medgemma=${medgemmaConfigured()}`,
    );

    let parsed;
    let source = "stub";
    if (medgemmaConfigured()) {
      try {
        parsed = await callMedGemma(text, log);
        source = "medgemma";
      } catch (e) {
        error(`MedGemma call failed, falling back to stub: ${e.message || e}`);
        parsed = stubParse(text);
        source = "stub_fallback";
      }
    } else {
      log("MedGemma not configured");
      parsed = stubParse(text);
      source = "stub";
    }

    const medicines = Array.isArray(parsed.medicines)
      ? parsed.medicines
      : Array.isArray(parsed)
        ? parsed
        : [];

    const db = getDb();
    const annotationIds = await createLowConfidenceAnnotations(
      db,
      medicines,
      {
        user_id: userId,
        image_url: imageUrl,
        image_crop_id: payload.image_crop_id || "",
      },
      log,
    );

    // Back-compat shape + new shape
    const parsed_medicines = medicines.map((m) => ({
      name_detected: m.drug_name,
      confidence_score: m.confidence,
      strength: m.dose,
      dosage_instructions: [m.frequency, m.duration].filter(Boolean).join(" · "),
      drug_name: m.drug_name,
      dose: m.dose,
      frequency: m.frequency,
      duration: m.duration,
      confidence: m.confidence,
    }));

    return json(res, 200, {
      success: true,
      disclaimer: DISCLAIMER,
      document_type: "prescription",
      ocr_path: payload.text ? "mlkit_text" : "server_or_mixed",
      parse_source: source,
      medgemma_configured: medgemmaConfigured(),
      medicines,
      parsed_medicines,
      interactions: parsed.interactions || [],
      language_hints: parsed.language_hints || [],
      annotations_created: annotationIds,
      low_confidence_threshold: CONFIDENCE_THRESHOLD,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    error("OCR execution error: " + String(err.message || err));
    return json(res, 500, {
      success: false,
      error: String(err.message || err),
      disclaimer: DISCLAIMER,
    });
  }
};
