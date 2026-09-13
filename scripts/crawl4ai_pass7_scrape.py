#!/usr/bin/env python3
"""
Pass-7 Crawl4AI packshot scraper for Medicine Support Hub.

Uses open-source Crawl4AI (Playwright) to render JS-heavy Egyptian pharmacy /
pharma listing pages and extract {name, image_url, price?, source_url}.

Primary targets:
  - egyptdwa.com deep product pages (sitemap IDs missing from pass-6 AJAX)
  - dwaprices.com med.php pages (related-product BFS + ID-gap sampling)
  - Targeted HV / empty-brand search pages on EgyptDwa

HTTP fallback (when Crawl4AI unavailable or for volume):
  - dwaprices.com routing-new.php digraph→trigraph + brand-stem expansion

Outputs JSON under artifacts/photos-pass7/ (consumed by the Node matcher).

Usage:
  /workspace/crawl4ai-venv/bin/python scripts/crawl4ai_pass7_scrape.py \\
      --out-dir artifacts/photos-pass7 [--concurrency 6] [--limit 0]
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote

UA = "MedicineSupportHubBot/1.0 (+https://medicinesupport.app; packshot-enrichment-pass7)"
ROOT = Path(__file__).resolve().parents[1]

BAD_IMG = re.compile(
    r"(medefault|circlemedhome|placeholder|no[_-]?image|logo|sprite|banner|avatar|static/)",
    re.I,
)
HV_BRANDS = [
    "concor", "plavix", "lipitor", "januvia", "glucophage", "crestor", "norvasc",
    "augmentin", "zithromax", "cataflam", "voltaren", "nexium", "lantus", "humalog",
    "panadol", "singulair", "twynsta", "coversyl", "diovan", "xarelto", "eliquis",
    "clexane", "amaryl", "forxiga", "ozempic", "keppra", "lyrica", "cipralex",
    "zyloric", "entresto", "janumet", "jardiance", "seretide", "symbicort",
    "ventolin", "amlodipine", "bisoprolol", "atorvastatin", "metformin",
    "omeprazole", "esomeprazole", "amoxicillin", "ceftriaxone", "azithromycin",
    "valsartan", "losartan", "insulin", "prednisolone", "dexamethasone",
]


def log(msg: str) -> None:
    print(f"[pass7-crawl] {msg}", flush=True)


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def abs_url(base: str, src: str) -> str:
    src = (src or "").strip()
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("http://") or src.startswith("https://"):
        return src
    if src.startswith("/"):
        return base.rstrip("/") + src
    return base.rstrip("/") + "/" + src


def good_image(url: str) -> bool:
    if not url:
        return False
    if BAD_IMG.search(url):
        return False
    if not re.search(r"\.(jpe?g|png|webp)(\?|$)", url, re.I) and "/dwa/" not in url and "/upload/" not in url:
        # still allow CDN paths without extension
        if "cdn" not in url.lower() and "shop/files" not in url:
            return False
    return True


def http_post_form(url: str, body: str, timeout: float = 25.0) -> Any:
    req = urllib.request.Request(
        url,
        data=body.encode("utf-8"),
        headers={
            "User-Agent": UA,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json,text/plain,*/*",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
    return json.loads(raw)


def http_get(url: str, timeout: float = 30.0) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def load_pass6_egyptdwa_ids(pass6_path: Path) -> set[int]:
    if not pass6_path.exists():
        return set()
    data = json.loads(pass6_path.read_text(encoding="utf-8"))
    ids: set[int] = set()
    for p in data.get("products") or []:
        sid = str(p.get("source_id") or "")
        m = re.search(r"\d+", sid)
        if m:
            ids.add(int(m.group()))
    return ids


def load_pass5_dwaprices_ids(pass5_path: Path) -> set[int]:
    if not pass5_path.exists():
        return set()
    data = json.loads(pass5_path.read_text(encoding="utf-8"))
    ids: set[int] = set()
    for p in data.get("products") or []:
        sid = str(p.get("source_id") or "")
        m = re.search(r"\d+", sid)
        if m:
            ids.add(int(m.group()))
    return ids


def sitemap_egyptdwa_ids() -> list[int]:
    xml = http_get("https://egyptdwa.com/sitemap_dwa.xml")
    return sorted({int(x) for x in re.findall(r"egyptdwa\.com/m/(\d+)", xml)})


def extract_egyptdwa(html: str, page_url: str) -> list[dict]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or "", "lxml")
    out: list[dict] = []
    mid_m = re.search(r"/m/(\d+)", page_url)
    mid = mid_m.group(1) if mid_m else ""

    og_img = soup.find("meta", property="og:image")
    og_title = soup.find("meta", property="og:title")
    h1 = soup.find("h1")
    h2 = soup.find("h2")
    name_ar = (h1.get_text(" ", strip=True) if h1 else "") or (
        og_title.get("content") if og_title else ""
    )
    name_en = h2.get_text(" ", strip=True) if h2 else ""
    img = abs_url("https://egyptdwa.com", og_img.get("content") if og_img else "")
    if good_image(img) and (name_en or name_ar):
        out.append(
            {
                "source": "egyptdwa.com",
                "source_id": mid,
                "name_en": re.sub(r"\s*price\s*2026.*$", "", name_en, flags=re.I).strip(),
                "name_ar": re.sub(r"^سعر\s*", "", name_ar).strip(),
                "display_name": (name_en or name_ar).strip(),
                "image_url": img,
                "price_egp": None,
                "source_page": page_url,
                "via": "crawl4ai",
            }
        )

    # Related / listing cards with /dwa/ packshots
    for img_el in soup.find_all("img"):
        src = abs_url("https://egyptdwa.com", img_el.get("src") or img_el.get("data-src") or "")
        if "/dwa/" not in src:
            continue
        if not good_image(src):
            continue
        alt = (img_el.get("alt") or "").strip()
        parent_a = img_el.find_parent("a")
        href = abs_url("https://egyptdwa.com", parent_a.get("href") if parent_a else "")
        rid = ""
        m = re.search(r"/m/(\d+)", href) or re.search(r"-(\d+)\.(jpe?g|png|webp)$", src, re.I)
        if m:
            rid = m.group(1)
        if not alt and not rid:
            continue
        out.append(
            {
                "source": "egyptdwa.com",
                "source_id": rid or src,
                "name_en": alt,
                "name_ar": alt,
                "display_name": alt,
                "image_url": src,
                "price_egp": None,
                "source_page": href or page_url,
                "via": "crawl4ai-related",
            }
        )
    return out


def extract_dwaprices(html: str, page_url: str) -> tuple[list[dict], list[int]]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html or "", "lxml")
    out: list[dict] = []
    related_ids: list[int] = []
    mid_m = re.search(r"id=(\d+)", page_url)
    mid = mid_m.group(1) if mid_m else ""

    h1 = soup.find("h1")
    og_img = soup.find("meta", property="og:image")
    og_title = soup.find("meta", property="og:title")
    name = (h1.get_text(" ", strip=True) if h1 else "") or (
        og_title.get("content") if og_title else ""
    )
    name = re.sub(r"\s*price in Egypt.*$", "", name, flags=re.I).strip()
    img = abs_url("https://dwaprices.com", og_img.get("content") if og_img else "")
    if good_image(img) and name and "دليل" not in name:
        out.append(
            {
                "source": "dwaprices.com",
                "source_id": mid,
                "name_en": name,
                "name_ar": name,
                "display_name": name,
                "image_url": img,
                "price_egp": None,
                "source_page": page_url,
                "via": "crawl4ai",
            }
        )

    for img_el in soup.find_all("img"):
        src = abs_url("https://dwaprices.com", img_el.get("src") or img_el.get("data-src") or "")
        if "/upload/" not in src and "upload/" not in src:
            continue
        if not good_image(src):
            continue
        alt = (img_el.get("alt") or "").strip()
        parent_a = img_el.find_parent("a")
        href = abs_url("https://dwaprices.com", parent_a.get("href") if parent_a else "")
        rid = ""
        m = re.search(r"id=(\d+)", href or "")
        if m:
            rid = m.group(1)
            related_ids.append(int(rid))
        if not alt:
            continue
        out.append(
            {
                "source": "dwaprices.com",
                "source_id": rid or src,
                "name_en": alt,
                "name_ar": alt,
                "display_name": alt,
                "image_url": src if src.startswith("http") else abs_url("https://dwaprices.com", src),
                "price_egp": None,
                "source_page": href or page_url,
                "via": "crawl4ai-related",
            }
        )

    for a in soup.select('a[href*="med.php?id="]'):
        m = re.search(r"id=(\d+)", a.get("href") or "")
        if m:
            related_ids.append(int(m.group(1)))

    return out, sorted(set(related_ids))


async def crawl_urls(
    urls: list[str],
    concurrency: int,
    extract_fn,
    delay_ms: int = 80,
) -> list[dict]:
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
    except ImportError as e:
        raise SystemExit(
            "Crawl4AI not installed. Create venv and: pip install -r scripts/requirements-crawl4ai.txt"
        ) from e

    browser = BrowserConfig(headless=True, verbose=False, user_agent=UA)
    run = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_until="domcontentloaded",
        page_timeout=45000,
    )
    products: list[dict] = []
    extra_meta: dict[str, Any] = {"related_ids": []}
    sem = asyncio.Semaphore(concurrency)
    done = 0
    fail = 0

    async with AsyncWebCrawler(config=browser) as crawler:

        async def one(url: str):
            nonlocal done, fail
            async with sem:
                try:
                    r = await crawler.arun(url=url, config=run)
                    html = r.html or ""
                    if not r.success or not html:
                        fail += 1
                    else:
                        result = extract_fn(html, url)
                        if isinstance(result, tuple):
                            rows, related = result
                            products.extend(rows)
                            extra_meta["related_ids"].extend(related)
                        else:
                            products.extend(result)
                except Exception as err:
                    fail += 1
                    if fail <= 8:
                        log(f"fail soft {url}: {err}")
                done += 1
                if done % 50 == 0 or done == len(urls):
                    log(f"crawled {done}/{len(urls)} ok_products={len(products)} fails={fail}")
                if delay_ms:
                    await asyncio.sleep(delay_ms / 1000.0)

        await asyncio.gather(*(one(u) for u in urls))

    crawl_urls.last_meta = extra_meta  # type: ignore[attr-defined]
    return products


def dedupe(products: list[dict]) -> list[dict]:
    by: dict[str, dict] = {}
    for p in products:
        if not p.get("image_url") or not good_image(p["image_url"]):
            continue
        key = f"{p.get('source')}:{p.get('source_id') or p.get('image_url')}"
        prev = by.get(key)
        if not prev or (prev.get("via") == "crawl4ai-related" and p.get("via") == "crawl4ai"):
            by[key] = p
    return list(by.values())


def dwa_row_to_product(rz: dict) -> dict | None:
    img = str(rz.get("img") or "")
    if not img.startswith("upload/"):
        return None
    if int(rz.get("noimgid") or 0) == 1:
        return None
    image_url = f"https://dwaprices.com/{img}"
    if not good_image(image_url):
        return None
    return {
        "source": "dwaprices.com",
        "source_id": str(rz.get("id")),
        "name_en": rz.get("name") or "",
        "name_ar": rz.get("arabic") or "",
        "display_name": rz.get("name") or rz.get("arabic") or "",
        "image_url": image_url,
        "price_egp": float(rz["price"]) if rz.get("price") not in (None, "") else None,
        "source_page": f"https://dwaprices.com/med.php?id={rz.get('id')}",
        "concentration": rz.get("concentration") or "",
        "dosage_form": rz.get("dosage_form") or "",
        "company": rz.get("company") or "",
        "active": rz.get("active") or "",
        "via": "http-routing",
    }


def http_expand_dwaprices(known_ids: set[int], brand_stems: list[str], throttle_ms: int = 70) -> list[dict]:
    """HTTP fallback / volume expander: brand stems + targeted trigraphs (polite, bounded)."""
    log("HTTP expanding dwaprices.com routing-new.php (brand stems + targeted trigraphs) …")
    by_id: dict[str, dict] = {}

    def ingest(q: str) -> tuple[int, int]:
        body = f"search=1&searchq={quote(q)}"
        try:
            data = http_post_form("https://dwaprices.com/routing-new.php", body)
        except Exception as e:
            log(f"dwaprices q={q} error: {e}")
            return 0, 0
        rows = data.get("data") or []
        added = 0
        for rz in rows:
            p = dwa_row_to_product(rz)
            if not p:
                continue
            if p["source_id"] in by_id:
                continue
            by_id[p["source_id"]] = p
            if int(p["source_id"]) not in known_ids:
                added += 1
        meta = int(data.get("metadata") or len(rows))
        return meta, added

    # Brand / empty-doc stems (highest value for still-empty Appwrite rows)
    for stem in brand_stems:
        stem = re.sub(r"[^a-z0-9]+", "", stem.lower())
        if len(stem) < 3:
            continue
        meta, added = ingest(stem)
        if added or meta:
            log(f"DwaPrices brand q={stem} meta={meta} newish={added} total={len(by_id)}")
        time.sleep(throttle_ms / 1000.0)

    # Targeted trigraphs from stem prefixes + common pharma digraphs (bounded)
    alphabet = list("abcdefghijklmnopqrstuvwxyz")
    prefixes = []
    for stem in brand_stems[:400]:
        s = re.sub(r"[^a-z0-9]+", "", stem.lower())
        if len(s) >= 2:
            prefixes.append(s[:2])
    prefixes += [
        "ce", "am", "me", "om", "pa", "pr", "in", "va", "lo", "at", "bi", "ro",
        "az", "cl", "en", "fu", "hy", "le", "na", "ne", "se", "sy", "tr", "xi",
        "ja", "oz", "fo", "el", "xa", "co", "gl", "li", "no", "pl", "zi",
    ]
    prefixes = sorted(set(prefixes))
    log(f"DwaPrices targeted trigraph prefixes={len(prefixes)}")
    tri_added = 0
    for dg in prefixes:
        for c in alphabet:
            q = dg + c
            meta, added = ingest(q)
            tri_added += added
            if added:
                log(f"DwaPrices trigraph q={q} meta={meta} newish={added} total={len(by_id)}")
            time.sleep(max(45, throttle_ms - 20) / 1000.0)
    log(f"DwaPrices trigraph phase newish≈{tri_added} total={len(by_id)}")

    products = list(by_id.values())
    log(f"DwaPrices HTTP → {len(products)} products with images")
    return products


def empty_brand_stems(export_path: Path, limit: int = 800) -> list[str]:
    if not export_path.exists():
        return HV_BRANDS[:]
    docs = json.loads(export_path.read_text(encoding="utf-8"))
    if isinstance(docs, dict):
        docs = docs.get("documents") or []

    def empty(u: str) -> bool:
        u = str(u or "")
        return (not u.strip()) or bool(re.search(r"unsplash|placeholder|via\.placeholder|no_image|picsum", u, re.I))

    stems: dict[str, int] = {}
    for d in docs:
        if not empty(d.get("image_url")):
            continue
        blob = f"{d.get('name_en') or ''} {d.get('name_ar') or ''}".lower()
        tok = re.findall(r"[a-z][a-z0-9]{2,}", blob)
        if not tok:
            continue
        stem = tok[0]
        stems[stem] = stems.get(stem, 0) + 1
    ranked = sorted(stems.items(), key=lambda x: -x[1])
    out = [s for s, _ in ranked[:limit]]
    for b in HV_BRANDS:
        if b not in out:
            out.append(b)
    return out


async def run_crawl4ai_phase(args, out_dir: Path) -> list[dict]:
    products: list[dict] = []
    pass6 = ROOT / "artifacts/photos-pass6/egyptdwa-ajax-products.json"
    pass5 = ROOT / "artifacts/photos-pass5/dwaprices-products.json"
    have_ed = load_pass6_egyptdwa_ids(pass6)
    have_dp = load_pass5_dwaprices_ids(pass5)

    # --- EgyptDwa missing sitemap IDs ---
    if not args.skip_egyptdwa:
        try:
            all_ids = sitemap_egyptdwa_ids()
        except Exception as e:
            log(f"EgyptDwa sitemap failed: {e}; continuing")
            all_ids = []
        missing = [i for i in all_ids if i not in have_ed]
        if args.limit and args.limit > 0:
            missing = missing[: args.limit]
        log(f"EgyptDwa sitemap={len(all_ids)} have_pass6={len(have_ed)} missing={len(missing)}")
        urls = [f"https://egyptdwa.com/m/{i}" for i in missing]
        ed_products = await crawl_urls(urls, args.concurrency, extract_egyptdwa, delay_ms=args.delay_ms)
        ed_products = dedupe(ed_products)
        write_json(
            out_dir / "egyptdwa-crawl4ai-products.json",
            {
                "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source": "egyptdwa.com (Crawl4AI deep + related)",
                "count": len(ed_products),
                "missing_ids_targeted": len(missing),
                "products": ed_products,
            },
        )
        products.extend(ed_products)
        log(f"EgyptDwa Crawl4AI → {len(ed_products)}")

    # --- DwaPrices Crawl4AI: gap sample + related BFS ---
    if not args.skip_dwaprices_crawl:
        # Gap IDs between 1 and max(known)+2000 not in pass5
        max_known = max(have_dp) if have_dp else 20000
        gap = [i for i in range(1, max_known + 1) if i not in have_dp]
        # Prefer denser sampling: every Nth gap + recent high IDs
        step = max(1, len(gap) // max(1, args.dwaprices_pages))
        sample = gap[::step][: args.dwaprices_pages]
        # Seed from known IDs for related BFS
        seeds = sorted(have_dp)[:: max(1, len(have_dp) // 80)][:80] if have_dp else list(range(1, 200, 5))
        urls = [f"https://dwaprices.com/med.php?id={i}" for i in sorted(set(sample + seeds))]
        if args.limit and args.limit > 0:
            urls = urls[: args.limit]
        log(f"DwaPrices Crawl4AI pages={len(urls)} (gap_sample+seeds)")
        dp_products = await crawl_urls(urls, args.concurrency, extract_dwaprices, delay_ms=args.delay_ms)
        related = getattr(crawl_urls, "last_meta", {}).get("related_ids") or []
        related_new = [i for i in related if i not in have_dp][: args.dwaprices_bfs]
        if related_new:
            log(f"DwaPrices BFS follow-up pages={len(related_new)}")
            more = await crawl_urls(
                [f"https://dwaprices.com/med.php?id={i}" for i in related_new],
                args.concurrency,
                extract_dwaprices,
                delay_ms=args.delay_ms,
            )
            dp_products.extend(more)
        dp_products = dedupe(dp_products)
        write_json(
            out_dir / "dwaprices-crawl4ai-products.json",
            {
                "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source": "dwaprices.com (Crawl4AI med.php + related)",
                "count": len(dp_products),
                "products": dp_products,
            },
        )
        products.extend(dp_products)
        log(f"DwaPrices Crawl4AI → {len(dp_products)}")

    return products


def main() -> int:
    ap = argparse.ArgumentParser(description="Pass-7 Crawl4AI packshot scraper")
    ap.add_argument("--out-dir", default=str(ROOT / "artifacts/photos-pass7"))
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument("--delay-ms", type=int, default=60)
    ap.add_argument("--limit", type=int, default=0, help="Cap EgyptDwa missing / URL batches (0=all)")
    ap.add_argument("--dwaprices-pages", type=int, default=600, help="Max DwaPrices gap-sample pages")
    ap.add_argument("--dwaprices-bfs", type=int, default=400, help="Max related BFS follow-ups")
    ap.add_argument("--skip-egyptdwa", action="store_true")
    ap.add_argument("--skip-dwaprices-crawl", action="store_true")
    ap.add_argument("--skip-http-fallback", action="store_true")
    ap.add_argument("--http-only", action="store_true", help="Skip Crawl4AI; HTTP expansion only")
    ap.add_argument(
        "--export",
        default=str(ROOT / "scripts/reports/appwrite-medicines-export.json"),
    )
    args = ap.parse_args()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    crawl4ai_ok = True
    products: list[dict] = []
    notes: list[str] = []

    if args.http_only:
        crawl4ai_ok = False
        notes.append("http-only flag set; skipped Crawl4AI")
    else:
        try:
            import crawl4ai  # noqa: F401
        except ImportError:
            crawl4ai_ok = False
            notes.append("Crawl4AI import failed; using HTTP fallback")

    if crawl4ai_ok and not args.http_only:
        try:
            products.extend(asyncio.run(run_crawl4ai_phase(args, out_dir)))
            notes.append("Crawl4AI scrape completed")
        except Exception as e:
            crawl4ai_ok = False
            notes.append(f"Crawl4AI runtime failed ({e}); using HTTP fallback")
            log(notes[-1])

    # Reuse prior Crawl4AI JSON artifacts when browser phases were skipped
    for fname in (
        "egyptdwa-crawl4ai-products.json",
        "dwaprices-crawl4ai-products.json",
    ):
        fpath = out_dir / fname
        if fpath.exists():
            try:
                prior = json.loads(fpath.read_text(encoding="utf-8")).get("products") or []
                products.extend(prior)
                log(f"reused {fname}: {len(prior)} products")
            except Exception as e:
                log(f"reuse failed {fname}: {e}")

    pass5 = ROOT / "artifacts/photos-pass5/dwaprices-products.json"
    have_dp = load_pass5_dwaprices_ids(pass5)
    if not args.skip_http_fallback:

        stems = empty_brand_stems(Path(args.export))
        http_products = http_expand_dwaprices(have_dp, stems[:600])
        write_json(
            out_dir / "dwaprices-http-products.json",
            {
                "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "source": "dwaprices.com (HTTP routing trigraph+brands fallback/expand)",
                "count": len(http_products),
                "products": http_products,
            },
        )
        products.extend(http_products)

    products = dedupe(products)
    by_source: dict[str, int] = {}
    by_via: dict[str, int] = {}
    for p in products:
        by_source[p["source"]] = by_source.get(p["source"], 0) + 1
        via = p.get("via") or "unknown"
        by_via[via] = by_via.get(via, 0) + 1

    reused_crawl = any(
        (p.get("via") or "").startswith("crawl4ai") for p in products
    )
    combined = {
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "pass": "pass7-crawl4ai",
        "crawl4ai_used": (crawl4ai_ok and not args.http_only) or reused_crawl,
        "notes": notes,
        "count": len(products),
        "by_source": by_source,
        "by_via": by_via,
        "products": products,
    }
    write_json(out_dir / "pass7-scraped-products.json", combined)
    # lightweight summary without product rows
    write_json(
        out_dir / "pass7-scrape-summary.json",
        {k: v for k, v in combined.items() if k != "products"},
    )
    log(f"combined → {len(products)} products by_source={by_source} by_via={by_via}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
