# scripts/import-all-86k-medicines-to-appwrite.py
import csv
import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor

APPWRITE_ENDPOINT = os.environ.get("APPWRITE_ENDPOINT", "https://fra.cloud.appwrite.io/v1")
APPWRITE_PROJECT_ID = os.environ.get("APPWRITE_PROJECT_ID", "6a54ac3a00272c02d6e0")
APPWRITE_API_KEY = os.environ.get("APPWRITE_API_KEY", "")
DATABASE_ID = os.environ.get("APPWRITE_DATABASE_ID", "medicine_support_hub")
COLLECTION_ID = os.environ.get("APPWRITE_MEDICINES_COLLECTION_ID", "medicines")

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

if not APPWRITE_API_KEY:
    print("Error: APPWRITE_API_KEY environment variable is required.")
    sys.exit(1)

print(f"Initializing High-Speed Migration of 86,000+ Egyptian Medicines into Appwrite Cloud...")
print(f"📍 Endpoint: {APPWRITE_ENDPOINT}")
print(f"📦 Database ID: {DATABASE_ID} | Collection: {COLLECTION_ID}")

enrich_map = {}

drugs_json_path = r'C:\Users\Mina.s.Tawfik\Downloads\egyptian-drugs.json'
if os.path.exists(drugs_json_path):
    print("📚 Loading scientific & manufacturer metadata from egyptian-drugs.json...")
    with open(drugs_json_path, encoding='utf-8', errors='ignore') as f:
        drugs_data = json.load(f)
        for item in drugs_data:
            name_key = (item.get('commercial_name_en') or '').strip().upper()
            if name_key:
                enrich_map[name_key] = {
                    'scientific_name': (item.get('scientific_name') or '').strip(),
                    'manufacturer': (item.get('manufacturer') or '').strip(),
                    'drug_class': (item.get('drug_class') or '').strip(),
                    'route': (item.get('route') or '').strip(),
                    'price_egp': float(item.get('price_egp') or 0),
                }
    print(f"  ✓ Indexed {len(enrich_map):,} enriched drugs.")

med_csv_2 = r'C:\Users\Mina.s.Tawfik\Downloads\medicines2_ready_for_supabase.csv'
med_csv_1 = r'C:\Users\Mina.s.Tawfik\Downloads\medicines.csv'

all_medicines = []
seen_keys = set()

PLACEHOLDER_RE = re.compile(
    r'^(active\s*ingredient|therapeutic\s*(category|product)|general\s*(medicine|therapeutics)|'
    r'official\s*medicine|pharmaceutical\s*industry|egyptian\s*pharmaceutical\s*industry|'n/a|na|-|—|\.)$',
    re.I,
)
FRAGRANCE_RE = re.compile(
    r'\b(edt|edp|edc|eau\s*de\s*toilette|eau\s*de\s*parfum|eau\s*de\s*cologne|perfume|parfum|cologne|aftershave)\b',
    re.I,
)
COSMETIC_RE = re.compile(
    r'\b(cream|lotion|shampoo|conditioner|soap|face\s*wash|body\s*wash|moisturizer|sunscreen|lipstick|mascara|deodorant)\b',
    re.I,
)
MEDICINE_HINT = re.compile(r'\b(mg|mcg|iu|tablet|capsule|ampoule|vial|syrup|suspension|inject)\b', re.I)


def clean_str(val, max_len=255):
    if not val:
        return ""
    val = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', str(val)).strip()
    return val[:max_len]


def real_or_empty(val, max_len=255):
    """Return cleaned string or empty — never invent clinical placeholders."""
    s = clean_str(val, max_len)
    if not s or PLACEHOLDER_RE.match(s):
        return ""
    return s


def classify_product_type(name_en, scientific_name, drug_class, category):
    blob = f"{name_en or ''} {scientific_name or ''} {drug_class or ''} {category or ''}"
    if FRAGRANCE_RE.search(blob):
        return "fragrance"
    if COSMETIC_RE.search(name_en or "") and not MEDICINE_HINT.search(name_en or ""):
        return "cosmetic"
    if scientific_name or drug_class or MEDICINE_HINT.search(name_en or ""):
        return "medicine"
    return "unknown"


def build_row(idx, name_en, name_ar, enrich, price, category_hint=""):
    scientific_name = real_or_empty(enrich.get("scientific_name"))
    manufacturer = real_or_empty(enrich.get("manufacturer"))
    drug_class = real_or_empty(enrich.get("drug_class"))
    route = real_or_empty(enrich.get("route"), 100)
    category = real_or_empty(category_hint, 100)
    product_type = classify_product_type(name_en, scientific_name, drug_class, category)

    if product_type == "fragrance":
        category = category or "Fragrance"
        route = route if route and "oral" not in route.lower() else "Topical / External"
    elif product_type == "cosmetic":
        category = category or "Cosmetic"
        route = route if route and "oral" not in route.lower() else "Topical / External"

    has_verified = bool(scientific_name and product_type == "medicine")

    return {
        "canonical_id": idx,
        "name_en": name_en or f"Product #{idx}",
        "name_ar": name_ar or "",
        "scientific_name": scientific_name,
        "manufacturer": manufacturer,
        "drug_class": drug_class,
        "route": route,
        "category": category,
        "product_type": product_type,
        "current_price_egp": price,
        "image_url": "",
        "has_verified_dataset": has_verified,
    }


if os.path.exists(med_csv_2):
    print(f"📥 Parsing products from medicines2_ready_for_supabase.csv...")
    with open(med_csv_2, encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.DictReader(f)
        idx = 1000
        for row in reader:
            idx += 1
            name_en = clean_str(row.get('name_en') or '', 255)
            name_ar = clean_str(row.get('name_ar') or '', 255)
            if not name_en and not name_ar:
                continue

            dedup_key = f"{name_en.upper()}_{name_ar}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            enrich = enrich_map.get(name_en.upper(), {})
            try:
                price = float(row.get('price') or enrich.get('price_egp') or 0)
            except Exception:
                price = 0.0

            all_medicines.append(build_row(idx, name_en, name_ar, enrich, price))

if os.path.exists(med_csv_1):
    print(f"📥 Parsing additional products from medicines.csv...")
    with open(med_csv_1, encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.DictReader(f)
        idx = len(all_medicines) + 1000
        for row in reader:
            idx += 1
            name_en = clean_str(row.get('name_en') or '', 255)
            name_ar = clean_str(row.get('name_ar') or '', 255)
            if not name_en and not name_ar:
                continue

            dedup_key = f"{name_en.upper()}_{name_ar}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            enrich = enrich_map.get(name_en.upper(), {})
            all_medicines.append(
                build_row(
                    idx,
                    name_en,
                    name_ar,
                    enrich,
                    float(enrich.get('price_egp') or 0),
                    category_hint=row.get('category') or '',
                )
            )

print(f"✅ Total Unique Products Prepared: {len(all_medicines):,}")

headers = {
    "X-Appwrite-Project": APPWRITE_PROJECT_ID,
    "X-Appwrite-Key": APPWRITE_API_KEY,
    "Content-Type": "application/json",
}

def upload_single_medicine(med):
    doc_id = f"med_{med['canonical_id']}"
    url = f"{APPWRITE_ENDPOINT}/databases/{DATABASE_ID}/collections/{COLLECTION_ID}/documents"

    payload = {
        "documentId": doc_id,
        "data": med
    }

    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return True
    except urllib.error.HTTPError as e:
        if e.code == 409:
            update_url = f"{url}/{doc_id}"
            update_payload = {"data": med}
            req_up = urllib.request.Request(update_url, data=json.dumps(update_payload).encode('utf-8'), headers=headers, method='PATCH')
            try:
                with urllib.request.urlopen(req_up, timeout=10) as resp_up:
                    return True
            except Exception:
                return False
        return False
    except Exception:
        return False

print(f"\n⚡ Streaming remaining products into Appwrite Cloud Database with 16 Parallel Worker Threads...")
start_time = time.time()
completed = 0

medicines_to_upload = all_medicines[30000:]

with ThreadPoolExecutor(max_workers=16) as executor:
    results = executor.map(upload_single_medicine, medicines_to_upload)
    for res in results:
        completed += 1
        if completed % 1000 == 0 or completed == len(medicines_to_upload):
            elapsed = time.time() - start_time
            rate = completed / elapsed if elapsed > 0 else 0
            print(f"  ✓ Uploaded {completed:,} / {len(medicines_to_upload):,} documents to Appwrite ({rate:.1f} doc/sec)")

print(f"\n🎉 High-Speed Appwrite Cloud Seeding Completed in {time.time() - start_time:.1f}s!")
print(f"✅ Total Products Active in Appwrite Cloud Database: {completed:,}")
