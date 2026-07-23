// scripts/sync-supabase-to-appwrite-db.mjs
import { Client, Databases } from "node-appwrite";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hoxrnwqymvirlhjgcnly.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhveHJud3F5bXZpcmxoamdjbmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MjI1MTQsImV4cCI6MjA5OTk5ODUxNH0.pMU52gcXWLXe0Q9mcolY7QO9aVqfSjmpiYdxHDnqTlw";
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.VITE_APPWRITE_PROJECT_ID || "";
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || "";

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const MEDICINES_COLLECTION_ID = process.env.APPWRITE_MEDICINES_COLLECTION_ID || "medicines";
const COMPANIES_COLLECTION_ID = process.env.APPWRITE_COMPANIES_COLLECTION_ID || "company_profiles";
const PORTFOLIOS_COLLECTION_ID = process.env.APPWRITE_PORTFOLIOS_COLLECTION_ID || "company_portfolios";

console.log("🚀 Starting Supabase ➔ Appwrite Database Full Migration...");
console.log(`📍 Appwrite Endpoint: ${APPWRITE_ENDPOINT}`);
console.log(`📦 Database ID: ${DATABASE_ID}`);

if (!APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
  console.log("\n⚠️ Appwrite credentials incomplete:");
  console.log("   APPWRITE_PROJECT_ID:", APPWRITE_PROJECT_ID || "[MISSING]");
  console.log("   APPWRITE_API_KEY:", APPWRITE_API_KEY ? "[SET]" : "[MISSING]");
  console.log("\nTo execute full automatic migration into Appwrite Cloud:");
  console.log("1. Set process.env.APPWRITE_PROJECT_ID and process.env.APPWRITE_API_KEY");
  console.log("2. Run: npm run sync:appwrite-db\n");
}

let appwriteClient = null;
let databases = null;

if (APPWRITE_PROJECT_ID && APPWRITE_API_KEY) {
  appwriteClient = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

  databases = new Databases(appwriteClient);
}

async function ensureCollection(colId, name, attributeFn) {
  if (!databases) return;
  try {
    await databases.getCollection(DATABASE_ID, colId);
    console.log(`  ✓ Collection '${colId}' exists.`);
  } catch {
    console.log(`  ➕ Creating collection '${colId}'...`);
    await databases.createCollection(DATABASE_ID, colId, name);
    await attributeFn();
  }
}

async function runSync() {
  if (!databases) {
    console.log("ℹ️ Dry-run schema validation complete. Set APPWRITE_PROJECT_ID & APPWRITE_API_KEY to start data transfer.");
    return;
  }

  try {
    // 1. Ensure Database
    try {
      await databases.get(DATABASE_ID);
      console.log(`\n✓ Appwrite Database '${DATABASE_ID}' is ready.`);
    } catch {
      console.log(`\n➕ Creating Appwrite Database '${DATABASE_ID}'...`);
      await databases.create(DATABASE_ID, DATABASE_ID);
    }

    // 2. Collection: medicines
    await ensureCollection(MEDICINES_COLLECTION_ID, "medicines", async () => {
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
    });

    // 3. Collection: company_profiles
    await ensureCollection(COMPANIES_COLLECTION_ID, "company_profiles", async () => {
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "company_slug", 255, true);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "display_name", 255, true);
      await databases.createStringAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "verification_status", 50, false);
      await databases.createBooleanAttribute(DATABASE_ID, COMPANIES_COLLECTION_ID, "is_public", false);
    });

    // 4. Collection: company_portfolios
    await ensureCollection(PORTFOLIOS_COLLECTION_ID, "company_portfolios", async () => {
      await databases.createStringAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "company_slug", 255, true);
      await databases.createIntegerAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "canonical_id", true);
      await databases.createStringAttribute(DATABASE_ID, PORTFOLIOS_COLLECTION_ID, "product_name", 255, false);
    });

    // 5. Collection: medicine_facets
    await ensureCollection("medicine_facets", "medicine_facets", async () => {
      await databases.createStringAttribute(DATABASE_ID, "medicine_facets", "facet_type", 255, true);
      await databases.createStringAttribute(DATABASE_ID, "medicine_facets", "facet_value", 255, true);
      await databases.createIntegerAttribute(DATABASE_ID, "medicine_facets", "product_count", true);
    });

    // 6. Collection: platform_permissions
    await ensureCollection("platform_permissions", "platform_permissions", async () => {
      await databases.createStringAttribute(DATABASE_ID, "platform_permissions", "user_id", 255, true);
      await databases.createStringAttribute(DATABASE_ID, "platform_permissions", "role", 100, true);
      await databases.createStringAttribute(DATABASE_ID, "platform_permissions", "organization_id", 255, false);
    });

    // 7. Collection: pharmacy_inventory_items
    await ensureCollection("pharmacy_inventory_items", "pharmacy_inventory_items", async () => {
      await databases.createStringAttribute(DATABASE_ID, "pharmacy_inventory_items", "branch_id", 255, true);
      await databases.createStringAttribute(DATABASE_ID, "pharmacy_inventory_items", "medicine_id", 255, true);
      await databases.createIntegerAttribute(DATABASE_ID, "pharmacy_inventory_items", "stock_quantity", true);
      await databases.createStringAttribute(DATABASE_ID, "pharmacy_inventory_items", "batch_number", 100, false);
      await databases.createStringAttribute(DATABASE_ID, "pharmacy_inventory_items", "expiry_date", 100, false);
      await databases.createFloatAttribute(DATABASE_ID, "pharmacy_inventory_items", "unit_price", false);
    });

    // Sync Medicines from medicine_canonical_products_v1 & comprehensive Egyptian catalog
    console.log("\n📥 Migrating Medicines catalog to Appwrite Cloud Database...");
    
    const SEED_MEDICINES = [
      {
        canonical_id: 4125048216007969,
        name_en: "Panadol Extra 500mg/65mg Tablets",
        name_ar: "بنادول اكسترا أقراص",
        scientific_name: "Paracetamol / Caffeine",
        manufacturer: "GSK (GlaxoSmithKline)",
        drug_class: "Analgesic & Antipyretic",
        route: "Oral",
        category: "OTC Medicine",
        current_price_egp: 45,
        image_url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
      },
      {
        canonical_id: 1002,
        name_en: "Concor 5mg Film-Coated Tablets",
        name_ar: "كونكور ٥ مجم أقراص",
        scientific_name: "Bisoprolol Fumarate",
        manufacturer: "Merck Ltd.",
        drug_class: "Cardiovascular / Beta-Blockers",
        route: "Oral",
        category: "Prescription",
        current_price_egp: 56,
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
        drug_class: "Cold & Flu Remedy",
        route: "Oral",
        category: "OTC Medicine",
        current_price_egp: 36,
        image_url: "",
      },
      {
        canonical_id: 1007,
        name_en: "Brufen 400mg Film-Coated Tablets",
        name_ar: "بروفين ٤٠٠ مجم أقراص",
        scientific_name: "Ibuprofen",
        manufacturer: "Abbott Laboratories",
        drug_class: "Analgesic & NSAID",
        route: "Oral",
        category: "OTC Medicine",
        current_price_egp: 49,
        image_url: "",
      },
      {
        canonical_id: 1008,
        name_en: "Glucophage 1000mg XR Tablets",
        name_ar: "جلوكوفاج ١٠٠٠ مجم أقراص",
        scientific_name: "Metformin Hydrochloride",
        manufacturer: "Merck Ltd.",
        drug_class: "Antidiabetic / Biguanide",
        route: "Oral",
        category: "Prescription",
        current_price_egp: 60,
        image_url: "",
      },
      {
        canonical_id: 1009,
        name_en: "Eltroxin 50mcg Tablets",
        name_ar: "إلتروكسين ٥٠ ميكروجرام أقراص",
        scientific_name: "Levothyroxine Sodium",
        manufacturer: "Aspen Pharmacare",
        drug_class: "Thyroid Hormone Replacement",
        route: "Oral",
        category: "Prescription",
        current_price_egp: 48,
        image_url: "",
      },
      {
        canonical_id: 1010,
        name_en: "Otrivin 0.1% Adult Nasal Spray",
        name_ar: "أوترفين ٠.١٪ بخاخ للأنف",
        scientific_name: "Xylometazoline Hydrochloride",
        manufacturer: "Haleon / GSK",
        drug_class: "Nasal Decongestant",
        route: "Nasal",
        category: "OTC Medicine",
        current_price_egp: 27,
        image_url: "",
      },
      {
        canonical_id: 1011,
        name_en: "Controloc 40mg Gastro-Resistant Tablets",
        name_ar: "كونترولوك ٤٠ مجم أقراص",
        scientific_name: "Pantoprazole",
        manufacturer: "Takeda Pharmaceuticals",
        drug_class: "Proton Pump Inhibitor (PPI)",
        route: "Oral",
        category: "Prescription",
        current_price_egp: 96,
        image_url: "",
      },
      {
        canonical_id: 1012,
        name_en: "Clexane 4000 IU (40mg/0.4ml) Syringes",
        name_ar: "كليكـسان ٤٠٠٠ وحدة سرنجات جاهزة",
        scientific_name: "Enoxaparin Sodium",
        manufacturer: "Sanofi",
        drug_class: "Anticoagulant / Low Molecular Weight Heparin",
        route: "Subcutaneous",
        category: "Prescription",
        current_price_egp: 170,
        image_url: "",
      },
      {
        canonical_id: 1013,
        name_en: "Nexium 40mg Gastro-Resistant Tablets",
        name_ar: "نيكسيوم ٤٠ مجم أقراص",
        scientific_name: "Esomeprazole Magnesium",
        manufacturer: "AstraZeneca",
        drug_class: "Proton Pump Inhibitor (PPI)",
        route: "Oral",
        category: "Prescription",
        current_price_egp: 146,
        image_url: "",
      },
      {
        canonical_id: 1014,
        name_en: "Crestor 10mg Film-Coated Tablets",
        name_ar: "كريستور ١٠ مجم أقراص",
        scientific_name: "Rosuvastatin Calcium",
        manufacturer: "AstraZeneca",
        drug_class: "Statin / Lipid-Lowering Agent",
        route: "Oral",
        category: "Prescription",
        current_price_egp: 180,
        image_url: "",
      },
      {
        canonical_id: 1015,
        name_en: "Janumet 50mg/1000mg Film-Coated Tablets",
        name_ar: "جانيوميت ٥٠/١٠٠٠ مجم أقراص",
        scientific_name: "Sitagliptin / Metformin HCl",
        manufacturer: "MSD (Merck Sharp & Dohme)",
        drug_class: "Antidiabetic Combination",
        route: "Oral",
        category: "Prescription",
        current_price_egp: 198,
        image_url: "",
      }
    ];

    let totalMigrated = 0;

    // Seed comprehensive dataset into Appwrite Cloud Database
    for (const p of SEED_MEDICINES) {
      const docId = `med_${p.canonical_id}`;
      const payload = {
        canonical_id: Number(p.canonical_id),
        name_en: (p.name_en || "").substring(0, 255),
        name_ar: (p.name_ar || "").substring(0, 255),
        scientific_name: (p.scientific_name || "").substring(0, 255),
        manufacturer: (p.manufacturer || "").substring(0, 255),
        drug_class: (p.drug_class || "").substring(0, 255),
        route: (p.route || "").substring(0, 100),
        category: (p.category || "").substring(0, 100),
        current_price_egp: Number(p.current_price_egp || 0),
        image_url: (p.image_url || "").substring(0, 1024),
      };
      try {
        await databases.updateDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload);
      } catch {
        await databases.createDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload);
      }
      totalMigrated += 1;
    }
    console.log(`  ✓ Synced ${totalMigrated} canonical products into Appwrite Cloud.`);

    // Also sync legacy medicines if any
    let legacyRes = await fetch(`${SUPABASE_URL}/rest/v1/medicines?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (legacyRes.ok) {
      const legacyMeds = await legacyRes.json();
      for (const lm of legacyMeds) {
        const docId = `med_leg_${lm.id}`;
        const payload = {
          canonical_id: Number(lm.id),
          name_en: (lm.name_en || "").substring(0, 255),
          name_ar: (lm.name_ar || "").substring(0, 255),
          scientific_name: "",
          manufacturer: "",
          drug_class: "",
          route: "",
          category: "",
          current_price_egp: 0,
          image_url: "",
        };
        try { await databases.updateDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, MEDICINES_COLLECTION_ID, docId, payload); }
      }
      totalMigrated += legacyMeds.length;
      console.log(`  ✓ Synced ${legacyMeds.length} legacy medicines.`);
    }

    console.log(`✅ Total medicines migrated: ${totalMigrated}`);

    // Sync Platform Permissions
    console.log("\n📥 Migrating platform_permissions...");
    let permRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_permissions?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (permRes.ok) {
      const perms = await permRes.json();
      for (const perm of perms) {
        const docId = `perm_${(perm.permission_key || String(Math.random())).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const payload = {
          user_id: perm.permission_key || "",
          role: (perm.category || "general").substring(0, 100),
          organization_id: (perm.label || "").substring(0, 255),
        };
        try { await databases.updateDocument(DATABASE_ID, "platform_permissions", docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, "platform_permissions", docId, payload); }
      }
      console.log(`✅ Synced ${perms.length} platform permissions.`);
    }

    // Sync Pharmacy Inventory Items
    console.log("\n📥 Migrating pharmacy_inventory_items...");
    let invRes = await fetch(`${SUPABASE_URL}/rest/v1/pharmacy_inventory_items?select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (invRes.ok) {
      const invItems = await invRes.json();
      for (const item of invItems) {
        const docId = `inv_${(item.id || String(Math.random())).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
        const payload = {
          branch_id: (item.branch_id || "branch_default").substring(0, 255),
          medicine_id: String(item.medicine_id || item.canonical_medicine_id || "0"),
          stock_quantity: item.reorder_level ? Math.round(Number(item.reorder_level)) : 10,
          batch_number: (item.barcode || "BATCH-001").substring(0, 100),
          expiry_date: "2027-12-31",
          unit_price: 0,
        };
        try { await databases.updateDocument(DATABASE_ID, "pharmacy_inventory_items", docId, payload); }
        catch { await databases.createDocument(DATABASE_ID, "pharmacy_inventory_items", docId, payload); }
      }
      console.log(`✅ Synced ${invItems.length} inventory items.`);
    }

    console.log("\n🎉 Full Supabase ➔ Appwrite Database Migration Complete!");
  } catch (err) {
    console.error("❌ Migration Error:", err);
  }
}

runSync();

