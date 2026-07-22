// infra/appwrite-cron-sync/src/main.js
import { Client, Databases } from "node-appwrite";

export default async ({ req, res, log, error }) => {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://edgbirxeafstvqdpxgxv.supabase.co";
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkZ2JpcnhlYWZzdHZxZHB4Z3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODc5MjksImV4cCI6MjA4NjU2MzkyOX0.mJb-zB4f9e1Kx7B7z9d0J1K2L3M4N5O6P7Q8R9S0T1U";
  const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";
  const APPWRITE_PROJECT_ID = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID || "";
  const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

  const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
  const MEDICINES_COLLECTION_ID = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";
  const COMPANIES_COLLECTION_ID = process.env.APPWRITE_COMPANIES_COLLECTION_ID || "company_profiles";
  const PORTFOLIOS_COLLECTION_ID = process.env.APPWRITE_PORTFOLIOS_COLLECTION_ID || "company_portfolios";

  log("🚀 Starting Automated Multi-Collection Appwrite Sync Function...");

  if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
    return res.json({ success: false, message: "Missing Appwrite API credentials" }, 500);
  }

  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  const databases = new Databases(client);

  try {
    // Ensure Database
    try { await databases.get(DATABASE_ID); } catch { await databases.create(DATABASE_ID, DATABASE_ID); }

    // 1. Medicines Collection
    try { await databases.getCollection(DATABASE_ID, MEDICINES_COLLECTION_ID); } catch {
      await databases.createCollection(DATABASE_ID, MEDICINES_COLLECTION_ID, MEDICINES_COLLECTION_ID);
      await databases.createIntegerAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "canonical_id", true);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "name_en", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "name_ar", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "scientific_name", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "manufacturer", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "drug_class", 255, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "route", 100, false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "category", 100, false);
      await databases.createFloatAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "current_price_egp", false);
      await databases.createStringAttribute(DATABASE_ID, MEDICINES_COLLECTION_ID, "image_url", 1024, false);
    }

    // 2. Company Profiles Collection
    try { await databases.getCollection(DATABASE_ID, COMPANIES_COLLECTION_ID); } catch {
      await databases.createCollection(DATABASE_ID, COMPANIES_COLLECTION_ID, COMPANIES_COLLECTION_ID);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "company_slug", 255, true);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "display_name", 255, true);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "verification_status", 50, false);
      await databases.createBooleanAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "is_public", false);
    }

    // 3. Portfolios Collection
    try { await databases.getCollection(DATABASE_ID, PORTFOLIOS_COLLECTION_ID); } catch {
      await databases.createCollection(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, PORTFOLIOS_COLLECTION_ID);
      await databases.createStringAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "company_slug", 255, true);
      await databases.createIntegerAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "canonical_id", true);
      await databases.createStringAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "product_name", 255, false);
    }

    // 4. Facets Collection
    try { await databases.getCollection(DATABASE_ID, "medicine_facets"); } catch {
      await databases.createCollection(DATABASE_ID, "medicine_facets", "medicine_facets");
      await databases.createStringAttribute(DATABASE_ID, "medicine_facets", "facet_type", 255, true);
      await databases.createStringAttribute(DATABASE_ID, "medicine_facets", "facet_value", 255, true);
      await databases.createIntegerAttribute(DATABASE_ID, "medicine_facets", "product_count", true);
    }

    let syncedMedicines = 0;
    let syncedCompanies = 0;
    let syncedFacets = 0;

    // Fetch & Sync Medicines
    const medRes = await fetch(`${SUPABASE_URL}/rest/v1/medicine_encyclopedia_products_v2?select=canonical_id,name_en,name_ar,scientific_name,manufacturer,drug_class,route,category,current_price_egp,image_url&limit=1000`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (medRes.ok) {
      const products = await medRes.json();
      for (const p of products) {
        const docId = `med_${p.canonical_id}`;
        const payload = {
          canonical_id: p.canonical_id,
          name_en: (p.name_en || "").substring(0, 255),
          name_ar: (p.name_ar || "").substring(0, 255),
          scientific_name: (p.scientific_name || "").substring(0, 255),
          manufacturer: (p.manufacturer || "").substring(0, 255),
          drug_class: (p.drug_class || "").substring(0, 255),
          route: (p.route || "").substring(0, 100),
          category: (p.category || "").substring(0, 100),
          current_price_egp: p.current_price_egp ? Number(p.current_price_egp) : 0,
          image_url: (p.image_url || "").substring(0, 1024),
        };
        try { await databases.updateDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload); }
        syncedMedicines++;
      }
    }

    // Fetch & Sync Companies
    const compRes = await fetch(`${SUPABASE_URL}/rest/v1/industry_company_profiles?select=company_slug,display_name,verification_status,is_public&limit=500`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (compRes.ok) {
      const companies = await compRes.json();
      for (const c of companies) {
        if (!c.company_slug) continue;
        const docId = `comp_${c.company_slug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const payload = {
          company_slug: c.company_slug.substring(0, 255),
          display_name: (c.display_name || c.company_slug).substring(0, 255),
          verification_status: (c.verification_status || "unverified").substring(0, 50),
          is_public: Boolean(c.is_public),
        };
        try { await databases.updateDocument(DATABASE_ID, COMPANIES_COLLECTION_ID, docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, COMPANIES_COLLECTION_ID, docId, payload); }
        syncedCompanies++;
      }
    }

    // Fetch & Sync Facets
    const facetRes = await fetch(`${SUPABASE_URL}/rest/v1/medicine_encyclopedia_facets_v4?select=facet_type,facet_value,product_count&order=product_count.desc&limit=1000`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (facetRes.ok) {
      const facets = await facetRes.json();
      for (const f of facets) {
        if (!f.facet_type || !f.facet_value) continue;
        const rawId = `${f.facet_type}_${f.facet_value}`;
        const docId = `facet_${rawId.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase()}`;
        const payload = {
          facet_type: f.facet_type.substring(0, 255),
          facet_value: f.facet_value.substring(0, 255),
          product_count: f.product_count ? Number(f.product_count) : 0,
        };
        try { await databases.updateDocument(DATABASE_ID, "medicine_facets", docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, "medicine_facets", docId, payload); }
        syncedFacets++;
      }
    }

    log(`✅ Multi-Collection Sync Complete! Synced: ${syncedMedicines} medicines, ${syncedCompanies} companies, ${syncedFacets} facets.`);
    return res.json({ success: true, syncedMedicines, syncedCompanies, syncedFacets });
  } catch (err) {
    error("Sync error: " + err.message);
    return res.json({ success: false, error: err.message }, 500);
  }
};
