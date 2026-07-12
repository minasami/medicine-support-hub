import { firecrawlConfiguration } from "./_firecrawl-client.js";
import { errorStatus, requirePlatformAdmin, sendJson, supabaseRest } from "./_platform-server.js";

function configured(...names) {
  return names.every((name) => Boolean(String(process.env[name] || "").trim()));
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = String(row?.[key] || "unknown");
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

export default async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { message: "GET required." });
  try {
    const context = await requirePlatformAdmin(request);
    const firecrawl = firecrawlConfiguration();
    const [growthRows, qualityRows] = await Promise.all([
      supabaseRest(context, "/rest/v1/medicine_data_growth_health_v1?select=*&limit=1"),
      supabaseRest(
        context,
        "/rest/v1/web_ingestion_source_quality?select=trust_tier,reliability_score,required_corroborations,automatic_candidate_creation,automatic_publication",
      ),
    ]);
    const growth = Array.isArray(growthRows) ? growthRows[0] || null : null;
    const sourceQuality = Array.isArray(qualityRows) ? qualityRows : [];

    return sendJson(response, 200, {
      google_document_ai: {
        configured: configured(
          "GOOGLE_DOCUMENT_AI_PROJECT_ID",
          "GOOGLE_DOCUMENT_AI_LOCATION",
          "GOOGLE_DOCUMENT_AI_PROCESSOR_ID",
          "GOOGLE_SERVICE_ACCOUNT_EMAIL",
          "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
        ),
        provider: "Google Enterprise Document OCR",
        required_environment_variables: [
          "GOOGLE_DOCUMENT_AI_PROJECT_ID",
          "GOOGLE_DOCUMENT_AI_LOCATION",
          "GOOGLE_DOCUMENT_AI_PROCESSOR_ID",
          "GOOGLE_SERVICE_ACCOUNT_EMAIL",
          "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
        ],
      },
      firecrawl: {
        configured: firecrawl.configured,
        automatic_sync_ready: firecrawl.configured && configured("CRON_SECRET", "SUPABASE_SERVICE_ROLE_KEY"),
        api_version: firecrawl.apiVersion,
        mode: firecrawl.mode,
        base_url: firecrawl.baseUrl,
        authentication_configured: firecrawl.authConfigured,
        authentication_required: firecrawl.requireAuth,
      },
      adaptive_growth: {
        enabled: true,
        health: growth,
        governed_sources: sourceQuality.length,
        source_trust_tiers: countBy(sourceQuality, "trust_tier"),
        average_source_reliability: sourceQuality.length
          ? Math.round(sourceQuality.reduce((sum, row) => sum + Number(row.reliability_score || 0), 0) / sourceQuality.length)
          : 0,
        automatic_candidate_creation: sourceQuality.some((row) => row.automatic_candidate_creation === true),
        automatic_publication: false,
        human_review_required: true,
      },
      image_search: { configured: configured("BING_IMAGE_SEARCH_KEY") },
      cron: { configured: configured("CRON_SECRET") },
      service_role: { configured: configured("SUPABASE_SERVICE_ROLE_KEY") },
      security: {
        secrets_exposed_to_browser: false,
        automatic_publication: false,
        human_review_required: true,
      },
    });
  } catch (error) {
    console.error("admin-integrations", error);
    return sendJson(response, errorStatus(error), { message: error instanceof Error ? error.message : "Could not inspect integrations." });
  }
}
