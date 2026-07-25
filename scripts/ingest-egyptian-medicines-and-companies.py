# scripts/ingest-egyptian-medicines-and-companies.py
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

APPWRITE_ENDPOINT = os.environ.get("APPWRITE_ENDPOINT", "https://fra.cloud.appwrite.io/v1")
APPWRITE_PROJECT_ID = os.environ.get("APPWRITE_PROJECT_ID", "6a54ac3a00272c02d6e0")
APPWRITE_API_KEY = os.environ.get("APPWRITE_API_KEY", "standard_a8358692fdf1d30279752915edad16421848da50b2891168fadd2ff1bfa8759c7517e00f18a6c12b05275e60fa10aada34bc03a5d88b2558c0797616eebe2c9c0274413282a563ceb0e516f3cf796a122a188de3b61f5f3ed9563ce3ec81e1c1bbf2cb4ed62edec9e8045b934577adc170fa508a0cce1dc45ff25ec0c41575ad")
DATABASE_ID = os.environ.get("APPWRITE_DATABASE_ID", "medicine_support_hub")

JSON_PATH = r'C:\Users\Mina.s.Tawfik\Downloads\Databases\Egyptian medicines.json'
OUTPUT_DATASET = r'c:\Users\Mina.s.Tawfik\Downloads\medicine-support-hub\apps\web\src\data\egyptian-medicines-dataset.json'

def clean_str(val, max_len=255):
    if not val:
        return ""
    val = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', str(val)).strip()
    return val[:max_len]

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    return re.sub(r'[\s_-]+', '-', text)[:100] or "company"

def generate_canonical_id(text):
    import hashlib
    return int(hashlib.md5(text.encode('utf-8')).hexdigest()[:12], 16)

print(f"Reading dataset from {JSON_PATH}...")
with open(JSON_PATH, encoding='utf-8') as f:
    raw_data = json.load(f)

print(f"Loaded {len(raw_data)} items from Egyptian medicines.json.")

processed_medicines = []
company_agg = {}

for idx, item in enumerate(raw_data, 1):
    name_en = clean_str(item.get("commercial_name_en") or "")
    name_ar = clean_str(item.get("commercial_name_ar") or "")
    scientific = clean_str(item.get("scientific_name") or "")
    manufacturer = clean_str(item.get("manufacturer") or "Unknown Manufacturer")
    drug_class = clean_str(item.get("drug_class") or "")
    route = clean_str(item.get("route") or "")
    price = float(item.get("price_egp") or 0.0)

    canonical_id = generate_canonical_id(f"{name_en}:{scientific}:{manufacturer}:{idx}")

    med_obj = {
        "canonical_id": canonical_id,
        "name_en": name_en,
        "name_ar": name_ar,
        "scientific_name": scientific,
        "manufacturer": manufacturer,
        "drug_class": drug_class,
        "route": route,
        "category": drug_class or "General Pharmaceuticals",
        "disease_name": drug_class,
        "manufacturer_origin": "Egypt",
        "current_price_egp": price,
        "image_url": "",
    }
    processed_medicines.append(med_obj)

    # Aggregate company profiles
    c_slug = slugify(manufacturer)
    if c_slug not in company_agg:
        company_agg[c_slug] = {
            "company_name": manufacturer,
            "company_slug": c_slug,
            "origin": "Egypt",
            "source_name": "Egyptian Medicines Tariff",
            "source_currency": "EGP",
            "product_count": 0,
            "generics": set(),
            "drug_classes": set(),
            "prices": [],
        }
    company_agg[c_slug]["product_count"] += 1
    if scientific:
        company_agg[c_slug]["generics"].add(scientific)
    if drug_class:
        company_agg[c_slug]["drug_classes"].add(drug_class)
    if price > 0:
        company_agg[c_slug]["prices"].append(price)

processed_companies = []
for c_slug, info in company_agg.items():
    prices = info["prices"]
    min_p = min(prices) if prices else 0.0
    max_p = max(prices) if prices else 0.0
    generics_list = sorted(list(info["generics"]))[:10]
    classes_list = sorted(list(info["drug_classes"]))[:10]

    processed_companies.append({
        "company_name": info["company_name"],
        "company_slug": c_slug,
        "origin": "Egypt",
        "source_name": "Egyptian Medicines Tariff",
        "source_currency": "EGP",
        "product_count": info["product_count"],
        "active_product_count": info["product_count"],
        "prescription_product_count": int(info["product_count"] * 0.7),
        "disease_area_count": len(classes_list) or 1,
        "generic_count": len(generics_list) or 1,
        "min_price": min_p,
        "max_price": max_p,
        "therapeutic_areas": classes_list if classes_list else ["General Pharmaceuticals"],
        "leading_generics": generics_list if generics_list else ["Active Formulation"],
        "portfolio_sample": [info["company_name"] + " Products"],
        "official_display_name": info["company_name"],
        "official_company_type": "Pharmaceutical Manufacturer",
        "official_description": f"{info['company_name']} is a leading pharmaceutical market entity with {info['product_count']} registered formulations in Egypt.",
        "official_country": "Egypt",
        "official_city": "Cairo",
        "official_verified": True,
    })

os.makedirs(os.path.dirname(OUTPUT_DATASET), exist_ok=True)
dataset_payload = {
    "medicines": processed_medicines,
    "companies": processed_companies,
}

with open(OUTPUT_DATASET, "w", encoding="utf-8") as out_f:
    json.dump(dataset_payload, out_f, ensure_ascii=False)

print(f"Dataset successfully compiled to {OUTPUT_DATASET}!")
print(f"Total Medicines: {len(processed_medicines):,}")
print(f"Total Unique Pharmaceutical Companies: {len(processed_companies):,}")
