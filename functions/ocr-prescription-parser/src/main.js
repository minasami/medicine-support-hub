/**
 * OCR Prescription Parser (v3)
 *
 * Accepts:
 *   { imageId, user_id }  — Cap camera / Storage upload path (primary UI)
 *   { text }              — on-device ML Kit text
 *   { image|image_base64|image_url } — optional server OCR
 *
 * Creates prescriptions + prescription_items. On low confidence (<0.8),
 * creates annotations and assigns up to 3 pharmacists with trust_score > 50.
 *
 * MedGemma / Document AI stub when GCP secrets missing.
 */
import { Client, Databases, ID, Query, Storage } from "node-appwrite";
import { z } from "zod";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_ANN = process.env.ANNOTATIONS_COLLECTION_ID || "annotations";
const COL_RX = "prescriptions";
const COL_ITEMS = "prescription_items";
const COL_TRUST = process.env.USER_TRUST_COLLECTION_ID || "user_trust";
const COL_PROFILES = process.env.USER_PROFILES_COLLECTION_ID || "user_profiles";
const BUCKET = process.env.APPWRITE_RX_BUCKET || "prescription-images";
const CONFIDENCE_THRESHOLD = Number(process.env.OCR_CONFIDENCE_THRESHOLD || 0.8);
const RLAIF_ASSIGN = Number(process.env.RLAIF_ASSIGN_COUNT || 3);
const RLAIF_TRUST_MIN = Number(process.env.RLAIF_TRUST_MIN || 50);

const DISCLAIMER = "AI assistive only. Licensed pharmacist must verify.";

const InputSchema = z
  .object({
    imageId: z.string().optional(),
    image_id: z.string().optional(),
    user_id: z.string().optional(),
    userId: z.string().optional(),
    text: z.string().optional(),
    ocr_text: z.string().optional(),
    image_url: z.string().optional(),
    url: z.string().optional(),
    image_base64: z.string().optional(),
    image: z.string().optional(),
    data: z.string().optional(),
    image_crop_id: z.string().optional(),
  })
  .passthrough();

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

function getClient() {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
  const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !project || !key) return null;
  return new Client().setEndpoint(endpoint).setProject(project).setKey(key);
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

function stubParse(rawText) {
  const lines = String(rawText || "")
    .split(/[\n\r;]+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  const medicines = [];
  for (const line of lines) {
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
    const confidence = name.length >= 4 && doseMatch ? 0.72 : 0.55;
    medicines.push({
      drug_name: name,
      dose: doseMatch?.[0] || "",
      frequency: freqMatch?.[0] || "",
      duration: durMatch?.[0] || "",
      confidence,
    });
  }

  if (!medicines.length) {
    medicines.push({
      drug_name: String(rawText || "unreadable prescription").slice(0, 60).trim() || "unknown",
      dose: "",
      frequency: "",
      duration: "",
      confidence: 0.4,
    });
  }

  return {
    medicines,
    interactions: [],
    language_hints: /[\u0600-\u06FF]/.test(rawText || "") ? ["ar", "en"] : ["en"],
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
    process.env.VERTEX_MEDGEMMA_MODEL || process.env.VERTEX_MODEL || "gemini-1.5-pro";
  const token = process.env.VERTEX_ACCESS_TOKEN || process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
  if (!token || !project) {
    log("MedGemma not configured");
    return null;
  }
  const url =
    process.env.VERTEX_GENERATE_URL ||
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: buildPharmacistPrompt(rawText) }] }],
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

async function serverOcrFromImage(payload, log) {
  const project = process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID;
  const processor = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;
  if (!project || !processor) {
    log("Server OCR (Document AI) not configured — imageId stub path");
    return "";
  }
  log("Document AI configured but raw call deferred in this slice.");
  void payload;
  return "";
}

async function pickTrustedPharmacists(db, log) {
  const ids = [];
  try {
    const trust = await db.listDocuments(DB, COL_TRUST, [
      Query.greaterThan("trust_score", RLAIF_TRUST_MIN),
      Query.equal("is_pharmacist", true),
      Query.orderDesc("trust_score"),
      Query.limit(RLAIF_ASSIGN),
    ]);
    for (const d of trust.documents) ids.push(d.user_id || d.$id);
  } catch (e) {
    log(`user_trust pick: ${e.message || e}`);
  }
  if (ids.length < RLAIF_ASSIGN) {
    try {
      const profiles = await db.listDocuments(DB, COL_PROFILES, [
        Query.equal("role", "pharmacist"),
        Query.equal("is_verified_pharmacist", true),
        Query.greaterThan("trust_score", RLAIF_TRUST_MIN),
        Query.limit(RLAIF_ASSIGN),
      ]);
      for (const p of profiles.documents) {
        const id = p.user_id || p.$id;
        if (id && !ids.includes(id)) ids.push(id);
      }
    } catch (e) {
      log(`user_profiles pick: ${e.message || e}`);
    }
  }
  return ids.slice(0, RLAIF_ASSIGN);
}

async function createLowConfidenceAnnotations(db, medicines, meta, log) {
  if (!db) return { annotationIds: [], assigned: [] };
  const low = medicines.filter((m) => Number(m.confidence) < CONFIDENCE_THRESHOLD);
  if (!low.length) return { annotationIds: [], assigned: [] };

  const assigned = await pickTrustedPharmacists(db, log);
  const annotationIds = [];

  // One queue item covering all low-confidence lines (plus per-drug for legacy)
  try {
    const doc = await db.createDocument(DB, COL_ANN, ID.unique(), {
      image_crop_id: meta.imageId || meta.image_url || "",
      image_id: meta.imageId || "",
      prescription_id: meta.prescription_id || "",
      user_id: meta.user_id || "",
      label_json: JSON.stringify(low),
      ai_parsed_json: JSON.stringify(low),
      ground_truth_json: "",
      votes: [],
      status: "pending",
      created_at: new Date().toISOString(),
      confidence: Math.min(...low.map((m) => Number(m.confidence) || 0)),
      drug_name: String(low[0]?.drug_name || "").slice(0, 256),
      assigned_pharmacists: JSON.stringify(assigned),
    });
    annotationIds.push(doc.$id);
  } catch (e) {
    log(`annotation batch create failed: ${e.message || e}`);
    for (const m of low) {
      try {
        const doc = await db.createDocument(DB, COL_ANN, ID.unique(), {
          image_crop_id: meta.imageId || meta.image_url || "",
          user_id: meta.user_id || "",
          label_json: JSON.stringify(m),
          votes: [],
          status: "pending",
          created_at: new Date().toISOString(),
          confidence: Number(m.confidence) || 0,
          drug_name: String(m.drug_name || "").slice(0, 256),
        });
        annotationIds.push(doc.$id);
      } catch (err) {
        log(`annotation create failed: ${err.message || err}`);
      }
    }
  }
  return { annotationIds, assigned };
}

async function persistPrescription(db, { userId, imageId, medicines, source }, log) {
  const avg =
    medicines.length > 0
      ? medicines.reduce((s, m) => s + (Number(m.confidence) || 0), 0) / medicines.length
      : 0;
  const rx = await db.createDocument(DB, COL_RX, ID.unique(), {
    user_id: userId || "",
    image_id: imageId || "",
    image_url: "",
    status: "parsed",
    pharmacy_id: "",
    ai_parsed_json: JSON.stringify(medicines),
    confidence_score: avg,
    final_order_json: "",
    parse_source: source,
  });
  const itemIds = [];
  for (const m of medicines) {
    try {
      const item = await db.createDocument(DB, COL_ITEMS, ID.unique(), {
        prescription_id: rx.$id,
        drug_name: String(m.drug_name || "").slice(0, 256),
        suggested_dose: String(m.dose || "").slice(0, 128),
        frequency: String(m.frequency || "").slice(0, 128),
        duration: String(m.duration || "").slice(0, 128),
        confidence: Number(m.confidence) || 0,
        user_edited: false,
        status: "ai",
      });
      itemIds.push(item.$id);
    } catch (e) {
      log(`prescription_item: ${e.message || e}`);
    }
  }
  return { prescription_id: rx.$id, item_ids: itemIds, confidence_score: avg };
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  log("OCR Prescription Parser v3 triggered.");

  try {
    const raw = parseBody(req);
    const checked = InputSchema.safeParse(raw);
    if (!checked.success) {
      return json(res, 400, {
        success: false,
        error: "Invalid input",
        issues: checked.error.issues,
        disclaimer: DISCLAIMER,
      });
    }
    const payload = checked.data;
    const imageId = payload.imageId || payload.image_id || "";
    const userId = payload.user_id || payload.userId || "";
    let text = String(payload.text || payload.ocr_text || "").trim();
    const imageUrl = payload.image_url || payload.url || "";
    const base64Data = payload.image_base64 || payload.image || payload.data || "";

    if (!text && !imageUrl && !base64Data && !imageId) {
      return json(res, 400, {
        success: false,
        error: "Provide { imageId } and/or { text } and/or image payload.",
        disclaimer: DISCLAIMER,
      });
    }

    const client = getClient();
    const db = client ? new Databases(client) : null;
    const storage = client ? new Storage(client) : null;

    if (!text && imageId && storage) {
      try {
        const meta = await storage.getFile(BUCKET, imageId);
        // Without Document AI we cannot OCR bytes; seed stub text from filename for pipeline continuity.
        text = `Prescription image ${meta.name || imageId}`;
        log(`imageId=${imageId} → stub OCR seed from filename (Document AI not wired)`);
      } catch (e) {
        log(`storage.getFile: ${e.message || e}`);
        text = `Prescription image ${imageId}`;
      }
    }

    if (!text && (imageUrl || base64Data)) {
      text = await serverOcrFromImage(payload, log);
      if (!text) {
        text = "Unreadable prescription image";
      }
    }

    log(
      `Parsing (${text.length} chars); imageId=${Boolean(imageId)}; medgemma=${medgemmaConfigured()}`,
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

    let prescription_id = null;
    let item_ids = [];
    let confidence_score = 0;
    if (db) {
      try {
        const saved = await persistPrescription(
          db,
          { userId, imageId, medicines, source },
          log,
        );
        prescription_id = saved.prescription_id;
        item_ids = saved.item_ids;
        confidence_score = saved.confidence_score;
      } catch (e) {
        error(`persistPrescription: ${e.message || e}`);
      }
    }

    const { annotationIds, assigned } = await createLowConfidenceAnnotations(
      db,
      medicines,
      {
        user_id: userId,
        image_url: imageUrl,
        imageId,
        prescription_id,
        image_crop_id: payload.image_crop_id || imageId || "",
      },
      log,
    );

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
      prescription_id,
      item_ids,
      confidence_score,
      imageId: imageId || null,
      ocr_path: payload.text ? "mlkit_text" : imageId ? "imageId_storage" : "server_or_mixed",
      parse_source: source,
      medgemma_configured: medgemmaConfigured(),
      medicines,
      parsed_medicines,
      interactions: parsed.interactions || [],
      language_hints: parsed.language_hints || [],
      annotations_created: annotationIds,
      assigned_pharmacists: assigned,
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
