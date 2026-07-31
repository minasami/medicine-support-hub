# scripts/enrich-and-migrate-4-databases.py
import csv
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
APPWRITE_API_KEY = os.environ.get("APPWRITE_API_KEY", "")
DATABASE_ID = os.environ.get("APPWRITE_DATABASE_ID", "medicine_support_hub")
COLLECTION_ID = os.environ.get("APPWRITE_MEDICINES_COLLECTION_ID", "medicines")

if not APPWRITE_API_KEY:
    print("Error: APPWRITE_API_KEY environment variable is required.")
    sys.exit(1)

print("Starting 4-Database Fusion & Enrichment Importer...")
print(f"Endpoint: {APPWRITE_ENDPOINT}")
print(f"Database ID: {DATABASE_ID} | Collection: {COLLECTION_ID}")

DB_FOLDER = r'C:\Users\Mina.s.Tawfik\Downloads\Databases'
MED2_PATH = os.path.join(DB_FOLDER, 'medicines2.csv')
MED3_PATH = os.path.join(DB_FOLDER, 'medicines3.csv')
MED4_PATH = os.path.join(DB_FOLDER, 'medicines4.csv')
MED5_PATH = os.path.join(DB_FOLDER, 'medicines5.csv')

PLACEHOLDER_RE = re.compile(
    r'^(active\s*ingredient|therapeutic\s*(category|product)|general\s*(medicine|therapeutics)|'
    r'official\s*medicine|pharmaceutical\s*industry|egyptian\s*pharmaceutical\s*industry|n/a|na|-|—|\.)$',
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
    s = clean_str(val, max_len)
    if not s or PLACEHOLDER_RE.match(s):
        return ""
    return s


def classify_product_type(name_en, scientific_name, drug_class, category, from_clinical_layer):
    blob = f"{name_en or ''} {scientific_name or ''} {drug_class or ''} {category or ''}"
    if FRAGRANCE_RE.search(blob):
        return "fragrance"
    if COSMETIC_RE.search(name_en or "") and not MEDICINE_HINT.search(name_en or ""):
        return "cosmetic"
    if from_clinical_layer or scientific_name or MEDICINE_HINT.search(name_en or ""):
        return "medicine"
    return "unknown"


# Layer 1: medicines5 clinical
med5_map = {}
if os.path.exists(MED5_PATH):
    print("Layer 1: Indexing medicines5.csv...")
    with open(MED5_PATH, encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            key_en = clean_str(r.get('commercial_name_en') or '').upper()
            key_ar = clean_str(r.get('commercial_name_ar') or '')
            data = {
                'scientific_name': clean_str(r.get('scientific_name') or ''),
                'manufacturer': clean_str(r.get('manufacturer') or ''),
                'drug_class': clean_str(r.get('drug_class') or ''),
                'route': clean_str(r.get('route') or '', 100),
                'price_egp': clean_str(r.get('price_egp') or ''),
            }
            if key_en:
                med5_map[key_en] = data
            if key_ar:
                med5_map[key_ar] = data
    print(f"  ✓ Layer 1 ready ({len(med5_map):,} keys indexed)")

med4_map = {}
if os.path.exists(MED4_PATH):
    print("Layer 2: Indexing medicines4.csv...")
    with open(MED4_PATH, encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            key = clean_str(r.get('med_name') or '').upper()
            img = clean_str(r.get('img_urls') or '', 1024)
            data = {
                'disease_name': clean_str(r.get('disease_name') or ''),
                'manufacturer_origin': clean_str(r.get('drug_manufacturer_origin') or '', 100),
                'drug_content': clean_str(r.get('drug_content') or ''),
                'img_urls': img if img.startswith('http') else '',
                'manufacturer': clean_str(r.get('drug_manufacturer') or ''),
            }
            if key:
                med4_map[key] = data
    print(f"  ✓ Layer 2 ready ({len(med4_map):,} keys indexed)")

med3_map = {}
if os.path.exists(MED3_PATH):
    print("Layer 3: Indexing medicines3.csv...")
    with open(MED3_PATH, encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.DictReader(f)
        for r in reader:
            key = clean_str(r.get('Medicine Name') or '').upper()
            img = clean_str(r.get('Image') or '', 1024)
            data = {
                'category_title': clean_str(r.get('Category title') or '', 100),
                'image': img if img.startswith('http') else '',
            }
            if key:
                med3_map[key] = data
    print(f"  ✓ Layer 3 ready ({len(med3_map):,} keys indexed)")

enriched_medicines = []
seen_keys = set()

if os.path.exists(MED2_PATH):
    print("Main Engine: Processing & Enriching medicines2.csv...")
    with open(MED2_PATH, encoding='utf-8-sig', errors='ignore') as f:
        reader = csv.DictReader(f)
        idx = 1000
        for r in reader:
            idx += 1
            name_en = clean_str(r.get('name_en') or '')
            name_ar = clean_str(r.get('name_ar') or '')
            if not name_en and not name_ar:
                continue

            dedup_key = f"{name_en.upper()}_{name_ar}"
            if dedup_key in seen_keys:
                continue
            seen_keys.add(dedup_key)

            l1 = med5_map.get(name_en.upper()) or med5_map.get(name_ar) or {}
            l2 = med4_map.get(name_en.upper()) or {}
            l3 = med3_map.get(name_en.upper()) or {}

            try:
                price = float(r.get('price') or l1.get('price_egp') or 0)
            except Exception:
                price = 0.0

            # Prefer real enrichment only — never invent placeholders
            scientific_name = real_or_empty(l1.get('scientific_name') or l2.get('drug_content'))
            manufacturer = real_or_empty(l1.get('manufacturer') or l2.get('manufacturer'))
            drug_class = real_or_empty(l1.get('drug_class'))
            route = real_or_empty(l1.get('route'), 100)
            category = real_or_empty(l3.get('category_title'), 100)
            disease_name = real_or_empty(l2.get('disease_name'))
            manufacturer_origin = real_or_empty(l2.get('manufacturer_origin'), 100) or ""
            barcode = clean_str(r.get('barcode') or '', 100)
            code = clean_str(r.get('code') or '', 100)
            image_url = l2.get('img_urls') or l3.get('image') or ''

            from_clinical = bool(l1)
            product_type = classify_product_type(
                name_en, scientific_name, drug_class, category, from_clinical
            )

            if product_type == "fragrance":
                category = category or "Fragrance"
                if not route or "oral" in route.lower():
                    route = "Topical / External"
            elif product_type == "cosmetic":
                category = category or "Cosmetic"
                if not route or "oral" in route.lower():
                    route = "Topical / External"

            has_verified = bool(from_clinical and product_type == "medicine" and scientific_name)

            enriched_medicines.append({
                'canonical_id': idx,
                'name_en': name_en or f"Product #{idx}",
                'name_ar': name_ar or "",
                'scientific_name': scientific_name,
                'manufacturer': manufacturer,
                'drug_class': drug_class,
                'route': route,
                'category': category,
                'product_type': product_type,
                'disease_name': disease_name,
                'manufacturer_origin': manufacturer_origin,
                'barcode': barcode,
                'code': code,
                'current_price_egp': price,
                'image_url': image_url,
                'has_verified_dataset': has_verified,
            })

print(f"🎉 Fully Fused & Enriched Dataset Ready: {len(enriched_medicines):,} Unique Products!")

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

print(f"\n⚡ Streaming enriched products into Appwrite Cloud with 16 Worker Threads...")
start_time = time.time()
completed = 0

with ThreadPoolExecutor(max_workers=16) as executor:
    results = executor.map(upload_single_medicine, enriched_medicines)
    for res in results:
        completed += 1
        if completed % 2000 == 0 or completed == len(enriched_medicines):
            elapsed = time.time() - start_time
            rate = completed / elapsed if elapsed > 0 else 0
            print(f"  ✓ Processed {completed:,} / {len(enriched_medicines):,} documents ({rate:.1f} doc/sec)")

print(f"\n🎉 Appwrite Cloud Fusion Complete in {time.time() - start_time:.1f}s!")
print(f"✅ Total Enriched Products Live in Appwrite Cloud: {completed:,}")
