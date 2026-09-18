export type RecentSearch = { query: string };

export const RECENT_SEARCHES_KEY = "msh:medicine-recent-searches:v1";
export const RECENT_SEARCHES_CHANGED = "msh:medicine-recent-searches-changed";
let memory: RecentSearch[] = [];
let memoryOnly = false;

/** Accept legacy strings and objects, but never replay an untrusted product ID. */
export function normalizeRecentSearches(value: unknown): RecentSearch[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: RecentSearch[] = [];
  for (const item of value) {
    const raw = typeof item === "string" ? item : item?.query;
    if (typeof raw !== "string") continue;
    const query = raw.trim().replace(/\s+/g, " ");
    const key = query.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({ query });
    if (result.length === 6) break;
  }
  return result;
}

export function readRecentSearches(): RecentSearch[] {
  if (typeof window === "undefined") return [];
  if (memoryOnly) return memory;
  try {
    memory = normalizeRecentSearches(
      JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || "[]"),
    );
  } catch {
    // History is optional: denied storage must not prevent searching.
  }
  return memory;
}

function saveRecentSearches(next: RecentSearch[]) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    if (next.length)
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    memoryOnly = true;
    // Retain an in-memory history when storage is unavailable.
  }
  window.dispatchEvent(new Event(RECENT_SEARCHES_CHANGED));
}

export function rememberRecentSearch(query: string) {
  if (!query.trim()) return;
  saveRecentSearches(
    normalizeRecentSearches([{ query }, ...readRecentSearches()]),
  );
}

export function clearRecentSearches() {
  saveRecentSearches([]);
}
