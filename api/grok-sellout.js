import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyCors,
  errorStatus,
  parseBody,
  requirePlatformAdmin,
  sendJson,
} from "./_platform-server.js";

const SNAPSHOT_PATHS = [
  join(process.cwd(), "apps/web/src/data/sellout-mounjaro.json"),
  join(process.cwd(), "src/data/sellout-mounjaro.json"),
];

function loadSnapshot() {
  for (const path of SNAPSHOT_PATHS) {
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      /* try next */
    }
  }
  throw new Error("Sell-out snapshot is not on this deployment.");
}

function compactSnapshot(data) {
  return {
    brand: data.brand,
    inn: data.inn,
    period: data.period,
    currency: data.currency,
    unit_value_egp: data.unit_value_egp,
    totals: data.totals,
    monthly: data.monthly,
    sku: data.sku,
    distributor: data.distributor,
    channel: data.channel,
    top_account_share: data.top_account_share,
    top_accounts: (data.top_accounts || []).map((row) => ({
      rank: row.rank,
      units: row.units,
      share: row.share,
    })),
    top_bricks: data.top_bricks,
    calls: data.calls,
    disclaimer_en: data.disclaimer_en,
  };
}

function fallbackBriefing(data) {
  const net = data.totals.net_units;
  const march = data.monthly.find((m) => String(m.month).endsWith("-03"));
  return {
    headline_en: `${data.brand} net ${Math.round(net)} units (${data.period.from}–${data.period.to}); one account is ${(data.top_account_share * 100).toFixed(1)}% of net.`,
    headline_ar: `صافي ${data.brand} ${Math.round(net)} وحدة (${data.period.from}–${data.period.to})؛ حساب واحد = ${(data.top_account_share * 100).toFixed(1)}% من الصافي.`,
    bullets_en: data.calls || [],
    bullets_ar: [
      "مارس ليس معدل تشغيل: التركيز عال.",
      "7.5 ملغ شبه غائب حتى أبريل.",
      `المرتجع حوالي ${(data.totals.return_rate_of_gross * 100).toFixed(1)}% من الإجمالي.`,
      "نصر سيتي تهيمن الجغرافيا لا السوق القومي.",
    ],
    caution_en: data.disclaimer_en,
    caution_ar: data.disclaimer_ar,
    source: "local_snapshot",
    march_units: march?.units ?? null,
  };
}

function extractOutputText(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string") return payload.output_text;
  const choice = payload.choices?.[0]?.message?.content;
  if (typeof choice === "string") return choice;
  if (Array.isArray(payload.output)) {
    const bits = [];
    for (const item of payload.output) {
      for (const part of item?.content || []) {
        if (typeof part?.text === "string") bits.push(part.text);
      }
    }
    return bits.join("\n");
  }
  return "";
}

async function callGrok(snapshot) {
  const apiKey = String(process.env.XAI_API_KEY || "").trim();
  if (!apiKey) return { briefing: fallbackBriefing(snapshot), configured: false };

  const model = String(process.env.XAI_MODEL || "grok-4-1-fast-reasoning").trim();
  const schema = {
    type: "object",
    additionalProperties: false,
    required: [
      "headline_en",
      "headline_ar",
      "bullets_en",
      "bullets_ar",
      "caution_en",
      "caution_ar",
    ],
    properties: {
      headline_en: { type: "string" },
      headline_ar: { type: "string" },
      bullets_en: { type: "array", items: { type: "string" } },
      bullets_ar: { type: "array", items: { type: "string" } },
      caution_en: { type: "string" },
      caution_ar: { type: "string" },
    },
  };

  const body = {
    model,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You brief Egyptian pharma ops. Use only the JSON snapshot. Never invent customer names. Never give clinical advice or a pharmacy price quote. Output JSON only.",
      },
      {
        role: "user",
        content: `Write a bilingual internal briefing from this sell-out snapshot:\n${JSON.stringify(compactSnapshot(snapshot))}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "sellout_briefing", schema, strict: true },
    },
  };

  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`xAI HTTP ${response.status}: ${text.slice(0, 240)}`);
    error.statusCode = 502;
    throw error;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {};
  }
  const raw = extractOutputText(parsed);
  let briefing;
  try {
    briefing = JSON.parse(raw);
  } catch {
    briefing = fallbackBriefing(snapshot);
    briefing.headline_en = raw.slice(0, 400) || briefing.headline_en;
    briefing.source = "grok_unparsed";
  }
  briefing.source = briefing.source || "grok";
  briefing.model = model;
  return { briefing, configured: true, model };
}

export default async function handler(request, response) {
  applyCors(request, response);
  if (request.method === "OPTIONS") return sendJson(response, 204, {}, request);

  if (request.method === "GET") {
    return sendJson(
      response,
      200,
      {
        configured: Boolean(String(process.env.XAI_API_KEY || "").trim()),
        model: String(process.env.XAI_MODEL || "grok-4-1-fast-reasoning"),
        endpoint: "/api/grok-sellout",
      },
      request,
    );
  }

  if (request.method !== "POST") {
    return sendJson(response, 405, { message: "GET status or POST briefing." }, request);
  }

  try {
    await requirePlatformAdmin(request);
    const snapshot = loadSnapshot();
    const result = await callGrok(snapshot);
    return sendJson(
      response,
      200,
      {
        ok: true,
        ...result,
        period: snapshot.period,
        brand: snapshot.brand,
      },
      request,
    );
  } catch (error) {
    console.error("grok-sellout", error);
    return sendJson(
      response,
      errorStatus(error),
      { message: error instanceof Error ? error.message : "Briefing failed." },
      request,
    );
  }
}
