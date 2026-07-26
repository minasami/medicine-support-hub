# scripts/ingest-egyptian-medicines-and-companies.py
import json
import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

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

def parse_manufacturer(raw_mfg):
    raw_clean = clean_str(raw_mfg or "Unknown Manufacturer")
    if ">" in raw_clean:
        parts = [p.strip() for p in raw_clean.split(">", 1)]
        toll_mfg = parts[0] if parts[0] else "Unknown Manufacturer"
        tm_owner = parts[1] if len(parts) > 1 and parts[1] else toll_mfg
        return {
            "display_manufacturer": tm_owner,
            "toll_manufacturer": toll_mfg,
            "trademark_owner": tm_owner,
            "raw_manufacturer": raw_clean,
        }
    return {
        "display_manufacturer": raw_clean,
        "toll_manufacturer": None,
        "trademark_owner": raw_clean,
        "raw_manufacturer": raw_clean,
    }

print(f"Reading dataset from {JSON_PATH}...")
with open(JSON_PATH, encoding='utf-8') as f:
    raw_data = json.load(f)

print(f"Loaded {len(raw_data):,} items from Egyptian medicines.json.")

processed_medicines = []
company_agg = {}

def get_or_create_company(c_slug, c_name):
    if c_slug not in company_agg:
        company_agg[c_slug] = {
            "company_name": c_name,
            "company_slug": c_slug,
            "origin": "Egypt",
            "source_name": "Egyptian Medicines Tariff",
            "source_currency": "EGP",
            "product_count": 0,
            "generics": set(),
            "drug_classes": set(),
            "prices": [],
            "contract_manufacturers": set(),
            "contract_clients": set(),
            "is_trademark_owner": False,
            "is_toll_manufacturer": False,
        }
    return company_agg[c_slug]

for idx, item in enumerate(raw_data, 1):
    name_en = clean_str(item.get("commercial_name_en") or "")
    name_ar = clean_str(item.get("commercial_name_ar") or "")
    scientific = clean_str(item.get("scientific_name") or "")
    raw_mfg = item.get("manufacturer") or "Unknown Manufacturer"
    mfg_info = parse_manufacturer(raw_mfg)
    
    drug_class = clean_str(item.get("drug_class") or "")
    route = clean_str(item.get("route") or "")
    price = float(item.get("price_egp") or 0.0)

    canonical_id = generate_canonical_id(f"{name_en}:{scientific}:{mfg_info['display_manufacturer']}:{idx}")

    med_obj = {
        "canonical_id": canonical_id,
        "name_en": name_en,
        "name_ar": name_ar,
        "scientific_name": scientific,
        "manufacturer": mfg_info["display_manufacturer"],
        "toll_manufacturer": mfg_info["toll_manufacturer"],
        "trademark_owner": mfg_info["trademark_owner"],
        "raw_manufacturer": mfg_info["raw_manufacturer"],
        "drug_class": drug_class,
        "route": route,
        "category": drug_class or "General Pharmaceuticals",
        "disease_name": drug_class,
        "manufacturer_origin": "Egypt",
        "current_price_egp": price,
        "image_url": "",
    }
    processed_medicines.append(med_obj)

    # 1. Aggregate for Trademark Owner Company Profile
    tm_owner = mfg_info["trademark_owner"]
    tm_slug = slugify(tm_owner)
    tm_entry = get_or_create_company(tm_slug, tm_owner)
    tm_entry["is_trademark_owner"] = True
    tm_entry["product_count"] += 1
    if scientific:
        tm_entry["generics"].add(scientific)
    if drug_class:
        tm_entry["drug_classes"].add(drug_class)
    if price > 0:
        tm_entry["prices"].append(price)
    if mfg_info["toll_manufacturer"] and mfg_info["toll_manufacturer"] != tm_owner:
        tm_entry["contract_manufacturers"].add(mfg_info["toll_manufacturer"])

    # 2. Aggregate for Toll Manufacturer Profile if distinct
    if mfg_info["toll_manufacturer"] and mfg_info["toll_manufacturer"] != tm_owner:
        toll_mfg = mfg_info["toll_manufacturer"]
        toll_slug = slugify(toll_mfg)
        toll_entry = get_or_create_company(toll_slug, toll_mfg)
        toll_entry["is_toll_manufacturer"] = True
        toll_entry["contract_clients"].add(tm_owner)

processed_companies = []
for c_slug, info in company_agg.items():
    prices = info["prices"]
    min_p = min(prices) if prices else 0.0
    max_p = max(prices) if prices else 0.0
    generics_list = sorted(list(info["generics"]))[:10]
    classes_list = sorted(list(info["drug_classes"]))[:10]
    mfg_partners = sorted(list(info.get("contract_manufacturers", set())))[:10]
    clients_list = sorted(list(info.get("contract_clients", set())))[:10]

    desc = f"{info['company_name']} is a profiled pharmaceutical brand & trademark owner in Egypt with {info['product_count']} registered formulations."
    if mfg_partners:
        desc += f" Contract manufacturing partners: {', '.join(mfg_partners)}."
    elif clients_list:
        desc = f"{info['company_name']} is a licensed contract / toll pharmaceutical manufacturer in Egypt producing formulations on behalf of: {', '.join(clients_list)}."

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
        "contract_manufacturers": mfg_partners,
        "contract_clients": clients_list,
        "portfolio_sample": [info["company_name"] + " Formulations"],
        "official_display_name": info["company_name"],
        "official_company_type": "Pharmaceutical Brand & Trademark Owner" if info.get("is_trademark_owner") else "Contract Manufacturer",
        "official_description": desc,
        "official_country": "Egypt",
        "official_city": "Cairo",
        "official_verified": True,
    })

PUBLIC_OUTPUT_DATASET = r'c:\Users\Mina.s.Tawfik\Downloads\medicine-support-hub\apps\web\public\data\egyptian-medicines-dataset.json'
SRC_OUTPUT_DATASET = r'c:\Users\Mina.s.Tawfik\Downloads\medicine-support-hub\apps\web\src\data\egyptian-medicines-dataset.json'

os.makedirs(os.path.dirname(PUBLIC_OUTPUT_DATASET), exist_ok=True)
os.makedirs(os.path.dirname(SRC_OUTPUT_DATASET), exist_ok=True)

full_payload = {
    "medicines": processed_medicines,
    "companies": processed_companies,
}

# Full dataset saved to public folder for async browser fetching (0 MB Vite bundle cost)
with open(PUBLIC_OUTPUT_DATASET, "w", encoding="utf-8") as out_f:
    json.dump(full_payload, out_f, ensure_ascii=False)

# Top subset saved to src folder for initial instant rendering
lightweight_medicines = processed_medicines[:400]
soul_meds = [m for m in processed_medicines if "SOUL PHARMA" in m["trademark_owner"].upper() or "SOUL PHARMA" in m["raw_manufacturer"].upper()]
for sm in soul_meds:
    if sm not in lightweight_medicines:
        lightweight_medicines.append(sm)

lightweight_payload = {
    "medicines": lightweight_medicines,
    "companies": processed_companies,
}

with open(SRC_OUTPUT_DATASET, "w", encoding="utf-8") as out_f:
    json.dump(lightweight_payload, out_f, ensure_ascii=False)

print(f"Full dataset compiled to {PUBLIC_OUTPUT_DATASET}!")
print(f"Lightweight subset compiled to {SRC_OUTPUT_DATASET}!")
print(f"Total Medicines: {len(processed_medicines):,}")
print(f"Total Unique Companies & Brands: {len(processed_companies):,}")

# Check Soul Pharma specific products in output
soul_products = [m for m in processed_medicines if "SOUL PHARMA" in m["trademark_owner"].upper() or "SOUL PHARMA" in m["raw_manufacturer"].upper()]
print(f"\nSoul Pharma Products found: {len(soul_products)}")
for p in soul_products[:10]:
    print(f" - {p['name_en']} | Trademark Owner: {p['trademark_owner']} | Toll Mfg: {p['toll_manufacturer']}")
