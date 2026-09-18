import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeRecentSearches,
  readRecentSearches,
  rememberRecentSearch,
  clearRecentSearches,
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_CHANGED,
} from "./recent-searches.ts";

test("legacy history is trimmed, deduplicated, bounded and safe to replay", () => {
  assert.deepEqual(
    normalizeRecentSearches([
      null,
      " ",
      "  Panadol  ",
      { query: "panadol", canonicalId: 12 },
      { query: "دواء   جديد" },
      { query: 3 },
    ]),
    [{ query: "Panadol" }, { query: "دواء جديد" }],
  );
  assert.equal(
    normalizeRecentSearches(Array.from({ length: 10 }, (_, i) => `q${i}`))
      .length,
    6,
  );
  assert.deepEqual(normalizeRecentSearches({ query: "bad" }), []);
});

test("history persists, moves reused searches first, broadcasts and survives denied storage", () => {
  const data = new Map<string, string>();
  const target = new EventTarget();
  let denied = false;
  let changes = 0;
  target.addEventListener(RECENT_SEARCHES_CHANGED, () => changes++);
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => {
          if (denied) throw Error("blocked");
          return data.get(key) ?? null;
        },
        setItem: (key: string, value: string) => {
          if (denied) throw Error("blocked");
          data.set(key, value);
        },
        removeItem: (key: string) => {
          if (denied) throw Error("blocked");
          data.delete(key);
        },
      },
      dispatchEvent: target.dispatchEvent.bind(target),
    },
  });
  try {
    data.set(RECENT_SEARCHES_KEY, "not-json");
    assert.deepEqual(readRecentSearches(), []);
    rememberRecentSearch("Panadol");
    rememberRecentSearch("Brufen");
    rememberRecentSearch(" PANADOL ");
    assert.deepEqual(readRecentSearches(), [
      { query: "PANADOL" },
      { query: "Brufen" },
    ]);
    assert.deepEqual(
      JSON.parse(data.get(RECENT_SEARCHES_KEY)!),
      readRecentSearches(),
    );
    clearRecentSearches();
    assert.equal(data.has(RECENT_SEARCHES_KEY), false);
    denied = true;
    assert.doesNotThrow(() => rememberRecentSearch("دواء"));
    assert.deepEqual(readRecentSearches(), [{ query: "دواء" }]);
    assert.doesNotThrow(clearRecentSearches);
    assert.deepEqual(readRecentSearches(), []);
    assert.equal(changes, 6);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
