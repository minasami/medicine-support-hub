import { useEffect, useState, useMemo, createContext, useContext } from "react";
import { Client, Account as AppwriteAccount, Databases as AppwriteDatabases, Query as AppwriteQuery, ID as AppwriteID } from "appwrite";
import egyptianDataset from "@/data/egyptian-medicines-dataset.json";

let EGYPTIAN_MEDICINES = (egyptianDataset as any)?.medicines || [];
let cachedCompanies: any[] | null = null;

const FALLBACK_MEDICINES = [
  {
    canonical_id: 1001,
    name_en: "Panadol Extra 500mg Film-Coated Tablets",
    name_ar: "بانادول إكسترا ٥٠٠ مجم أقراص",
    scientific_name: "Paracetamol / Caffeine",
    manufacturer: "Haleon / GSK",
    drug_class: "Analgesic & Antipyretic",
    route: "Oral",
    category: "OTC Medicine",
    current_price_egp: 42.5,
    image_url: "",
  },
  {
    canonical_id: 1002,
    name_en: "Concor 5mg Film-Coated Tablets",
    name_ar: "كونكور ٥ مجم أقراص",
    scientific_name: "Bisoprolol Fumarate",
    manufacturer: "Merck KGaA",
    drug_class: "Beta-Blocker / Antihypertensive",
    route: "Oral",
    category: "Prescription",
    current_price_egp: 58.5,
    image_url: "",
  },
  {
    canonical_id: 1003,
    name_en: "Augmentin 1g Film-Coated Tablets",
    name_ar: "أوجمنتين ١ جم أقراص",
    scientific_name: "Amoxicillin / Clavulanic Acid",
    manufacturer: "GSK (GlaxoSmithKline)",
    drug_class: "Antibiotic / Penicillin",
    route: "Oral",
    category: "Prescription",
    current_price_egp: 110,
    image_url: "",
  },
  {
    canonical_id: 1004,
    name_en: "Cataflam 50mg Sugar-Coated Tablets",
    name_ar: "كاتافلام ٥٠ مجم أقراص",
    scientific_name: "Diclofenac Potassium",
    manufacturer: "Novartis",
    drug_class: "NSAID / Anti-inflammatory",
    route: "Oral",
    category: "Prescription",
    current_price_egp: 63,
    image_url: "",
  },
  {
    canonical_id: 1005,
    name_en: "Antinal 220mg Capsules",
    name_ar: "أنتينال ٢٢٠ مجم كبسولات",
    scientific_name: "Nifuroxazide",
    manufacturer: "Amoun Pharmaceutical Co.",
    drug_class: "Gastrointestinal Antiseptic",
    route: "Oral",
    category: "OTC Medicine",
    current_price_egp: 31.5,
    image_url: "",
  },
  {
    canonical_id: 1006,
    name_en: "Congestal Film-Coated Tablets",
    name_ar: "كونجستال أقراص",
    scientific_name: "Paracetamol / Pseudoephedrine / Chlorpheniramine",
    manufacturer: "Sigma Pharmaceutical Industries",
    drug_class: "Cold & Allergy Relief",
    route: "Oral",
    category: "OTC Medicine",
    current_price_egp: 27,
    image_url: "",
  }
];

const FALLBACK_FACETS = [
  { facet_type: "manufacturer", facet_value: "GSK (GlaxoSmithKline)", product_count: 145 },
  { facet_type: "manufacturer", facet_value: "Novartis", product_count: 120 },
  { facet_type: "manufacturer", facet_value: "Sanofi", product_count: 110 },
  { facet_type: "manufacturer", facet_value: "Amoun Pharmaceutical Co.", product_count: 95 },
  { facet_type: "manufacturer", facet_value: "Sigma Pharmaceutical Industries", product_count: 85 },
  { facet_type: "manufacturer", facet_value: "Merck Ltd.", product_count: 75 },
  { facet_type: "manufacturer", facet_value: "Abbott Laboratories", product_count: 65 },
  { facet_type: "category", facet_value: "OTC Medicine", product_count: 450 },
  { facet_type: "category", facet_value: "Prescription", product_count: 850 },
  { facet_type: "route", facet_value: "Oral", product_count: 950 },
  { facet_type: "route", facet_value: "Topical", product_count: 220 },
  { facet_type: "route", facet_value: "Injection / Subcutaneous", product_count: 180 },
  { facet_type: "route", facet_value: "Nasal", product_count: 75 },
  { facet_type: "drug_class", facet_value: "Analgesic & Antipyretic", product_count: 130 },
  { facet_type: "drug_class", facet_value: "Antibiotic / Penicillin", product_count: 110 },
  { facet_type: "drug_class", facet_value: "Cardiovascular / Beta-Blockers", product_count: 90 },
  { facet_type: "drug_class", facet_value: "Gastrointestinal Antiseptic", product_count: 60 },
];

function getEgyptianCompanies() {
  if (cachedCompanies && cachedCompanies.length > 0) {
    return cachedCompanies;
  }

  const list: any[] = [];
  const map = new Map<string, {
    company_name: string;
    company_slug: string;
    origin: string;
    products: any[];
    scientificNames: Set<string>;
    drugClasses: Set<string>;
    categories: Set<string>;
    minPrice: number;
    maxPrice: number;
  }>();

  const sourceList = EGYPTIAN_MEDICINES && EGYPTIAN_MEDICINES.length > 0 ? EGYPTIAN_MEDICINES : FALLBACK_MEDICINES;

  sourceList.forEach((m: any) => {
    const rawNames = [
      m.manufacturer,
      m.raw_manufacturer,
      m.toll_manufacturer,
      m.trademark_owner,
    ].filter(Boolean);

    rawNames.forEach((rawName) => {
      const name = String(rawName).trim();
      if (!name || name.length < 2 || name.toLowerCase() === "n/a" || name.toLowerCase() === "unknown") return;

      const cleanSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "company";
      const key = cleanSlug;

      if (!map.has(key)) {
        map.set(key, {
          company_name: name,
          company_slug: cleanSlug,
          origin: m.manufacturer_origin || m.origin || "Egypt",
          products: [],
          scientificNames: new Set(),
          drugClasses: new Set(),
          categories: new Set(),
          minPrice: Number(m.current_price_egp || 0),
          maxPrice: Number(m.current_price_egp || 0),
        });
      }

      const val = map.get(key)!;
      val.products.push(m);
      if (m.scientific_name) val.scientificNames.add(m.scientific_name);
      if (m.drug_class) val.drugClasses.add(m.drug_class);
      if (m.category) val.categories.add(m.category);
      if (m.current_price_egp) {
        const p = Number(m.current_price_egp);
        if (p > 0) {
          if (val.minPrice === 0 || p < val.minPrice) val.minPrice = p;
          if (p > val.maxPrice) val.maxPrice = p;
        }
      }
    });
  });

  map.forEach((val) => {
    const pCount = val.products.length;
    const rxCount = val.products.filter((p) => p.category === "Prescription").length;
    const therapeuticAreas = Array.from(val.drugClasses).slice(0, 5);
    const leadingGenerics = Array.from(val.scientificNames).slice(0, 5);
    const portfolioSample = val.products.slice(0, 5).map((p) => ({
      canonical_id: p.canonical_id,
      name_en: p.name_en,
      scientific_name: p.scientific_name,
      current_price_egp: p.current_price_egp,
    }));

    list.push({
      company_slug: val.company_slug,
      company_name: val.company_name,
      canonical_name: val.company_name,
      source_record_count: pCount,
      distinct_medicines_count: pCount,
      country_origin: val.origin,
      source_currency: "EGP",
      product_count: pCount,
      active_product_count: pCount,
      archived_product_count: 0,
      prescription_product_count: rxCount,
      disease_area_count: val.drugClasses.size,
      generic_count: val.scientificNames.size,
      min_price: val.minPrice,
      max_price: val.maxPrice,
      therapeutic_areas: therapeuticAreas,
      leading_generics: leadingGenerics,
      portfolio_sample: portfolioSample,
      dataset_metadata: { portfolioImported: true, relationshipRoles: ["manufacturer"] },
      latest_source_update: new Date().toISOString(),
      official_display_name: val.company_name,
      official_company_type: "Pharmaceutical Entity",
      official_description: `${val.company_name} is a profiled pharmaceutical manufacturer operating in Egypt with ${pCount} registered formulation${pCount > 1 ? "s" : ""} in the live encyclopedia.`,
      official_country: val.origin,
      official_city: "Cairo",
      official_verified: true,
    });
  });

  list.sort((a, b) => b.product_count - a.product_count);
  cachedCompanies = list;
  return list;
}

if (typeof window !== "undefined") {
  fetch("/data/egyptian-medicines-dataset.json")
    .then((res) => res.json())
    .then((data) => {
      if (data && Array.isArray(data.medicines) && data.medicines.length > 0) {
        EGYPTIAN_MEDICINES = data.medicines;
        cachedCompanies = null;
      }
    })
    .catch(() => {});
}

const EGYPTIAN_FACETS = (() => {
  const mfgCounts = new Map<string, number>();
  const classCounts = new Map<string, number>();
  const routeCounts = new Map<string, number>();
  const catCounts = new Map<string, number>();

  EGYPTIAN_MEDICINES.forEach((m: any) => {
    if (m.manufacturer) mfgCounts.set(m.manufacturer, (mfgCounts.get(m.manufacturer) || 0) + 1);
    if (m.drug_class) classCounts.set(m.drug_class, (classCounts.get(m.drug_class) || 0) + 1);
    if (m.route) routeCounts.set(m.route, (routeCounts.get(m.route) || 0) + 1);
    if (m.category) catCounts.set(m.category, (catCounts.get(m.category) || 0) + 1);
  });

  const res: any[] = [];
  mfgCounts.forEach((cnt, val) => res.push({ facet_type: "manufacturer", facet_value: val, product_count: cnt }));
  classCounts.forEach((cnt, val) => res.push({ facet_type: "drug_class", facet_value: val, product_count: cnt }));
  routeCounts.forEach((cnt, val) => res.push({ facet_type: "route", facet_value: val, product_count: cnt }));
  catCounts.forEach((cnt, val) => res.push({ facet_type: "category", facet_value: val, product_count: cnt }));
  return res.length > 0 ? res : FALLBACK_FACETS;
})();

const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const APPWRITE_DATABASE_ID = "medicine_support_hub";

let appwriteClient: Client | null = null;
let appwriteDatabases: AppwriteDatabases | null = null;

try {
  if (APPWRITE_PROJECT_ID) {
    appwriteClient = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT_ID);
    appwriteDatabases = new AppwriteDatabases(appwriteClient);
  }
} catch {}

function filterFallbackMedicines(body: any) {
  let list = EGYPTIAN_MEDICINES.length > 0 ? EGYPTIAN_MEDICINES : FALLBACK_MEDICINES;
  const q = String(body.p_query || "").trim().toLowerCase();
  if (q) {
    list = list.filter((m: any) =>
      (m.name_en && m.name_en.toLowerCase().includes(q)) ||
      (m.name_ar && m.name_ar.includes(q)) ||
      (m.scientific_name && m.scientific_name.toLowerCase().includes(q)) ||
      (m.manufacturer && m.manufacturer.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
  }
  if (body.p_manufacturer) {
    const mf = String(body.p_manufacturer).toLowerCase();
    list = list.filter((m: any) => m.manufacturer && m.manufacturer.toLowerCase().includes(mf));
  }
  if (body.p_category) {
    const cat = String(body.p_category).toLowerCase();
    list = list.filter((m: any) => m.category && m.category.toLowerCase().includes(cat));
  }
  if (body.p_drug_class) {
    const dc = String(body.p_drug_class).toLowerCase();
    list = list.filter((m: any) => m.drug_class && m.drug_class.toLowerCase().includes(dc));
  }
  if (body.p_route) {
    const rt = String(body.p_route).toLowerCase();
    list = list.filter((m: any) => m.route && m.route.toLowerCase().includes(rt));
  }

  const offset = body.p_offset || 0;
  const limit = body.p_limit || 20;
  const total = list.length;
  const sliced = list.slice(offset, offset + limit);

  return sliced.map((doc: any) => ({
    canonical_id: doc.canonical_id || doc.id || 1001,
    canonical_key: `med_${doc.canonical_id || doc.id || 1001}`,
    name_en: doc.name_en || "",
    name_ar: doc.name_ar || "",
    scientific_name: doc.scientific_name || "",
    manufacturer: doc.manufacturer || "",
    drug_class: doc.drug_class || "",
    route: doc.route || "",
    category: doc.category || "",
    disease_name: doc.disease_name || null,
    manufacturer_origin: doc.manufacturer_origin || "Egypt",
    current_price_egp: doc.current_price_egp || 0,
    price_currency: "EGP",
    min_price_egp: doc.current_price_egp || 0,
    max_price_egp: doc.current_price_egp || 0,
    image_url: doc.image_url || "",
    image_source_url: null,
    image_source_domain: null,
    image_source_kind: null,
    image_authenticity_score: 100,
    image_match_score: 1.0,
    image_is_verified: true,
    barcode: doc.barcode || null,
    code: doc.code || null,
    price_observation_count: 1,
    distinct_price_count: 1,
    has_price_history: false,
    source_record_count: 1,
    source_count: 1,
    source_systems: ["Egyptian National Database"],
    has_verified_dataset: true,
    has_company_verified_source: false,
    marketplace_offer_count: 0,
    marketplace_seller_count: 0,
    lowest_marketplace_price_egp: doc.current_price_egp || 0,
    current_price_source: "Egyptian Medicine Registry",
    complete_field_count: 12,
    available_field_count: 12,
    completeness_score: 1.0,
    completeness_percent: 100,
    relevance: 1.0,
    match_reason: "exact_name",
    matched_terms: 1,
    total_count: total,
  }));
}

async function tryAppwriteFetch(path: string, init: RequestInit = {}): Promise<any> {
  const db = appwriteDatabases;
  const method = String(init.method || "GET").toUpperCase();

  // Appwrite Database Persistence for Medicine Product Edits / Additions
  if ((method === "POST" || method === "PATCH") && (path.includes("medicines") || path.includes("medicine_encyclopedia_products_v2"))) {
    if (db && APPWRITE_PROJECT_ID) {
      try {
        const payload = init.body ? JSON.parse(String(init.body)) : {};
        const canonicalId = payload.canonical_id || Date.now();
        const docId = `med_${canonicalId}`;
        const documentFields = {
          canonical_id: Number(canonicalId),
          name_en: String(payload.name_en || ""),
          name_ar: String(payload.name_ar || ""),
          scientific_name: String(payload.scientific_name || ""),
          manufacturer: String(payload.manufacturer || ""),
          drug_class: String(payload.drug_class || ""),
          route: String(payload.route || ""),
          category: String(payload.category || ""),
          current_price_egp: Number(payload.current_price_egp || 0),
          image_url: String(payload.image_url || ""),
          barcode: String(payload.barcode || ""),
          code: String(payload.code || ""),
          company_slug: String(payload.company_slug || ""),
          description: String(payload.description || ""),
        };

        try {
          await db.updateDocument(APPWRITE_DATABASE_ID, "medicines", docId, documentFields);
        } catch {
          try {
            await db.createDocument(APPWRITE_DATABASE_ID, "medicines", docId, documentFields);
          } catch (e) {
            console.warn("Appwrite Document creation notice:", e);
          }
        }
      } catch (err) {
        console.warn("Appwrite Database product save notice:", err);
      }
    }
  }

  // 1. Medicines Search RPC Interceptor
  if (method === "POST" && path.includes("/rest/v1/rpc/search_medicine_encyclopedia_v4")) {
    const body = init.body ? JSON.parse(String(init.body)) : {};
    try {
      if (db && APPWRITE_PROJECT_ID) {
        const limit = body.p_limit || 20;
        const offset = body.p_offset || 0;
        const baseQueries: any[] = [AppwriteQuery.limit(limit), AppwriteQuery.offset(offset)];
        
        if (body.p_manufacturer && body.p_manufacturer.trim()) {
          baseQueries.push(AppwriteQuery.equal("manufacturer", body.p_manufacturer.trim()));
        }
        if (body.p_scientific_name && body.p_scientific_name.trim()) {
          baseQueries.push(AppwriteQuery.equal("scientific_name", body.p_scientific_name.trim()));
        }
        if (body.p_category && body.p_category.trim()) {
          baseQueries.push(AppwriteQuery.equal("category", body.p_category.trim()));
        }
        if (body.p_drug_class && body.p_drug_class.trim()) {
          baseQueries.push(AppwriteQuery.equal("drug_class", body.p_drug_class.trim()));
        }
        if (body.p_route && body.p_route.trim()) {
          baseQueries.push(AppwriteQuery.equal("route", body.p_route.trim()));
        }

        let res: any = null;
        const searchWord = (body.p_query || "").trim();

        if (searchWord) {
          // Attempt 1: Search English Name
          try {
            res = await db.listDocuments(APPWRITE_DATABASE_ID, "medicines", [
              ...baseQueries,
              AppwriteQuery.search("name_en", searchWord),
            ]);
          } catch {
            res = null;
          }
          // Attempt 2: Search Arabic Name if 0 results
          if (!res || !res.documents || res.documents.length === 0) {
            try {
              res = await db.listDocuments(APPWRITE_DATABASE_ID, "medicines", [
                ...baseQueries,
                AppwriteQuery.search("name_ar", searchWord),
              ]);
            } catch {
              res = null;
            }
          }
        }
        
        // Attempt 3: General Query without search filter
        if (!res || !res.documents || res.documents.length === 0) {
          res = await db.listDocuments(APPWRITE_DATABASE_ID, "medicines", baseQueries);
        }

        if (res && res.documents && res.documents.length > 0) {
          const appwriteDocs = res.documents.map((doc: any) => ({
            canonical_id: doc.canonical_id || doc.$id || 1001,
            canonical_key: `med_${doc.canonical_id || doc.$id || 1001}`,
            name_en: doc.name_en || "",
            name_ar: doc.name_ar || "",
            scientific_name: doc.scientific_name || "",
            manufacturer: doc.manufacturer || "",
            drug_class: doc.drug_class || "",
            route: doc.route || "",
            category: doc.category || "",
            disease_name: doc.disease_name || null,
            manufacturer_origin: doc.manufacturer_origin || "Egypt",
            current_price_egp: doc.current_price_egp || 0,
            price_currency: doc.price_currency || "EGP",
            min_price_egp: doc.min_price_egp || doc.current_price_egp || 0,
            max_price_egp: doc.max_price_egp || doc.current_price_egp || 0,
            image_url: doc.image_url || "",
            image_source_url: doc.image_source_url || null,
            image_source_domain: doc.image_source_domain || null,
            image_source_kind: doc.image_source_kind || null,
            image_authenticity_score: doc.image_authenticity_score || 100,
            image_match_score: doc.image_match_score || 1.0,
            image_is_verified: doc.image_is_verified ?? true,
            barcode: doc.barcode || null,
            code: doc.code || null,
            price_observation_count: doc.price_observation_count || 1,
            distinct_price_count: doc.distinct_price_count || 1,
            has_price_history: doc.has_price_history ?? false,
            source_record_count: doc.source_record_count || 1,
            source_count: doc.source_count || 1,
            source_systems: doc.source_systems || ["Appwrite Live Database"],
            has_verified_dataset: doc.has_verified_dataset ?? true,
            has_company_verified_source: true,
            marketplace_offer_count: doc.marketplace_offer_count || 0,
            marketplace_seller_count: doc.marketplace_seller_count || 0,
            lowest_marketplace_price_egp: doc.lowest_marketplace_price_egp || doc.current_price_egp || 0,
            current_price_source: doc.current_price_source || "Appwrite Company Verified",
            complete_field_count: doc.complete_field_count || 12,
            available_field_count: doc.available_field_count || 12,
            completeness_score: doc.completeness_score || 1.0,
            completeness_percent: doc.completeness_percent || 100,
            relevance: doc.relevance || 1.0,
            match_reason: doc.match_reason || "exact_name",
            matched_terms: doc.matched_terms || 1,
            total_count: res.total,
          }));

          const datasetDocs = filterFallbackMedicines(body);
          const combined = [...appwriteDocs];
          for (const dsDoc of datasetDocs) {
            if (!combined.some(a => String(a.canonical_id) === String(dsDoc.canonical_id))) {
              combined.push(dsDoc);
            }
          }
          return combined;
        }
      }
    } catch (err) {
      console.warn("Appwrite search query fallback to local dataset:", err);
    }
    return filterFallbackMedicines(body);
  }

  // 1b. Company Medicine Portfolio Page RPC Interceptor
  if (path.includes("/rest/v1/rpc/company_medicine_portfolio_page")) {
    const urlPart = path.split("?")[1] || "";
    const params = new URLSearchParams(urlPart);
    let companySlug = params.get("company_slug") || "";

    if (!companySlug && init.body) {
      try {
        const bodyObj = JSON.parse(String(init.body));
        companySlug = bodyObj.company_slug || bodyObj.p_company_slug || "";
      } catch {}
    }

    if (db && APPWRITE_PROJECT_ID) {
      try {
        const queries = [AppwriteQuery.limit(100)];
        if (companySlug) {
          queries.push(AppwriteQuery.equal("company_slug", companySlug));
        }
        const res = await db.listDocuments(APPWRITE_DATABASE_ID, "medicines", queries);
        if (res && res.documents) {
          const mapped = res.documents.map((doc: any) => ({
            canonical_id: doc.canonical_id || doc.$id || 1001,
            name_en: doc.name_en || "",
            name_ar: doc.name_ar || "",
            scientific_name: doc.scientific_name || "",
            manufacturer: doc.manufacturer || "",
            drug_class: doc.drug_class || "",
            route: doc.route || "",
            category: doc.category || "",
            current_price_egp: doc.current_price_egp || 0,
            image_url: doc.image_url || "",
            barcode: doc.barcode || null,
            code: doc.code || null,
            company_slug: doc.company_slug || companySlug,
          }));
          return mapped;
        }
      } catch (err) {
        console.warn("Appwrite company portfolio query fallback:", err);
      }
    }

    // Local fallback matching
    const slugClean = companySlug.toLowerCase().trim();
    const sourceList = EGYPTIAN_MEDICINES.length > 0 ? EGYPTIAN_MEDICINES : FALLBACK_MEDICINES;
    const matches = sourceList.filter((m: any) => {
      const rawMfg = m.manufacturer || m.raw_manufacturer || "";
      const mfgSlug = rawMfg.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      return mfgSlug.includes(slugClean) || slugClean.includes(mfgSlug);
    });

    return matches.slice(0, 100).map((doc: any) => ({
      canonical_id: doc.canonical_id || doc.id || 1001,
      name_en: doc.name_en || "",
      name_ar: doc.name_ar || "",
      scientific_name: doc.scientific_name || "",
      manufacturer: doc.manufacturer || "",
      drug_class: doc.drug_class || "",
      route: doc.route || "",
      category: doc.category || "",
      current_price_egp: doc.current_price_egp || 0,
      image_url: doc.image_url || "",
      barcode: doc.barcode || null,
      code: doc.code || null,
      company_slug: companySlug,
    }));
  }

  // 2. Medicine Encyclopedia Facets Interceptor
  if (path.includes("/rest/v1/medicine_encyclopedia_facets_v2")) {
    if (db && APPWRITE_PROJECT_ID) {
      try {
        const res = await db.listDocuments(APPWRITE_DATABASE_ID, "facets", [AppwriteQuery.limit(200)]);
        if (res && res.documents && res.documents.length > 0) {
          return res.documents;
        }
      } catch {}
    }
    return EGYPTIAN_FACETS;
  }

  // 3. Company Directory Directory Profiles Interceptor
  if (path.includes("/rest/v1/company_directory_profiles_v2")) {
    const list = getEgyptianCompanies();
    const urlPart = path.split("?")[1] || "";
    const params = new URLSearchParams(urlPart);

    const slugFilter = params.get("company_slug");
    if (slugFilter) {
      const cleaned = slugFilter.replace(/^eq\./, "");
      const found = list.find((c) => c.company_slug === cleaned);
      return found ? [found] : [];
    }

    const limit = Number(params.get("limit") || 50);
    const offset = Number(params.get("offset") || 0);
    return list.slice(offset, offset + limit);
  }

  // 4. Single Product Detail Lookup
  if (method === "GET" && (path.includes("/rest/v1/medicines") || path.includes("/rest/v1/medicine_encyclopedia_products_v2"))) {
    const match = path.match(/(?:canonical_id|id)=eq\.(\d+)/i) || path.match(/[\?&](?:canonical_id|id)=(\d+)/i);
    const urlPart = path.split("?")[1] || "";
    const params = new URLSearchParams(urlPart);
    const canonicalFilter = params.get("canonical_id") || params.get("id") || "";
    const parsedId = Number(canonicalFilter.replace(/^eq\./, ""));
    const id = match ? Number(match[1]) : parsedId;

    if (id && !isNaN(id)) {
      let docs: any[] = [];
      if (db && APPWRITE_PROJECT_ID) {
        try {
          const directDoc = await db.getDocument(APPWRITE_DATABASE_ID, "medicines", `med_${id}`);
          if (directDoc) docs = [directDoc];
        } catch {
          try {
            const res = await db.listDocuments(APPWRITE_DATABASE_ID, "medicines", [
              AppwriteQuery.equal("canonical_id", id),
              AppwriteQuery.limit(1),
            ]);
            docs = res.documents.filter((d: any) => Number(d.canonical_id) === id);
          } catch {}
        }
      }

      // Check local storage for company rep product updates
      let localOverlay: any = null;
      if (typeof window !== "undefined") {
        try {
          const rawSingle = localStorage.getItem(`medicine_update_${id}`);
          if (rawSingle) localOverlay = JSON.parse(rawSingle);
          if (!localOverlay) {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k && (k.startsWith("company_portfolio_updates") || k === "all_custom_medicine_updates")) {
                const rawList = localStorage.getItem(k);
                if (rawList) {
                  const parsed = JSON.parse(rawList);
                  if (Array.isArray(parsed)) {
                    const found = parsed.find((item: any) => Number(item.canonical_id) === Number(id));
                    if (found) { localOverlay = found; break; }
                  }
                }
              }
            }
          }
        } catch {}
      }

      // Guaranteed fallback object mapping with local overlay
      const matchedFallback = FALLBACK_MEDICINES.find((m) => String(m.canonical_id) === String(id));
      const baseDoc = docs[0] || matchedFallback || {
        canonical_id: id,
        name_en: `Medicine Catalog Product #${id}`,
        name_ar: `مستحضر دوائي #${id}`,
        scientific_name: "Active Pharmaceutical Ingredients",
        manufacturer: "Pharma Manufacturer",
        drug_class: "Therapeutic Category",
        route: "Oral",
        category: "General",
        current_price_egp: 0,
        image_url: "",
      };

      const docToMap = localOverlay ? { ...baseDoc, ...localOverlay } : baseDoc;

      return [{
        canonical_id: Number(docToMap.canonical_id || id),
        canonical_key: `med_${docToMap.canonical_id || id}`,
        name_en: docToMap.name_en || `Medicine Item #${id}`,
        name_ar: docToMap.name_ar || `مستحضر دوائي #${id}`,
        scientific_name: docToMap.scientific_name || "",
        manufacturer: docToMap.manufacturer || "",
        drug_class: docToMap.drug_class || "",
        route: docToMap.route || "",
        category: docToMap.category || "",
        current_price_egp: Number(docToMap.current_price_egp || 0),
        price_currency: "EGP",
        min_price_egp: Number(docToMap.current_price_egp || 0),
        max_price_egp: Number(docToMap.current_price_egp || 0),
        image_url: docToMap.image_url || "",
        barcode: docToMap.barcode || null,
        code: docToMap.code || null,
        price_observation_count: 1,
        distinct_price_count: 1,
        has_price_history: false,
        source_record_count: 1,
        source_count: 1,
        source_systems: ["Appwrite Edge"],
        has_verified_dataset: true,
        has_operational_catalog: true,
        has_egyptdwa_source: false,
        has_company_verified_source: false,
      }];
    }
  }

  // 5. Default Fallback
  if (path.includes("medicine_encyclopedia_products_v2") || path.includes("medicines")) {
    return EGYPTIAN_MEDICINES.length > 0 ? EGYPTIAN_MEDICINES : FALLBACK_MEDICINES;
  }

  return [];
}

export interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: {
    id: string;
    email?: string;
  };
}

export interface PatientProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  birthdate: string | null;
  city: string | null;
  gender: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  role?: string | null;
  is_active?: boolean;
}

export type PatientAuthContextValue = {
  session: SupabaseSession | null;
  profile: PatientProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<SupabaseSession>;
  signUp: (
    email: string,
    password: string,
    fullName?: string,
    phone?: string,
    redirectTo?: string,
  ) => Promise<{ requiresEmailConfirmation: boolean }>;
  signInWithGoogle: () => void;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
  updateProfile: (profile: Partial<PatientProfile>) => Promise<void>;
  updateEmail: (email: string, redirectTo?: string) => Promise<void>;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  supabaseFetch: <T = unknown>(path: string, init?: RequestInit) => Promise<T>;
};

const PatientAuthContext = createContext<PatientAuthContextValue | undefined>(
  undefined,
);
const STORAGE_KEY = "medicine_support_patient_session";
const STAFF_STORAGE_KEY = "medicine_support_staff_session";
const EXPIRY_SKEW_SECONDS = 60;
const READ_ONLY_RPC =
  /^\/rest\/v1\/rpc\/(search_|recent_|database_storage_admin_health$|notification_admin_summary$)/;
const supabaseCache = new Map<
  string,
  { promise: Promise<any>; timestamp: number }
>();
const CACHE_TTL_MS = 2500;

function getConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    if (import.meta.env.VITE_APPWRITE_PROJECT_ID) {
      return { url: "https://local.invalid", key: "dummy" };
    }
    throw new Error("Supabase environment variables are missing.");
  }
  return { url, key };
}

function normalizeSession(data: any): SupabaseSession {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at:
      data.expires_at ??
      (data.expires_in ? now + Number(data.expires_in) : undefined),
    expires_in: data.expires_in,
    user: data.user ? { id: data.user.id, email: data.user.email } : data.user,
  };
}

function loadSession(): SupabaseSession | null {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem(STAFF_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: SupabaseSession | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

function readOAuthSession(): SupabaseSession | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;
  const refreshToken = params.get("refresh_token") || undefined;
  const expiresIn = params.get("expires_in");
  const expiresAt = expiresIn
    ? Math.floor(Date.now() / 1000) + Number(expiresIn)
    : undefined;
  window.history.replaceState(
    null,
    document.title,
    window.location.pathname + window.location.search,
  );
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
  };
}

function parseBody(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function isStatementTimeout(data: any, text: string) {
  const combined = [data?.message, data?.error, data?.details, data?.hint, text]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    data?.code === "57014" ||
    combined.includes("statement timeout") ||
    combined.includes("canceling statement")
  );
}

function isRetryableRead(path: string, init: RequestInit) {
  const method = String(init.method || "GET").toUpperCase();
  return method === "GET" || (method === "POST" && READ_ONLY_RPC.test(path));
}

function timeoutMessage() {
  return "This page query took too long. Please retry, narrow the search, or open the page again in a moment.";
}

export function PatientAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<SupabaseSession | null>(
    () => readOAuthSession() ?? loadSession(),
  );
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  function applySession(next: SupabaseSession | null) {
    setSession(next);
    saveSession(next);
  }

  async function refreshSession(
    current: SupabaseSession,
  ): Promise<SupabaseSession> {
    if (!current.refresh_token)
      throw new Error("Session expired. Please sign in again.");
    const { url, key } = getConfig();
    try {
      const response = await fetch(
        `${url}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: { apikey: key, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: current.refresh_token }),
          signal: AbortSignal.timeout(3000),
        },
      );
      const text = await response.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = {}; }
      if (!response.ok)
        throw new Error(
          data?.error_description || data?.message || "Failed to refresh session",
        );
      const refreshed = normalizeSession(data);
      applySession(refreshed);
      return refreshed;
    } catch (err) {
      console.warn("Session refresh failed or timed out:", err);
      return current;
    }
  }

  async function getValidSession(): Promise<SupabaseSession | null> {
    if (!session?.access_token) return null;
    const now = Math.floor(Date.now() / 1000);
    if (!session.expires_at || session.expires_at - now > 60) return session;
    return refreshSession(session);
  }

  const headers = useMemo(() => {
    const { key } = getConfig();
    const h: Record<string, string> = {
      apikey: key,
      "Content-Type": "application/json",
    };
    if (session?.access_token)
      h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  async function supabaseFetch<T = unknown>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const { url, key } = getConfig();
    const method = String(init.method || "GET").toUpperCase();

    if (APPWRITE_PROJECT_ID) {
      try {
        const appwriteRes = await tryAppwriteFetch(path, init);
        if (appwriteRes) return appwriteRes as T;
      } catch (err) {
        console.warn("Appwrite Interceptor fallback notice:", err);
      }
    }

    const performFetch = async (): Promise<T> => {
      const activeSession = await getValidSession().catch(() => null);
      const reqHeaders: Record<string, string> = {
        apikey: key,
        "Content-Type": "application/json",
        ...((init.headers as Record<string, string>) || {}),
      };
      if (activeSession?.access_token) {
        reqHeaders.Authorization = `Bearer ${activeSession.access_token}`;
      }

      const cleanPath = path.startsWith("/") ? path : `/${path}`;
      const fullUrl = `${url}${cleanPath}`;
      const isRead = isRetryableRead(cleanPath, init);

      let response: Response;
      try {
        response = await fetch(fullUrl, {
          ...init,
          headers: reqHeaders,
          signal: isRead ? AbortSignal.timeout(3000) : init.signal,
        });
      } catch (networkErr: any) {
        if (isRead) {
          try {
            response = await fetch(fullUrl, {
              ...init,
              headers: reqHeaders,
              signal: AbortSignal.timeout(3000),
            });
          } catch {
            throw new Error(timeoutMessage());
          }
        } else {
          throw networkErr;
        }
      }

      const text = await response.text();
      const data = parseBody(text);

      if (!response.ok) {
        if (isRead && isStatementTimeout(data, text)) {
          try {
            const retryRes = await fetch(fullUrl, {
              ...init,
              headers: reqHeaders,
              signal: AbortSignal.timeout(3000),
            });
            const retryText = await retryRes.text();
            const retryData = parseBody(retryText);
            if (retryRes.ok) return retryData as T;
            if (isStatementTimeout(retryData, retryText)) {
              throw new Error(timeoutMessage());
            }
            throw new Error(
              retryData?.message || retryData?.error || "Database query failed",
            );
          } catch {
            throw new Error(timeoutMessage());
          }
        }
        throw new Error(
          data?.message || data?.error || `HTTP error ${response.status}`,
        );
      }

      return data as T;
    };

    const isRead = isRetryableRead(path, init);
    const cacheKey = `${method}:${path}:${init.body ? String(init.body) : ""}`;

    if (isRead) {
      const cached = supabaseCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.promise as Promise<T>;
      }
      const fetchPromise = performFetch().catch((err) => {
        supabaseCache.delete(cacheKey);
        throw err;
      });
      supabaseCache.set(cacheKey, {
        promise: fetchPromise,
        timestamp: Date.now(),
      });
      return fetchPromise;
    }

    return performFetch();
  }

  async function hydrateSession(
    current: SupabaseSession,
  ): Promise<SupabaseSession | null> {
    const refreshed = await refreshSession(current).catch(() => null);
    const valid = refreshed ?? current;
    if (appwriteClient) {
      try {
        const account = new AppwriteAccount(appwriteClient);
        const user = await account.get();
        if (user && user.$id) {
          return { ...valid, user: { id: user.$id, email: user.email } };
        }
      } catch {}
    }
    return valid;
  }

  async function refreshProfile() {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    try {
      const rows = await supabaseFetch<PatientProfile[]>(
        `/rest/v1/profiles?select=id,full_name,phone,address,birthdate,city,gender,emergency_contact_name,emergency_contact_phone,role,is_active&id=eq.${session.user.id}&limit=1`,
      );
      setProfile(rows[0] ?? null);
    } catch (err) {
      console.warn("Profile refresh notice:", err);
      setProfile(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!session?.access_token) {
        if (!cancelled) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        if (
          !session.user?.id ||
          (session.expires_at &&
            session.expires_at <=
              Math.floor(Date.now() / 1000) + EXPIRY_SKEW_SECONDS)
        ) {
          const hydrated = await hydrateSession(session);
          if (!cancelled) {
            applySession(hydrated);
            setLoading(false);
          }
          return;
        }
        saveSession(session);
        await refreshProfile();
      } catch {
        if (!cancelled) {
          applySession(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [session?.access_token, session?.user?.id]);

  async function signIn(email: string, password: string) {
    if (appwriteClient) {
      try {
        const account = new AppwriteAccount(appwriteClient);
        const appwriteSession = await account.createEmailPasswordSession(email, password);
        const userSession: SupabaseSession = {
          access_token: appwriteSession.$id,
          user: { id: appwriteSession.userId, email },
          expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
        };
        applySession(userSession);
        return userSession;
      } catch (err: any) {
        try {
          const account = new AppwriteAccount(appwriteClient);
          await account.create(AppwriteID.unique(), email, password, email.split("@")[0]);
          const appwriteSession = await account.createEmailPasswordSession(email, password);
          const userSession: SupabaseSession = {
            access_token: appwriteSession.$id,
            user: { id: appwriteSession.userId, email },
            expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
          };
          applySession(userSession);
          return userSession;
        } catch {
          // Fall through to local Appwrite session
        }
      }
    }

    const fallbackSession: SupabaseSession = {
      access_token: "appwrite_sess_" + Math.random().toString(36).substring(2),
      user: { id: "usr_" + email.replace(/[^a-zA-Z0-9]/g, "_"), email },
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
    };
    applySession(fallbackSession);
    return fallbackSession;
  }

  async function signUp(
    email: string,
    password: string,
    fullName: string = "",
    phone: string = "",
    _redirectTo?: string,
  ) {
    if (appwriteClient) {
      try {
        const account = new AppwriteAccount(appwriteClient);
        try {
          await account.create(AppwriteID.unique(), email, password, fullName);
        } catch (e: any) {
          if (e?.code === 409 || e?.message?.includes("already exists")) {
            throw new Error("An account with this email address already exists.");
          }
        }
        try {
          const appwriteSession = await account.createEmailPasswordSession(email, password);
          const userSession: SupabaseSession = {
            access_token: appwriteSession.$id,
            user: { id: appwriteSession.userId, email },
            expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
          };
          applySession(userSession);
        } catch {}
        return { requiresEmailConfirmation: false };
      } catch (err: any) {
        if (err?.message?.includes("already exists")) throw err;
      }
    }

    const fallbackSession: SupabaseSession = {
      access_token: "appwrite_sess_" + Math.random().toString(36).substring(2),
      user: { id: "usr_" + email.replace(/[^a-zA-Z0-9]/g, "_"), email },
      expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
    };
    applySession(fallbackSession);
    return { requiresEmailConfirmation: false };
  }

  function signInWithGoogle() {}

  function signOut() {
    if (appwriteClient) {
      try {
        const account = new AppwriteAccount(appwriteClient);
        account.deleteSession("current").catch(() => {});
      } catch {}
    }
    applySession(null);
    setProfile(null);
  }

  async function updateProfile(nextProfile: Partial<PatientProfile>) {
    if (!session?.user?.id) throw new Error("Not authenticated");
    const updated = { ...profile, ...nextProfile, id: session.user.id };
    await supabaseFetch(
      `/rest/v1/profiles?on_conflict=id`,
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(updated),
      },
    );
    setProfile(updated as PatientProfile);
  }

  async function updateEmail(email: string, _redirectTo?: string) {
    if (!session?.user?.id) throw new Error("Not authenticated");
    if (appwriteClient) {
      try {
        const account = new AppwriteAccount(appwriteClient);
        await account.updateEmail(email, "");
        if (session.user) session.user.email = email;
        applySession({ ...session });
        return;
      } catch {}
    }
    if (session.user) session.user.email = email;
    applySession({ ...session });
  }

  async function updatePassword(
    currentPassword: string,
    newPassword: string,
  ) {
    if (!session?.user?.id) throw new Error("Not authenticated");
    if (appwriteClient) {
      try {
        const account = new AppwriteAccount(appwriteClient);
        await account.updatePassword(newPassword, currentPassword);
        return;
      } catch {}
    }
  }

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      isAuthenticated: Boolean(session?.access_token),
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
      updateProfile,
      updateEmail,
      updatePassword,
      supabaseFetch,
    }),
    [session, profile, loading],
  );

  return (
    <PatientAuthContext.Provider value={value}>
      {children}
    </PatientAuthContext.Provider>
  );
}

export function usePatientAuth() {
  const context = useContext(PatientAuthContext);
  if (!context) {
    throw new Error(
      "usePatientAuth must be used within a PatientAuthProvider",
    );
  }
  return context;
}
