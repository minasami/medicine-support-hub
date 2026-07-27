/**
 * Real-Time Image Search API Client (OpenWebNinja)
 * Searches Google Images in real-time for authentic branded medicine packaging & formula canister photos.
 */

export interface RealtimeImageResult {
  title?: string;
  image_url: string;
  source_url?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

export async function searchRealtimeImages(
  query: string,
  options: {
    limit?: number;
    fileType?: string;
    safeSearch?: "off" | "blur" | "on";
    apiKey?: string;
  } = {}
): Promise<RealtimeImageResult[]> {
  const apiKey = options.apiKey || import.meta.env.VITE_OPENWEBNINJA_API_KEY;
  if (!apiKey) {
    console.warn("[RealtimeImageSearch] VITE_OPENWEBNINJA_API_KEY environment variable missing; returning fallback photo matches.");
    return [];
  }

  try {
    const params = new URLSearchParams({
      query,
      limit: String(options.limit || 5),
      safe_search: options.safeSearch || "blur",
    });

    if (options.fileType) {
      params.append("file_type", options.fileType);
    }

    const response = await fetch(
      `https://api.openwebninja.com/realtime-image-search/search?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Accept": "application.json",
        },
      }
    );

    if (!response.ok) {
      console.error(`[RealtimeImageSearch] API Error ${response.status}: ${await response.text()}`);
      return [];
    }

    const data = await response.json();
    const results: RealtimeImageResult[] = (data.data || data.results || data || []).map(
      (item: any) => ({
        title: item.title || item.name || query,
        image_url: item.original_url || item.image_url || item.url || item.src,
        thumbnail_url: item.thumbnail_url || item.thumbnail || item.image_url,
        source_url: item.source_url || item.link || item.page_url,
        width: item.width,
        height: item.height,
      })
    );

    return results.filter((img) => img.image_url && img.image_url.startsWith("http"));
  } catch (err) {
    console.error("[RealtimeImageSearch] Network exception during Google Images search:", err);
    return [];
  }
}
