import { firecrawlConfiguration, firecrawlRequest } from "./_firecrawl-client.js";
import { safeUrl, sendJson, sha256 } from "./_platform-server.js";

function serviceContext() {
  const url = String(process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("Scheduled Supabase service credentials are not fully configured.");
  const firecrawl = firecrawlConfiguration();
  if (!firecrawl.configured) throw new Error("Scheduled Firecrawl provider is not fully configured.");
  return { url, key, firecrawl };
}

async function rest(context, path, init = {}) {
  const response = await fetch(`${context.url}${path}`, {
    ...init,
    headers: { apikey: context.key, Authorization: `Bearer ${context.key}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(55000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `Supabase HTTP ${response.status}`);
  return data;
}

function formatFor(entityType) {
  const medicine = entityType === "medicine";
  return {
    type: "json",
    prompt: medicine
      ? "Extract explicitly stated medicine product facts. Do not infer missing fields."
      : "Extract explicitly stated pharmaceutical company facts. Do not infer missing fields.",
    schema: medicine ? {
      type: "object",
      properties: {
        commercial_name: { type: ["string", "null"] }, scientific_name: { type: ["string", "null"] },
        manufacturer: { type: ["string", "null"] }, dosage_form: { type: ["string", "null"] },
        strength: { type: ["string", "null"] }, barcode: { type: ["string", "null"] },
        price_egp: { type: ["number", "null"] }, description: { type: ["string", "null"] },
      },
    } : {
      type: "object",
      properties: {
        company_name: { type: ["string", "null"] }, description: { type: ["string", "null"] },
        country: { type: ["string", "null"] }, therapeutic_areas: { type: "array", items: { type: "string" } },
        product_names: { type: "array", items: { type: "string" } }, capabilities: { type: "array", items: { type: "string" } },
      },
    },
  };
}

function pageData(raw, source) {
  const metadata = raw?.metadata || raw?.data?.metadata || {};
  const extracted = raw?.json || raw?.data?.json || {};
  const markdown = String(raw?.markdown || raw?.data?.markdown || "");
  const sourceUrl = String(metadata.sourceURL || metadata.url || raw?.url || source.root_url || "");
  safeUrl(sourceUrl, source.allowed_domain);
  const title = String(metadata.title || extracted.commercial_name || extracted.company_name || "").trim() || null;
  const structured = {
    ...extracted,
    summary: extracted.description || markdown.slice(0, 1500) || null,
    source_metadata: { title: metadata.title || null, description: metadata.description || null, language: metadata.language || null },
    markdown_excerpt: markdown.slice(0, 10000),
  };
  return {
    job_id: null,
    source_id: source.id,
    entity_type: source.entity_type,
    canonical_id: source.canonical_id || null,
    company_slug: source.company_slug || null,
    source_url: sourceUrl,
    source_title: title,
    extracted_data: structured,
    content_hash: sha256({ sourceUrl, structured }),
    confidence_score: Math.min(100, 45 + (source.canonical_id || source.company_slug ? 30 : 0) + (title ? 10 : 0) + (markdown.length >= 300 ? 10 : 0)),
    status: "pending",
  };
}

async function storeCandidates(context, source, jobId, pages) {
  const rows = pages.map((page) => ({ ...pageData(page, source), job_id: jobId }));
  if (!rows.length) return 0;
  const inserted = await rest(context, "/rest/v1/web_ingestion_candidates?on_conflict=source_id,source_url,content_hash&select=id", {
    method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows),
  });
  return inserted.length;
}

async function updateSourceAfter(context, source, status) {
  const completed = new Date();
  await rest(context, `/rest/v1/web_ingestion_sources?id=eq.${source.id}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      last_status: status,
      last_completed_at: status === "completed" ? completed.toISOString() : source.last_completed_at,
      next_run_at: new Date(completed.getTime() + Number(source.refresh_interval_hours || 24) * 3600000).toISOString(),
    }),
  });
}

async function pollRunning(context) {
  const jobs = await rest(context, "/rest/v1/web_ingestion_jobs?select=*&status=eq.running&mode=eq.crawl&order=created_at.asc&limit=10");
  const results = [];
  for (const job of jobs) {
    if (!job.external_job_id) continue;
    const sources = await rest(context, `/rest/v1/web_ingestion_sources?select=*&id=eq.${job.source_id}&limit=1`);
    const source = sources[0];
    if (!source) continue;
    try {
      const provider = await firecrawlRequest(`/v2/crawl/${encodeURIComponent(job.external_job_id)}`, { method: "GET" });
      const status = String(provider.status || "running").toLowerCase();
      if (["completed", "complete", "scraped"].includes(status)) {
        const pages = Array.isArray(provider.data) ? provider.data : [];
        const candidates = await storeCandidates(context, source, job.id, pages);
        await rest(context, `/rest/v1/web_ingestion_jobs?id=eq.${job.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ status: "completed", pages_discovered: Number(provider.total || pages.length), pages_processed: pages.length, credits_used: provider.creditsUsed || null, provider_response: { status }, completed_at: new Date().toISOString() }),
        });
        await updateSourceAfter(context, source, "completed");
        results.push({ job_id: job.id, status: "completed", candidates });
      } else if (["failed", "cancelled", "canceled"].includes(status)) {
        await rest(context, `/rest/v1/web_ingestion_jobs?id=eq.${job.id}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", error_message: provider.error || "Firecrawl failed", completed_at: new Date().toISOString() }),
        });
        await updateSourceAfter(context, source, "failed");
        results.push({ job_id: job.id, status: "failed" });
      } else {
        results.push({ job_id: job.id, status: "running" });
      }
    } catch (error) {
      results.push({ job_id: job.id, status: "poll_error", message: String(error.message || error) });
    }
  }
  return results;
}

async function startDue(context) {
  const settings = await rest(context, "/rest/v1/platform_settings?select=setting_key,value&setting_key=in.(firecrawl.enabled,firecrawl.automatic_sync)");
  const values = Object.fromEntries(settings.map((row) => [row.setting_key, row.value]));
  if (values["firecrawl.enabled"] !== true || values["firecrawl.automatic_sync"] !== true) return [];
  const query = new URLSearchParams({
    select: "*",
    schedule_enabled: "eq.true",
    is_active: "eq.true",
    or: `(next_run_at.is.null,next_run_at.lte.${new Date().toISOString()})`,
    order: "next_run_at.asc.nullsfirst",
    limit: "2",
  });
  const sources = await rest(context, `/rest/v1/web_ingestion_sources?${query.toString()}`);
  const results = [];
  for (const source of sources) {
    try {
      safeUrl(source.root_url, source.allowed_domain);
      const jobs = await rest(context, "/rest/v1/web_ingestion_jobs?select=id", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ source_id: source.id, provider: "firecrawl", mode: source.crawl_mode, status: "running", requested_by: null }),
      });
      const jobId = jobs[0]?.id;
      await rest(context, `/rest/v1/web_ingestion_sources?id=eq.${source.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ last_started_at: new Date().toISOString(), last_status: "running" }),
      });
      const formats = ["markdown", formatFor(source.entity_type)];
      if (source.crawl_mode === "scrape") {
        const provider = await firecrawlRequest("/v2/scrape", {
          method: "POST", body: JSON.stringify({ url: source.root_url, formats, onlyMainContent: true, removeBase64Images: true, timeout: 45000 }),
        });
        const candidates = await storeCandidates(context, source, jobId, [provider.data || provider]);
        await rest(context, `/rest/v1/web_ingestion_jobs?id=eq.${jobId}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "completed", pages_discovered: 1, pages_processed: 1, provider_response: { success: true }, completed_at: new Date().toISOString() }),
        });
        await updateSourceAfter(context, source, "completed");
        results.push({ source_id: source.id, job_id: jobId, status: "completed", candidates });
      } else {
        const provider = await firecrawlRequest("/v2/crawl", {
          method: "POST",
          body: JSON.stringify({
            url: source.root_url, limit: Math.min(Number(source.max_pages || 25), 250),
            includePaths: source.include_paths || [], excludePaths: source.exclude_paths || [],
            scrapeOptions: { formats, onlyMainContent: true, removeBase64Images: true },
          }),
        });
        const externalId = provider.id || provider.jobId;
        await rest(context, `/rest/v1/web_ingestion_jobs?id=eq.${jobId}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ external_job_id: externalId, provider_response: { url: provider.url || null } }),
        });
        results.push({ source_id: source.id, job_id: jobId, status: "running" });
      }
    } catch (error) {
      results.push({ source_id: source.id, status: "start_error", message: String(error.message || error) });
    }
  }
  return results;
}

async function refreshSearchIndex(context) {
  try {
    return await rest(context, "/rest/v1/rpc/refresh_medicine_search_index_v1", { method: "POST", body: "{}" });
  } catch (error) {
    return { error: String(error.message || error) };
  }
}

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) return sendJson(response, 405, { message: "GET or POST required." });
  const expected = String(process.env.CRON_SECRET || "");
  if (!expected || String(request.headers.authorization || "") !== `Bearer ${expected}`) {
    return sendJson(response, 401, { message: "Unauthorized scheduled request." });
  }
  try {
    const context = serviceContext();
    const polled = await pollRunning(context);
    const started = await startDue(context);
    const searchIndex = await refreshSearchIndex(context);
    return sendJson(response, 200, { ok: true, provider_mode: context.firecrawl.mode, provider_api_version: context.firecrawl.apiVersion, polled, started, search_index: searchIndex, automatic_publication: false });
  } catch (error) {
    console.error("firecrawl-cron", error);
    return sendJson(response, 500, { message: error instanceof Error ? error.message : "Scheduled Firecrawl run failed safely." });
  }
}
