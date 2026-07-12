import { errorStatus, parseBody, requirePlatformAdmin, safeUrl, sendJson, sha256, supabaseRest } from "./_platform-server.js";

function extractionFormat(entityType) {
  if (entityType === "medicine") {
    return {
      type: "json",
      prompt: "Extract attributable medicine product facts from this page. Do not infer missing facts. Keep every field null when not explicitly present.",
      schema: {
        type: "object",
        properties: {
          commercial_name: { type: ["string", "null"] },
          scientific_name: { type: ["string", "null"] },
          manufacturer: { type: ["string", "null"] },
          dosage_form: { type: ["string", "null"] },
          strength: { type: ["string", "null"] },
          route: { type: ["string", "null"] },
          pack_size: { type: ["string", "null"] },
          registration_reference: { type: ["string", "null"] },
          barcode: { type: ["string", "null"] },
          price_egp: { type: ["number", "null"] },
          description: { type: ["string", "null"] },
          image_urls: { type: "array", items: { type: "string" } },
        },
      },
    };
  }
  return {
    type: "json",
    prompt: "Extract attributable pharmaceutical or healthcare company facts from this official page. Do not infer missing claims.",
    schema: {
      type: "object",
      properties: {
        company_name: { type: ["string", "null"] },
        description: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
        city: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
        therapeutic_areas: { type: "array", items: { type: "string" } },
        product_names: { type: "array", items: { type: "string" } },
        capabilities: { type: "array", items: { type: "string" } },
        support_programs: { type: "array", items: { type: "string" } },
        contact_details: { type: "object" },
      },
    },
  };
}

function firecrawlBody(source, url = source.root_url) {
  const formats = ["markdown", extractionFormat(source.entity_type)];
  if (source.crawl_mode === "crawl") {
    return {
      url,
      limit: Math.max(1, Math.min(Number(source.max_pages || 25), 250)),
      includePaths: source.include_paths || [],
      excludePaths: source.exclude_paths || [],
      scrapeOptions: { formats, onlyMainContent: true, removeBase64Images: true },
    };
  }
  return { url, formats, onlyMainContent: true, removeBase64Images: true, timeout: 45000 };
}

function normalizedPage(page, fallbackUrl) {
  const metadata = page?.metadata || page?.data?.metadata || {};
  const extracted = page?.json || page?.data?.json || {};
  const markdown = String(page?.markdown || page?.data?.markdown || "");
  const url = String(metadata.sourceURL || metadata.url || page?.url || fallbackUrl || "");
  const title = String(metadata.title || extracted?.commercial_name || extracted?.company_name || "").trim() || null;
  return { metadata, extracted, markdown, url, title };
}

function confidence(source, page) {
  let score = 35;
  if (source.canonical_id || source.company_slug) score += 30;
  if (page.title) score += 10;
  if (page.markdown.length >= 300) score += 10;
  if (page.extracted && Object.keys(page.extracted).length >= 3) score += 15;
  return Math.min(100, score);
}

async function insertCandidates(context, source, jobId, pages) {
  const rows = [];
  for (const rawPage of pages) {
    const page = normalizedPage(rawPage, source.root_url);
    if (!page.url) continue;
    safeUrl(page.url, source.allowed_domain);
    const extractedData = {
      ...page.extracted,
      summary: page.extracted?.description || page.markdown.slice(0, 1500) || null,
      source_metadata: {
        title: page.metadata?.title || null,
        description: page.metadata?.description || null,
        language: page.metadata?.language || null,
        status_code: page.metadata?.statusCode || null,
      },
      markdown_excerpt: page.markdown.slice(0, 10000),
    };
    rows.push({
      job_id: jobId,
      source_id: source.id,
      entity_type: source.entity_type,
      canonical_id: source.canonical_id || null,
      company_slug: source.company_slug || null,
      source_url: page.url,
      source_title: page.title,
      extracted_data: extractedData,
      content_hash: sha256({ url: page.url, extractedData }),
      confidence_score: confidence(source, page),
      status: "pending",
    });
  }
  if (!rows.length) return [];
  return supabaseRest(context, "/rest/v1/web_ingestion_candidates?on_conflict=source_id,source_url,content_hash&select=id,source_url,status,confidence_score", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
}

async function firecrawl(path, init = {}) {
  const key = String(process.env.FIRECRAWL_API_KEY || "").trim();
  if (!key) {
    const error = new Error("FIRECRAWL_API_KEY is not configured in Vercel environment variables.");
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(`https://api.firecrawl.dev${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(55000),
  });
  const data = await response.json();
  if (!response.ok || data?.success === false) {
    const error = new Error(data?.error || data?.message || `Firecrawl returned HTTP ${response.status}.`);
    error.statusCode = response.status >= 400 && response.status < 500 ? 400 : 502;
    throw error;
  }
  return data;
}

async function loadSource(context, sourceId) {
  const rows = await supabaseRest(context, `/rest/v1/web_ingestion_sources?select=*&id=eq.${encodeURIComponent(sourceId)}&limit=1`);
  const source = rows?.[0];
  if (!source || !source.is_active) throw new Error("Active web-ingestion source not found.");
  safeUrl(source.root_url, source.allowed_domain);
  return source;
}

async function start(context, sourceId) {
  const source = await loadSource(context, sourceId);
  const created = await supabaseRest(context, "/rest/v1/web_ingestion_jobs?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ source_id: source.id, provider: "firecrawl", mode: source.crawl_mode, status: "running", requested_by: context.user.id }),
  });
  const jobId = created?.[0]?.id;
  if (!jobId) throw new Error("Could not create the ingestion job.");

  await supabaseRest(context, `/rest/v1/web_ingestion_sources?id=eq.${source.id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ last_started_at: new Date().toISOString(), last_status: "running" }),
  });

  try {
    if (source.crawl_mode === "scrape") {
      const result = await firecrawl("/v2/scrape", { method: "POST", body: JSON.stringify(firecrawlBody(source)) });
      const page = result.data || result;
      const candidates = await insertCandidates(context, source, jobId, [page]);
      const completedAt = new Date().toISOString();
      await supabaseRest(context, `/rest/v1/web_ingestion_jobs?id=eq.${jobId}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: "completed", pages_discovered: 1, pages_processed: 1, credits_used: result.creditsUsed || result.credits_used || null, provider_response: { success: true }, completed_at: completedAt }),
      });
      await supabaseRest(context, `/rest/v1/web_ingestion_sources?id=eq.${source.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ last_completed_at: completedAt, last_status: "completed", next_run_at: new Date(Date.now() + Number(source.refresh_interval_hours || 24) * 3600000).toISOString() }),
      });
      return { job_id: jobId, status: "completed", candidates: candidates.length };
    }

    const result = await firecrawl("/v2/crawl", { method: "POST", body: JSON.stringify(firecrawlBody(source)) });
    const externalId = result.id || result.jobId;
    if (!externalId) throw new Error("Firecrawl did not return a crawl job identifier.");
    await supabaseRest(context, `/rest/v1/web_ingestion_jobs?id=eq.${jobId}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ external_job_id: externalId, provider_response: { url: result.url || null } }),
    });
    return { job_id: jobId, external_job_id: externalId, status: "running" };
  } catch (error) {
    await supabaseRest(context, `/rest/v1/web_ingestion_jobs?id=eq.${jobId}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", error_message: String(error?.message || "Firecrawl failed").slice(0, 2000), completed_at: new Date().toISOString() }),
    });
    await supabaseRest(context, `/rest/v1/web_ingestion_sources?id=eq.${source.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_status: "failed" }),
    });
    throw error;
  }
}

async function poll(context, jobId) {
  const jobs = await supabaseRest(context, `/rest/v1/web_ingestion_jobs?select=*&id=eq.${encodeURIComponent(jobId)}&limit=1`);
  const job = jobs?.[0];
  if (!job) throw new Error("Web-ingestion job not found.");
  const source = await loadSource(context, job.source_id);
  if (job.mode !== "crawl" || !job.external_job_id) return { job_id: job.id, status: job.status };
  if (["completed", "failed", "cancelled"].includes(job.status)) return { job_id: job.id, status: job.status };

  const result = await firecrawl(`/v2/crawl/${encodeURIComponent(job.external_job_id)}`, { method: "GET" });
  const providerStatus = String(result.status || "running").toLowerCase();
  const terminalSuccess = ["completed", "complete", "scraped"].includes(providerStatus);
  const terminalFailure = ["failed", "cancelled", "canceled"].includes(providerStatus);
  const pages = Array.isArray(result.data) ? result.data : [];

  if (terminalSuccess) {
    const candidates = await insertCandidates(context, source, job.id, pages);
    const completedAt = new Date().toISOString();
    await supabaseRest(context, `/rest/v1/web_ingestion_jobs?id=eq.${job.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "completed", pages_discovered: Number(result.total || pages.length), pages_processed: pages.length, credits_used: result.creditsUsed || result.credits_used || null, provider_response: { status: providerStatus }, completed_at: completedAt }),
    });
    await supabaseRest(context, `/rest/v1/web_ingestion_sources?id=eq.${source.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ last_completed_at: completedAt, last_status: "completed", next_run_at: new Date(Date.now() + Number(source.refresh_interval_hours || 24) * 3600000).toISOString() }),
    });
    return { job_id: job.id, status: "completed", pages: pages.length, candidates: candidates.length };
  }

  if (terminalFailure) {
    await supabaseRest(context, `/rest/v1/web_ingestion_jobs?id=eq.${job.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "failed", error_message: result.error || "Firecrawl crawl failed.", provider_response: { status: providerStatus }, completed_at: new Date().toISOString() }),
    });
    await supabaseRest(context, `/rest/v1/web_ingestion_sources?id=eq.${source.id}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_status: "failed" }),
    });
    return { job_id: job.id, status: "failed" };
  }

  await supabaseRest(context, `/rest/v1/web_ingestion_jobs?id=eq.${job.id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ pages_discovered: Number(result.total || 0), pages_processed: Number(result.completed || pages.length), provider_response: { status: providerStatus } }),
  });
  return { job_id: job.id, status: "running", completed: Number(result.completed || pages.length), total: Number(result.total || 0) };
}

export default async function handler(request, response) {
  if (request.method !== "POST") return sendJson(response, 405, { message: "POST required." });
  try {
    const context = await requirePlatformAdmin(request);
    const body = parseBody(request);
    const action = String(body.action || "start");
    if (action === "start") return sendJson(response, 200, await start(context, String(body.source_id || "")));
    if (action === "poll") return sendJson(response, 200, await poll(context, String(body.job_id || "")));
    return sendJson(response, 400, { message: "action must be start or poll." });
  } catch (error) {
    console.error("admin-firecrawl", error);
    return sendJson(response, errorStatus(error), { message: error instanceof Error ? error.message : "Firecrawl ingestion failed safely." });
  }
}
