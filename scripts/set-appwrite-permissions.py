# scripts/set-appwrite-permissions.py
import json
import os
import sys
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1'
APPWRITE_PROJECT_ID = '6a54ac3a00272c02d6e0'
APPWRITE_API_KEY = os.environ.get('APPWRITE_API_KEY', 'standard_a8358692fdf1d30279752915edad16421848da50b2891168fadd2ff1bfa8759c7517e00f18a6c12b05275e60fa10aada34bc03a5d88b2558c0797616eebe2c9c0274413282a563ceb0e516f3cf796a122a188de3b61f5f3ed9563ce3ec81e1c1bbf2cb4ed62edec9e8045b934577adc170fa508a0cce1dc45ff25ec0c41575ad')
DATABASE_ID = 'medicine_support_hub'

headers = {
    'X-Appwrite-Project': APPWRITE_PROJECT_ID,
    'X-Appwrite-Key': APPWRITE_API_KEY,
    'Content-Type': 'application/json',
}

cols = ['medicines', 'medicine_facets', 'company_profiles', 'company_portfolios', 'pharmacy_inventory_items']

for cid in cols:
    url = f"{APPWRITE_ENDPOINT}/databases/{DATABASE_ID}/collections/{cid}"
    
    # Get current collection info
    req_get = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req_get) as resp_get:
            cdata = json.loads(resp_get.read().decode('utf-8'))
            cname = cdata.get('name', cid)
    except Exception as e:
        print(f"Error fetching collection {cid}: {e}")
        continue

    payload = {
        'name': cname,
        'permissions': ['read("any")']
    }
    
    req_put = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers, method='PUT')
    try:
        with urllib.request.urlopen(req_put) as resp_put:
            print(f"✓ Updated permissions for collection '{cid}': read(\"any\") ENABLED!")
    except Exception as e:
        print(f"Failed to update {cid}: {e}")
