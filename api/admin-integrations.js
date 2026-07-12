import { firecrawlConfiguration } from "./_firecrawl-client.js";
import { errorStatus, requirePlatformAdmin, sendJson } from "./_platform-server.js";

function configured(...names) {
  return names.every((name) => Boolean(String(process.env[name] || "").trim()));
}

export default async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { message: "GET required." });
  try {
    await requirePlatformAdmin(request);
    const firecrawl = firecrawlConfiguration();
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
        api_version: "v2",
        mode: firecrawl.mode,
        base_url: firecrawl.baseUrl,
        authentication_configured: firecrawl.authConfigured,
        authentication_required: firecrawl.requireAuth,
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
