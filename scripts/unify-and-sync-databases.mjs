// scripts/unify-and-sync-databases.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const databasesDir = 'C:\\Users\\Mina.s.Tawfik\\Downloads\\Databases';

console.log('🚀 Starting Unification of Central Pharmaceutical Database...');

const unifiedMap = new Map();
let nextCanonicalId = 10001;

const FRAGRANCE_RE =
  /\b(edt|edp|edc|eau\s*de\s*toilette|eau\s*de\s*parfum|eau\s*de\s*cologne|perfume|parfum|cologne|aftershave)\b/i;
const COSMETIC_RE =
  /\b(cream|lotion|shampoo|conditioner|soap|face\s*wash|body\s*wash|moisturizer|sunscreen|lipstick|mascara|deodorant)\b/i;
const MEDICINE_HINT =
  /\b(mg|mcg|iu|tablet|capsule|ampoule|vial|syrup|suspension|inject)\b/i;

function classifyProductType(nameEn) {
  const n = nameEn || '';
  if (FRAGRANCE_RE.test(n)) return 'fragrance';
  if (COSMETIC_RE.test(n) && !MEDICINE_HINT.test(n)) return 'cosmetic';
  if (MEDICINE_HINT.test(n)) return 'medicine';
  return 'unknown';
}

function makeKey(nameEn, manufacturer) {
  const cleanName = (nameEn || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanMfg = (manufacturer || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanName}:::${cleanMfg}`;
}

const jsonPath = path.join(databasesDir, 'Egyptian medicines.json');
if (fs.existsSync(jsonPath)) {
  console.log('📦 Ingesting Ground Truth: Egyptian medicines.json...');
  const jsonRaw = fs.readFileSync(jsonPath, 'utf8');
  const items = JSON.parse(jsonRaw);

  for (const item of items) {
    const nameEn = (item.commercial_name_en || '').trim();
    const nameAr = (item.commercial_name_ar || '').trim();
    const scientificName = (item.scientific_name || '').trim();
    const manufacturer = (item.manufacturer || '').trim();
    const drugClass = (item.drug_class || '').trim();
    const route = (item.route || '').trim();
    const priceEgp = item.price_egp ? Number(item.price_egp) : 0;

    if (!nameEn && !nameAr) continue;

    const key = makeKey(nameEn, manufacturer);
    const productType = classifyProductType(nameEn);

    if (!unifiedMap.has(key)) {
      unifiedMap.set(key, {
        canonical_id: nextCanonicalId++,
        name_en: nameEn,
        name_ar: nameAr,
        scientific_name: scientificName || null,
        manufacturer: manufacturer || null,
        raw_manufacturer: manufacturer || null,
        drug_class: drugClass || null,
        category: drugClass || null,
        route: route || null,
        dosage_form: route.includes('.') ? route.split('.')[1] : route || null,
        product_type: productType === 'unknown' && scientificName ? 'medicine' : productType,
        has_verified_dataset: Boolean(scientificName),
        current_price_egp: priceEgp,
        image_url: '',
      });
    }
  }
  console.log(`  ✓ Unified ${unifiedMap.size} unique records from Egyptian medicines.json`);
}

const med2Path = path.join(databasesDir, 'medicines2.csv');
if (fs.existsSync(med2Path)) {
  console.log('📦 Ingesting & Merging: medicines2.csv...');
  const content = fs.readFileSync(med2Path, 'utf8');
  const lines = content.split('\n');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length < 6) continue;

    const price = Number(parts[2]) || 0;
    const barcode = parts[3] || '';
    const nameAr = (parts[4] || '').replace(/[\u200e\u200f]/g, '').trim();
    const nameEn = (parts[5] || '').trim();

    if (!nameEn) continue;

    const key = makeKey(nameEn, '');
    if (unifiedMap.has(key)) {
      const existing = unifiedMap.get(key);
      if (barcode && !existing.barcode) existing.barcode = barcode;
      if (price > 0 && !existing.current_price_egp) existing.current_price_egp = price;
      if (nameAr && (!existing.name_ar || existing.name_ar === existing.name_en)) existing.name_ar = nameAr;
    } else {
      const productType = classifyProductType(nameEn);
      unifiedMap.set(key, {
        canonical_id: nextCanonicalId++,
        name_en: nameEn,
        name_ar: nameAr,
        scientific_name: null,
        manufacturer: null,
        raw_manufacturer: null,
        drug_class: null,
        // Do NOT invent General Medicine / Tablet / Oral
        category:
          productType === 'fragrance'
            ? 'Fragrance'
            : productType === 'cosmetic'
              ? 'Cosmetic'
              : null,
        route:
          productType === 'fragrance' || productType === 'cosmetic'
            ? 'Topical / External'
            : null,
        dosage_form: productType === 'fragrance' ? 'Spray / Bottle' : null,
        product_type: productType,
        has_verified_dataset: false,
        current_price_egp: price,
        barcode: barcode,
        image_url: '',
      });
    }
  }
  console.log(`  ✓ Total records after merging medicines2.csv: ${unifiedMap.size}`);
}

console.log('🔒 Verifying & Locking Soul Pharma Ground Truth Products...');
const soulProducts = [
  {
    canonical_id: 80001,
    name_en: 'BELLFERO 20 PIECE',
    name_ar: 'بيللفيرو 20 بيسي',
    scientific_name: 'VITAMIN C+ZINC+IRON+LACTOFERRIN+FOLIC ACID+VITAMIN B1+2+6+12',
    manufacturer: 'MEDCARE > SOUL PHARMA',
    raw_manufacturer: 'MEDCARE > SOUL PHARMA',
    trademark_owner: 'SOUL PHARMA',
    drug_class: 'MULTIVITAMIN',
    category: 'Multivitamin & Blood Support',
    dosage_form: 'Sachet / Powder',
    route: 'ORAL.SOLID',
    product_type: 'nutrition',
    has_verified_dataset: true,
    current_price_egp: 130,
  },
  {
    canonical_id: 80002,
    name_en: 'CHUMMY INTIMATE FEMININE WASH 250ML',
    name_ar: 'تشوممي إنتيماتي فيمينيني واش',
    scientific_name: 'COCAMIDOPROPYL BETAINE+CHAMOMILE EX+TEA TREE OIL+MENTHOL+ALUM+ALOE VERA+GLYCERIN+ROSE EX+CHLORHEXIDINE',
    manufacturer: 'EVITA FOR COSMETICS > SOUL PHARMA',
    raw_manufacturer: 'EVITA FOR COSMETICS > SOUL PHARMA',
    trademark_owner: 'SOUL PHARMA',
    drug_class: 'VAGINAL DOUCHE',
    category: 'Feminine Care',
    dosage_form: 'Liquid Wash',
    route: 'VAGINAL',
    product_type: 'personal_care',
    has_verified_dataset: false,
    current_price_egp: 50,
  },
  {
    canonical_id: 80003,
    name_en: 'GENOLIGHT WHITENING CREAM 60 GM',
    name_ar: 'جينوليغت وهيتينينج',
    scientific_name: 'GLYCERIN+COLLAGEN+HYALURONIC ACID',
    manufacturer: 'SMARTEC > SOULPHARMA',
    raw_manufacturer: 'SMARTEC > SOULPHARMA',
    trademark_owner: 'SOUL PHARMA',
    drug_class: 'SKIN CARE WHITENING',
    category: 'Dermatology',
    dosage_form: 'Cream',
    route: 'TOPICAL',
    product_type: 'cosmetic',
    has_verified_dataset: false,
    current_price_egp: 120,
  },
  {
    canonical_id: 80004,
    name_en: 'MOISDERM CREAM',
    name_ar: 'مويسديرم',
    scientific_name: 'BEESWAX+ALLANTOIN+LANOLIN+ZINC OXIDE+GLYCERIN+VITAMIN E+PANTHENOL+OLIVE OIL+ALGAE EX+JOJOBA OIL+ALOE VERA EX+CHAMOMILE EX+TEA TREE OIL+GRAPESEED OIL+CHLORHEXIDINE',
    manufacturer: 'SMARTEC FOR COSMETIC > SOUL PHARMA',
    raw_manufacturer: 'SMARTEC FOR COSMETIC > SOUL PHARMA',
    trademark_owner: 'SOUL PHARMA',
    drug_class: 'SKIN SOOTHING & EMOLLIENT CREAM',
    category: 'Dermatology',
    dosage_form: 'Cream',
    route: 'TOPICAL',
    product_type: 'cosmetic',
    has_verified_dataset: false,
    current_price_egp: 85,
  },
  {
    canonical_id: 80005,
    name_en: 'VITAMIN D 2000IU 30ML ORAL DROPS',
    name_ar: 'فيتامين د أورال',
    scientific_name: 'VITAMIN D3',
    manufacturer: 'ORGANIX > SOUL PHARMA',
    raw_manufacturer: 'ORGANIX > SOUL PHARMA',
    trademark_owner: 'SOUL PHARMA',
    drug_class: 'MULTIVITAMIN',
    category: 'Vitamin D Deficiency',
    dosage_form: 'Oral Drops',
    route: 'ORAL.LIQUID',
    product_type: 'nutrition',
    has_verified_dataset: true,
    current_price_egp: 165,
  },
];

const unifiedArray = Array.from(unifiedMap.values());

for (const sp of soulProducts) {
  const idx = unifiedArray.findIndex(
    (m) =>
      m.canonical_id === sp.canonical_id ||
      (m.name_en && m.name_en.toUpperCase() === sp.name_en),
  );
  if (idx >= 0) {
    unifiedArray[idx] = { ...unifiedArray[idx], ...sp };
  } else {
    unifiedArray.unshift(sp);
  }
}

console.log(`✅ Central Unified Database compiled with ${unifiedArray.length} total deduplicated products.`);

const publicPath = path.join(root, 'apps', 'web', 'public', 'data', 'egyptian-medicines-dataset.json');
const srcPath = path.join(root, 'apps', 'web', 'src', 'data', 'egyptian-medicines-dataset.json');

const finalPayload = {
  version: '4.1.0',
  last_updated: new Date().toISOString(),
  total_count: unifiedArray.length,
  medicines: unifiedArray,
};

fs.writeFileSync(publicPath, JSON.stringify(finalPayload, null, 2), 'utf8');
console.log(`💾 Saved Central Unified Database to ${publicPath} (${(fs.statSync(publicPath).size / (1024 * 1024)).toFixed(2)} MB)`);

if (fs.existsSync(path.dirname(srcPath))) {
  const srcPayload = {
    version: '4.1.0',
    last_updated: new Date().toISOString(),
    total_count: unifiedArray.length,
    medicines: unifiedArray.slice(0, 1500),
  };
  fs.writeFileSync(srcPath, JSON.stringify(srcPayload, null, 2), 'utf8');
  console.log(`💾 Saved Bundler Fallback Dataset to ${srcPath}`);
}

console.log('🎉 Central Unification Complete!');
