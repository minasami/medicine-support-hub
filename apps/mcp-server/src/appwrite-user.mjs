/**
 * Appwrite REST helpers for MCP user-scoped writes (API key).
 */
const ENDPOINT = () => process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const PROJECT = () => process.env.APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DATABASE = () => process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const API_KEY = () => process.env.APPWRITE_API_KEY || "";

const COL = {
  support: process.env.APPWRITE_MCP_SUPPORT_COLLECTION_ID || "mcp_support_requests",
  prescriptions: process.env.APPWRITE_PRESCRIPTIONS_COLLECTION_ID || "prescriptions",
  prescriptionItems: process.env.APPWRITE_PRESCRIPTION_ITEMS_COLLECTION_ID || "prescription_items",
  contributions: process.env.APPWRITE_DRUG_CONTRIBUTIONS_COLLECTION_ID || "drug_contributions",
  watchlist: process.env.APPWRITE_USER_WATCHLIST_COLLECTION_ID || "user_watchlist",
  medicines: process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines",
};

function headers() {
  const h = {
    "X-Appwrite-Project": PROJECT(),
    "Content-Type": "application/json",
  };
  const key = API_KEY();
  if (!key) {
    throw Object.assign(new Error("APPWRITE_API_KEY is required for user-scoped MCP writes"), {
      code: -32000,
    });
  }
  h["X-Appwrite-Key"] = key;
  return h;
}

function encodeQueries(queries) {
  return queries.map((q) => `queries[]=${encodeURIComponent(JSON.stringify(q))}`).join("&");
}

function uniqueId() {
  return `mcp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function createDocument(collectionId, data, documentId = uniqueId(), ownerUserId = null) {
  const url = `${ENDPOINT()}/databases/${DATABASE()}/collections/${collectionId}/documents`;
  const owner = ownerUserId || data.user_id || data.contributor_id || null;
  const permissions = owner
    ? [
        `read("user:${owner}")`,
        `update("user:${owner}")`,
        `delete("user:${owner}")`,
      ]
    : undefined;
  const res = await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      documentId,
      data,
      ...(permissions ? { permissions } : {}),
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    throw Object.assign(
      new Error(`Appwrite create ${collectionId}: ${res.status} ${json.message || text.slice(0, 200)}`),
      { code: -32000, status: res.status, body: json },
    );
  }
  return json;
}

async function listDocuments(collectionId, queries) {
  const qs = encodeQueries(queries);
  const url = `${ENDPOINT()}/databases/${DATABASE()}/collections/${collectionId}/documents?${qs}`;
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { message: text };
  }
  if (!res.ok) {
    throw Object.assign(
      new Error(`Appwrite list ${collectionId}: ${res.status} ${json.message || text.slice(0, 200)}`),
      { code: -32000, status: res.status, body: json },
    );
  }
  return json.documents || [];
}

export async function createSupportRequest(user, args) {
  const medicine_summary = String(args.medicine_summary || args.summary || "").trim();
  if (!medicine_summary) throw Object.assign(new Error("medicine_summary is required"), { code: -32602 });
  const now = new Date().toISOString();
  const doc = await createDocument(COL.support, {
    user_id: user.userId,
    medicine_summary: medicine_summary.slice(0, 2000),
    clinical_notes: String(args.clinical_notes || args.notes || "").slice(0, 4000) || undefined,
    priority: String(args.priority || "normal").slice(0, 32),
    status: "submitted",
    requested_months: args.requested_months != null ? Number(args.requested_months) : undefined,
    estimated_monthly_cost:
      args.estimated_monthly_cost != null ? Number(args.estimated_monthly_cost) : undefined,
    contact_phone: args.contact_phone ? String(args.contact_phone).slice(0, 64) : undefined,
    city: args.city ? String(args.city).slice(0, 128) : undefined,
    source: "mcp",
    created_at: now,
  });
  return {
    id: doc.$id,
    status: doc.status,
    medicine_summary: doc.medicine_summary,
    mapping:
      "Appwrite collection mcp_support_requests (MCP/NGO support). Web NGO pages still use Supabase support_requests for org workspaces.",
    view_url: `${process.env.PUBLIC_SITE_URL || "https://medicinesupport.app"}/account`,
  };
}

export async function listMyOpenRequests(user, { limit = 20 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const out = { support_requests: [], prescriptions: [], contributions: [] };

  try {
    out.support_requests = (
      await listDocuments(COL.support, [
        { method: "equal", attribute: "user_id", values: [user.userId] },
        { method: "orderDesc", attribute: "$createdAt" },
        { method: "limit", values: [cap] },
      ])
    ).map((d) => ({
      id: d.$id,
      kind: "support",
      status: d.status,
      medicine_summary: d.medicine_summary,
      priority: d.priority,
      created_at: d.created_at || d.$createdAt,
    }));
  } catch (e) {
    out.support_error = e.message;
  }

  try {
    out.prescriptions = (
      await listDocuments(COL.prescriptions, [
        { method: "equal", attribute: "user_id", values: [user.userId] },
        { method: "orderDesc", attribute: "$createdAt" },
        { method: "limit", values: [cap] },
      ])
    )
      .filter((d) => !/cancelled|fulfilled|closed/i.test(String(d.status || "")))
      .map((d) => ({
        id: d.$id,
        kind: "prescription",
        status: d.status,
        parse_source: d.parse_source,
        created_at: d.$createdAt,
        review_url: `${process.env.PUBLIC_SITE_URL || "https://medicinesupport.app"}/prescription/review/${d.$id}`,
      }));
  } catch (e) {
    out.prescriptions_error = e.message;
  }

  try {
    out.contributions = (
      await listDocuments(COL.contributions, [
        { method: "equal", attribute: "contributor_id", values: [user.userId] },
        { method: "equal", attribute: "status", values: ["pending"] },
        { method: "limit", values: [cap] },
      ])
    ).map((d) => ({
      id: d.$id,
      kind: "drug_contribution",
      status: d.status,
      barcode: d.barcode,
      name_en: d.name_en,
      created_at: d.created_at || d.$createdAt,
    }));
  } catch (e) {
    out.contributions_error = e.message;
  }

  return out;
}

export async function submitPrescriptionRequest(user, args) {
  const summary = String(args.summary || args.text || args.notes || "").trim();
  const image_id = args.image_id || args.storage_file_id || null;
  const image_url = args.image_url || args.file_url || null;
  const items = Array.isArray(args.items) ? args.items : [];

  if (!summary && !image_id && !image_url && !items.length) {
    throw Object.assign(
      new Error("Provide summary text and/or image_id/image_url, or items[]. Binary upload is not in MCP v1."),
      { code: -32602 },
    );
  }

  const site = process.env.PUBLIC_SITE_URL || "https://medicinesupport.app";
  const ai_parsed_json = JSON.stringify({
    source: "mcp",
    summary,
    items,
    submitted_at: new Date().toISOString(),
  });

  const rx = await createDocument(COL.prescriptions, {
    user_id: user.userId,
    image_id: image_id ? String(image_id).slice(0, 128) : undefined,
    image_url: image_url ? String(image_url).slice(0, 512) : undefined,
    status: image_id || image_url ? "uploaded" : "draft_mcp",
    ai_parsed_json: ai_parsed_json.slice(0, 16000),
    confidence_score: items.length ? 0.4 : 0,
    parse_source: "mcp_text",
  });

  const createdItems = [];
  for (const it of items.slice(0, 30)) {
    const drug_name = String(it.drug_name || it.name || "").trim();
    if (!drug_name) continue;
    try {
      const row = await createDocument(
        COL.prescriptionItems,
        {
          prescription_id: rx.$id,
          drug_name: drug_name.slice(0, 256),
          suggested_dose: it.dose || it.suggested_dose || undefined,
          frequency: it.frequency || undefined,
          duration: it.duration || undefined,
          confidence: Number(it.confidence) || 0,
          user_edited: true,
          status: "mcp",
        },
        uniqueId(),
        user.userId,
      );
      createdItems.push({ id: row.$id, drug_name });
    } catch {
      /* items collection may lag — prescription header is enough */
    }
  }

  return {
    id: rx.$id,
    status: rx.status,
    items_created: createdItems.length,
    upload_deeplink: `${site}/rx/upload`,
    review_url: `${site}/prescription/review/${rx.$id}`,
    note:
      "MCP v1 accepts text/summary + optional Appwrite storage file id/url. For camera/gallery binary upload, open upload_deeplink while signed in.",
  };
}

export async function submitDrugContribution(user, args) {
  const barcode = String(args.barcode || "").replace(/\D/g, "");
  const kind = String(args.kind || "create_product");
  if (barcode.length < 8) {
    throw Object.assign(new Error("barcode must be at least 8 digits"), { code: -32602 });
  }
  if (kind === "create_product" && !String(args.name_en || "").trim()) {
    throw Object.assign(new Error("name_en required for create_product"), { code: -32602 });
  }
  if (kind === "link_barcode" && !args.medicine_id && args.canonical_id == null) {
    throw Object.assign(new Error("medicine_id or canonical_id required for link_barcode"), { code: -32602 });
  }

  const payload = {
    barcode,
    kind,
    medicine_id: args.medicine_id || undefined,
    canonical_id: args.canonical_id ?? undefined,
    name_en: args.name_en?.trim?.() || args.name_en,
    name_ar: args.name_ar?.trim?.() || args.name_ar,
    manufacturer: args.manufacturer,
    scientific_name: args.scientific_name,
    notes: args.notes,
  };

  const doc = await createDocument(COL.contributions, {
    barcode,
    medicine_id: args.medicine_id || undefined,
    canonical_id:
      args.canonical_id != null && Number.isFinite(Number(args.canonical_id))
        ? Number(args.canonical_id)
        : undefined,
    kind,
    payload: JSON.stringify(payload).slice(0, 8000),
    contributor_id: user.userId,
    status: "pending",
    created_at: new Date().toISOString(),
    name_en: payload.name_en || undefined,
    name_ar: payload.name_ar || undefined,
    notes: args.notes ? String(args.notes).slice(0, 512) : undefined,
  });

  return {
    id: doc.$id,
    status: doc.status,
    barcode: doc.barcode,
    note: "Queued in drug_contributions; processContribution may auto-approve high TrustScore users.",
  };
}

export async function listMyWatchlist(user, { limit = 30 } = {}) {
  const cap = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const docs = await listDocuments(COL.watchlist, [
    { method: "equal", attribute: "user_id", values: [user.userId] },
    { method: "limit", values: [cap] },
  ]);
  return {
    count: docs.length,
    items: docs.map((d) => ({
      id: d.$id,
      query: d.query,
      medicine_id: d.medicine_id,
      canonical_id: d.canonical_id,
      name_en: d.name_en,
      name_ar: d.name_ar,
      target_price_egp: d.target_price_egp ?? null,
      active: d.active !== false,
      created_at: d.created_at || d.$createdAt,
    })),
  };
}

export async function addWatchlistItem(user, args) {
  const query = String(args.query || args.name || "").trim();
  const medicine_id = args.medicine_id || null;
  const canonical_id =
    args.canonical_id != null && Number.isFinite(Number(args.canonical_id))
      ? Number(args.canonical_id)
      : null;
  if (!query && !medicine_id && canonical_id == null) {
    throw Object.assign(new Error("query, medicine_id, or canonical_id required"), { code: -32602 });
  }
  const doc = await createDocument(COL.watchlist, {
    user_id: user.userId,
    query: query || undefined,
    medicine_id: medicine_id || undefined,
    canonical_id: canonical_id ?? undefined,
    name_en: args.name_en || query || undefined,
    name_ar: args.name_ar || undefined,
    target_price_egp: args.target_price_egp != null ? Number(args.target_price_egp) : undefined,
    active: true,
    created_at: new Date().toISOString(),
    source: "mcp",
  });
  return { id: doc.$id, query: doc.query, canonical_id: doc.canonical_id, medicine_id: doc.medicine_id };
}

export async function checkMyPriceAlerts(user) {
  const { items } = await listMyWatchlist(user, { limit: 50 });
  const alerts = [];
  for (const item of items.filter((i) => i.active !== false)) {
    let current = null;
    let match = null;
    try {
      if (item.medicine_id) {
        const url = `${ENDPOINT()}/databases/${DATABASE()}/collections/${COL.medicines}/documents/${encodeURIComponent(item.medicine_id)}`;
        const res = await fetch(url, { headers: headers() });
        if (res.ok) match = await res.json();
      } else if (item.canonical_id != null) {
        const docs = await listDocuments(COL.medicines, [
          { method: "equal", attribute: "canonical_id", values: [item.canonical_id] },
          { method: "limit", values: [1] },
        ]);
        match = docs[0] || null;
      } else if (item.query) {
        const docs = await listDocuments(COL.medicines, [
          { method: "search", attribute: "name_en", values: [item.query] },
          { method: "limit", values: [1] },
        ]);
        match = docs[0] || null;
      }
    } catch {
      /* skip */
    }
    if (match) {
      const price = Number(match.current_price_egp);
      current = Number.isFinite(price) && price > 0 ? price : null;
    }
    const target = item.target_price_egp != null ? Number(item.target_price_egp) : null;
    alerts.push({
      watch_id: item.id,
      query: item.query || item.name_en,
      current_price_egp: current,
      target_price_egp: target,
      triggered: target != null && current != null && current <= target,
      medicine_id: match?.$id || item.medicine_id || null,
      name_en: match?.name_en || item.name_en || null,
    });
  }
  return {
    count: alerts.length,
    triggered: alerts.filter((a) => a.triggered),
    items: alerts,
    disclaimer_en:
      "Account-scoped catalog price checks — not live pharmacy shelf prices.",
  };
}

export { COL };
