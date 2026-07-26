// Appwrite Serverless Function: Firecrawl Product Image Enricher
export default async ({ req, res, log, error }) => {
  log("Starting Firecrawl Product Image Enrichment task...");

  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  const baseUrl = process.env.FIRECRAWL_API_BASE_URL || "https://api.firecrawl.dev";

  try {
    // Parse input query if invoked manually
    let targetKeyword = "";
    if (req.body) {
      try {
        const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        targetKeyword = payload.keyword || payload.medicine_name || "";
      } catch {}
    }

    log(`Target keyword for image enrichment: ${targetKeyword || "Batch queue check"}`);

    if (firecrawlApiKey && targetKeyword) {
      const searchRes = await fetch(`${baseUrl}/v1/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          query: `${targetKeyword} medicine packaging box price Egypt`,
          limit: 3
        })
      });
      const searchData = await searchRes.json();
      log(`Firecrawl API response received: ${JSON.stringify(searchData?.data?.length || 0)} results`);

      return res.json({
        success: true,
        keyword: targetKeyword,
        results_count: searchData?.data?.length || 0,
        results: searchData?.data || [],
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      message: "Firecrawl Image Enrichment Cron completed.",
      status: "idle",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    error("Firecrawl enrichment error: " + String(err.message || err));
    return res.json({
      success: false,
      error: String(err.message || err)
    }, 500);
  }
};
