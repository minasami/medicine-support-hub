import { createHash, createSign } from "node:crypto";
import { errorStatus, parseBody, requirePlatformAdmin, sendJson, supabaseRest } from "./_platform-server.js";

const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/tiff", "image/webp"]);

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function serviceAccountAssertion() {
  const email = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Google service-account credentials are not configured.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(privateKey, "base64url")}`;
}

async function googleAccessToken() {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: serviceAccountAssertion(),
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data?.error_description || "Google authentication failed.");
  return data.access_token;
}

function anchorText(documentText, textAnchor) {
  const segments = Array.isArray(textAnchor?.textSegments) ? textAnchor.textSegments : [];
  return segments.map((segment) => {
    const start = Number(segment.startIndex || 0);
    const end = Number(segment.endIndex || 0);
    return documentText.slice(start, end);
  }).join("").trim();
}

function documentSummary(document) {
  const text = String(document?.text || "");
  const pages = Array.isArray(document?.pages) ? document.pages : [];
  const languages = [...new Set(pages.flatMap((page) =>
    (Array.isArray(page.detectedLanguages) ? page.detectedLanguages : [])
      .map((language) => language.languageCode)
      .filter(Boolean),
  ))];
  const qualityScores = pages
    .map((page) => Number(page?.imageQualityScores?.qualityScore))
    .filter((value) => Number.isFinite(value));
  const quality = qualityScores.length ? qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length : null;
  const blocks = pages.flatMap((page, pageIndex) => {
    const paragraphs = Array.isArray(page.paragraphs) ? page.paragraphs : [];
    return paragraphs.slice(0, 500).map((paragraph, paragraphIndex) => ({
      page: pageIndex + 1,
      order: paragraphIndex + 1,
      text: anchorText(text, paragraph?.layout?.textAnchor),
      confidence: paragraph?.layout?.confidence == null ? null : Number(paragraph.layout.confidence),
    })).filter((block) => block.text);
  }).slice(0, 3000);
  const defects = pages.flatMap((page, pageIndex) =>
    (Array.isArray(page?.imageQualityScores?.detectedDefects) ? page.imageQualityScores.detectedDefects : [])
      .map((defect) => ({ page: pageIndex + 1, type: defect.type || null, confidence: defect.confidence ?? null })),
  );
  return { text, pages: pages.length, languages, quality, blocks, defects };
}

export default async function handler(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { message: "POST required." });
  let context;
  let jobId = null;
  try {
    context = await requirePlatformAdmin(request);
    const body = parseBody(request);
    const sourceName = String(body.source_name || "").trim();
    const mimeType = String(body.mime_type || "").trim().toLowerCase();
    const content = String(body.content_base64 || "").replace(/^data:[^;]+;base64,/, "").trim();
    if (!sourceName || !content || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return sendJson(response, 400, { message: "source_name, a supported mime_type, and content_base64 are required." });
    }

    const binary = Buffer.from(content, "base64");
    const maxFileMb = Math.max(1, Math.min(Number(process.env.OCR_MAX_FILE_MB || 3), 8));
    if (!binary.length || binary.length > maxFileMb * 1024 * 1024) {
      return sendJson(response, 413, { message: `Document must be smaller than ${maxFileMb} MB.` });
    }

    const project = String(process.env.GOOGLE_DOCUMENT_AI_PROJECT_ID || "").trim();
    const location = String(process.env.GOOGLE_DOCUMENT_AI_LOCATION || "").trim();
    const processor = String(process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || "").trim();
    if (!project || !location || !processor || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
      return sendJson(response, 503, { message: "Google Enterprise Document OCR is not configured in Vercel environment variables." });
    }

    const inserted = await supabaseRest(context, "/rest/v1/document_ocr_jobs?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        source_name: sourceName,
        source_url: body.source_url || null,
        mime_type: mimeType,
        document_sha256: createHash("sha256").update(binary).digest("hex"),
        provider_requested: "google_document_ai",
        status: "processing",
        review_status: "pending",
        created_by: context.user.id,
      }),
    });
    jobId = inserted?.[0]?.id || null;
    if (!jobId) throw new Error("Could not create the private OCR job record.");

    const token = await googleAccessToken();
    const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/processors/${encodeURIComponent(processor)}:process`;
    const providerResponse = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        rawDocument: { content, mimeType },
        processOptions: { ocrConfig: { enableNativePdfParsing: true, enableImageQualityScores: true } },
      }),
      signal: AbortSignal.timeout(55000),
    });
    const providerData = await providerResponse.json();
    if (!providerResponse.ok || !providerData.document) {
      throw new Error(providerData?.error?.message || `Google Document AI returned HTTP ${providerResponse.status}.`);
    }

    const summary = documentSummary(providerData.document);
    await supabaseRest(context, `/rest/v1/document_ocr_jobs?id=eq.${encodeURIComponent(jobId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        provider_used: "google_document_ai",
        status: "completed",
        page_count: summary.pages,
        language_codes: summary.languages,
        quality_score: summary.quality,
        extracted_text: summary.text.slice(0, 1000000),
        extracted_blocks: summary.blocks,
        provider_metadata: { defects: summary.defects, text_characters: summary.text.length },
        completed_at: new Date().toISOString(),
        error_message: null,
      }),
    });

    return sendJson(response, 200, {
      id: jobId,
      status: "completed",
      provider: "google_document_ai",
      page_count: summary.pages,
      language_codes: summary.languages,
      quality_score: summary.quality,
      text: summary.text,
      blocks: summary.blocks,
      defects: summary.defects,
      review_status: "pending",
    });
  } catch (error) {
    console.error("admin-ocr", error);
    if (context && jobId) {
      try {
        await supabaseRest(context, `/rest/v1/document_ocr_jobs?id=eq.${encodeURIComponent(jobId)}`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "failed", error_message: String(error?.message || "OCR failed").slice(0, 2000), completed_at: new Date().toISOString() }),
        });
      } catch (updateError) {
        console.error("admin-ocr-job-update", updateError);
      }
    }
    return sendJson(response, errorStatus(error), { message: error instanceof Error ? error.message : "OCR failed safely." });
  }
}
