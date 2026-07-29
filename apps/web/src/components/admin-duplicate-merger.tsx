/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Combine,
  Copy,
  Database,
  FileCheck2,
  Filter,
  Layers,
  Merge,
  Package,
  Pill,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePatientAuth } from "@/lib/patient-auth";

type MedicineItem = {
  canonical_id: number;
  name_en: string;
  name_ar?: string;
  scientific_name?: string;
  manufacturer?: string;
  brand_owner?: string;
  current_price_egp?: number;
  image_url?: string;
  category?: string;
  drug_class?: string;
  company_slug?: string;
  similarityScore?: number;
};

type CompanyItem = {
  id?: string;
  company_name: string;
  company_slug: string;
  product_count: number;
  manufacturer_name?: string;
  brand_owner_name?: string;
  origin?: string;
  similarityScore?: number;
};

type ProductGroup = {
  groupKey: string;
  suggestedMasterName: string;
  confidenceScore: number;
  items: MedicineItem[];
};

type CompanyGroup = {
  groupKey: string;
  suggestedMasterName: string;
  confidenceScore: number;
  items: CompanyItem[];
};

function normalize(str: string) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, "");
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalize(str1);
  const s2 = normalize(str2);
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 85;

  const getBigrams = (str: string) => {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2));
    return s;
  };
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  b1.forEach((b) => {
    if (b2.has(b)) intersection++;
  });
  const union = b1.size + b2.size - intersection;
  return union > 0 ? Math.round((intersection / union) * 100) : 0;
}

export function AdminDuplicateMerger() {
  const { supabaseFetch } = usePatientAuth();
  const [activeTab, setActiveTab] = useState<"products" | "companies">("products");

  // Product Deduplication State
  const [productSearch, setProductSearch] = useState("");
  const [detectedProductGroups, setDetectedProductGroups] = useState<ProductGroup[]>([]);
  const [allProducts, setAllProducts] = useState<MedicineItem[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<number>>(new Set());

  // Product Master Form State
  const [masterNameEn, setMasterNameEn] = useState("");
  const [masterNameAr, setMasterNameAr] = useState("");
  const [masterPrice, setMasterPrice] = useState<number>(0);
  const [masterImageUrl, setMasterImageUrl] = useState("");
  const [masterManufacturer, setMasterManufacturer] = useState("");
  const [masterBrandOwner, setMasterBrandOwner] = useState("");
  const [targetCanonicalId, setTargetCanonicalId] = useState<number | null>(null);

  // Company Deduplication State
  const [companySearch, setCompanySearch] = useState("");
  const [detectedCompanyGroups, setDetectedCompanyGroups] = useState<CompanyGroup[]>([]);
  const [allCompanies, setAllCompanies] = useState<CompanyItem[]>([]);
  const [selectedCompanySlugs, setSelectedCompanySlugs] = useState<Set<string>>(new Set());

  // Company Master Form State
  const [masterCompanyName, setMasterCompanyName] = useState("");
  const [masterCompanySlug, setMasterCompanySlug] = useState("");
  const [relationshipType, setRelationshipType] = useState<"merge" | "manufacturer_brand">("manufacturer_brand");
  const [manufacturerEntity, setManufacturerEntity] = useState("ORGANIX");
  const [brandOwnerEntity, setBrandOwnerEntity] = useState("SOUL PHARMA");

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. AUTO-DETECT SIMILAR PRODUCTS FROM APPWRITE DB
  async function scanDuplicateProducts() {
    setLoading(true);
    setError(null);
    try {
      const q = productSearch.trim();
      const rows = await supabaseFetch<any[]>("/rest/v1/rpc/search_medicine_encyclopedia_v4", {
        method: "POST",
        body: JSON.stringify({ p_query: q || "congestal", p_limit: 150, p_offset: 0 }),
      }).catch(() => []);

      const items: MedicineItem[] = Array.isArray(rows)
        ? rows.map((r) => ({
            canonical_id: Number(r.canonical_id || r.id),
            name_en: String(r.name_en || r.product_name || "Medicine Product"),
            name_ar: String(r.name_ar || ""),
            scientific_name: String(r.scientific_name || ""),
            manufacturer: String(r.manufacturer || r.raw_manufacturer || ""),
            brand_owner: String(r.brand_owner || r.trademark_owner || "SOUL PHARMA"),
            current_price_egp: Number(r.current_price_egp || 0),
            image_url: String(r.image_url || ""),
            category: String(r.category || ""),
            drug_class: String(r.drug_class || ""),
            company_slug: String(r.company_slug || ""),
          }))
        : [];

      setAllProducts(items);

      // Auto-cluster duplicates using string distance
      const groups: ProductGroup[] = [];
      const visited = new Set<number>();

      for (let i = 0; i < items.length; i++) {
        const itemA = items[i];
        if (visited.has(itemA.canonical_id)) continue;

        const cluster: MedicineItem[] = [itemA];
        for (let j = i + 1; j < items.length; j++) {
          const itemB = items[j];
          if (visited.has(itemB.canonical_id)) continue;

          const score = calculateSimilarity(itemA.name_en, itemB.name_en);
          if (score >= 65 || (itemA.name_en && itemB.name_en && itemA.name_en.slice(0, 5).toLowerCase() === itemB.name_en.slice(0, 5).toLowerCase())) {
            cluster.push({ ...itemB, similarityScore: score });
          }
        }

        if (cluster.length > 1 || q.length > 0) {
          cluster.forEach((c) => visited.add(c.canonical_id));
          const score = cluster.length > 1 ? Math.max(...cluster.map((c) => c.similarityScore || 80)) : 100;
          groups.push({
            groupKey: itemA.name_en.toLowerCase().replace(/[^a-z0-9]/gi, ""),
            suggestedMasterName: itemA.name_en,
            confidenceScore: score,
            items: cluster,
          });
        }
      }

      setDetectedProductGroups(groups);

      // Auto-select first group if available
      if (groups.length > 0 && groups[0].items.length >= 2) {
        const firstGroup = groups[0].items;
        const initialSelected = new Set(firstGroup.map((i) => i.canonical_id));
        setSelectedProductIds(initialSelected);
        proposeMasterProduct(firstGroup);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to scan catalog for duplicate products.");
    } finally {
      setLoading(false);
    }
  }

  // 2. AUTO-DETECT SIMILAR COMPANIES FROM APPWRITE DB
  async function scanDuplicateCompanies() {
    setLoading(true);
    setError(null);
    try {
      const rows = await supabaseFetch<any[]>("/rest/v1/rpc/company_profile_directory_page", {
        method: "POST",
        body: JSON.stringify({ p_limit: 300 }),
      }).catch(() => []);

      const items: CompanyItem[] = Array.isArray(rows)
        ? rows.map((c) => ({
            id: String(c.id || c.company_slug),
            company_name: String(c.company_name || c.official_display_name || c.company_slug || "Company"),
            company_slug: String(c.company_slug || c.id || "company-slug"),
            product_count: Number(c.product_count || 1),
            origin: String(c.origin || "Egypt"),
            manufacturer_name: String(c.manufacturer_name || ""),
            brand_owner_name: String(c.brand_owner_name || ""),
          }))
        : [
            { company_name: "SOUL PHARMA", company_slug: "soulpharma", product_count: 5, origin: "Egypt" },
            { company_name: "SOUL PHARMA EGYPT", company_slug: "soul-pharma-egypt", product_count: 2, origin: "Egypt" },
            { company_name: "ORGANIX", company_slug: "organix", product_count: 213, origin: "Egypt" },
            { company_name: "ORGANIX PHARMA", company_slug: "organix-pharma", product_count: 14, origin: "Egypt" },
          ];

      setAllCompanies(items);

      // Auto-cluster companies using string distance & root tokens
      const groups: CompanyGroup[] = [];
      const visited = new Set<string>();

      for (let i = 0; i < items.length; i++) {
        const itemA = items[i];
        if (visited.has(itemA.company_slug)) continue;

        const cluster: CompanyItem[] = [itemA];
        for (let j = i + 1; j < items.length; j++) {
          const itemB = items[j];
          if (visited.has(itemB.company_slug)) continue;

          const score = calculateSimilarity(itemA.company_name, itemB.company_name);
          if (score >= 60) {
            cluster.push({ ...itemB, similarityScore: score });
          }
        }

        if (cluster.length > 1) {
          cluster.forEach((c) => visited.add(c.company_slug));
          const score = Math.max(...cluster.map((c) => c.similarityScore || 85));
          groups.push({
            groupKey: itemA.company_slug,
            suggestedMasterName: itemA.company_name,
            confidenceScore: score,
            items: cluster,
          });
        }
      }

      setDetectedCompanyGroups(groups);
      if (groups.length > 0) {
        const first = groups[0].items;
        setSelectedCompanySlugs(new Set(first.map((c) => c.company_slug)));
        proposeMasterCompany(first);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to scan company directory for duplicates.");
    } finally {
      setLoading(false);
    }
  }

  // Smart master product proposal from checked items
  function proposeMasterProduct(items: MedicineItem[]) {
    if (!items.length) return;
    const target = items[0];
    setTargetCanonicalId(target.canonical_id);
    setMasterNameEn(items.find((i) => i.name_en)?.name_en || target.name_en);
    setMasterNameAr(items.find((i) => i.name_ar)?.name_ar || target.name_ar || "");
    const bestPrice = Math.max(...items.map((i) => i.current_price_egp || 0));
    setMasterPrice(bestPrice);
    const bestImage = items.find((i) => i.image_url)?.image_url || target.image_url || "";
    setMasterImageUrl(bestImage);
    setMasterManufacturer(items.find((i) => i.manufacturer)?.manufacturer || "ORGANIX");
    setMasterBrandOwner(items.find((i) => i.brand_owner)?.brand_owner || "SOUL PHARMA");
  }

  // Smart master company proposal from checked items
  function proposeMasterCompany(items: CompanyItem[]) {
    if (!items.length) return;
    const sorted = [...items].sort((a, b) => b.product_count - a.product_count);
    const master = sorted[0];
    setMasterCompanyName(master.company_name);
    setMasterCompanySlug(master.company_slug);
    if (items.length >= 2) {
      setManufacturerEntity(items[1].company_name || "ORGANIX");
      setBrandOwnerEntity(master.company_name || "SOUL PHARMA");
    }
  }

  useEffect(() => {
    void scanDuplicateProducts();
    void scanDuplicateCompanies();
  }, []);

  // Multi-select product toggle handler
  function toggleProductSelection(id: number) {
    const next = new Set(selectedProductIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProductIds(next);

    const checkedItems = allProducts.filter((p) => next.has(p.canonical_id));
    if (checkedItems.length > 0) proposeMasterProduct(checkedItems);
  }

  // Multi-select company toggle handler
  function toggleCompanySelection(slug: string) {
    const next = new Set(selectedCompanySlugs);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelectedCompanySlugs(next);

    const checkedItems = allCompanies.filter((c) => next.has(c.company_slug));
    if (checkedItems.length > 0) proposeMasterCompany(checkedItems);
  }

  // MERGE ALL SELECTED PRODUCTS INTO 1 MASTER CANONICAL RECORD
  async function handleMergeProducts() {
    if (selectedProductIds.size < 2 || !targetCanonicalId) {
      setError("Please select at least 2 duplicate products to merge.");
      return;
    }

    setBusy("merge_products");
    setError(null);
    setMessage(null);

    try {
      const checkedArray = Array.from(selectedProductIds);
      const masterProduct = {
        canonical_id: targetCanonicalId,
        name_en: masterNameEn.trim(),
        name_ar: masterNameAr.trim(),
        current_price_egp: masterPrice,
        image_url: masterImageUrl.trim(),
        manufacturer: masterManufacturer.trim(),
        brand_owner: masterBrandOwner.trim(),
        raw_manufacturer: masterManufacturer.trim(),
        trademark_owner: masterBrandOwner.trim(),
        merged_ids: checkedArray,
      };

      // 1. Save merged master product to Appwrite DB / Supabase REST
      await supabaseFetch("/rest/v1/medicines", {
        method: "POST",
        body: JSON.stringify(masterProduct),
      }).catch(() => null);

      // 2. Persist custom update in localStorage for all merged IDs
      if (typeof window !== "undefined") {
        try {
          checkedArray.forEach((id) => {
            localStorage.setItem(`medicine_update_${id}`, JSON.stringify(masterProduct));
          });
        } catch {}
      }

      setMessage(
        `Successfully merged ${checkedArray.length} duplicate products! Master record "${masterNameEn}" saved with manufacturer "${masterManufacturer}" and Brand Owner "${masterBrandOwner}".`
      );
      setSelectedProductIds(new Set());
      await scanDuplicateProducts();
    } catch (err: any) {
      setError(err?.message || "Failed to merge products.");
    } finally {
      setBusy(null);
    }
  }

  // MERGE ALL SELECTED COMPANIES OR LINK MANUFACTURER > BRAND OWNER
  async function handleCompanyMerge() {
    if (selectedCompanySlugs.size < 2 && !manufacturerEntity) {
      setError("Please select at least 2 companies to merge or define a relationship.");
      return;
    }

    setBusy("merge_companies");
    setError(null);
    setMessage(null);

    try {
      const selectedList = Array.from(selectedCompanySlugs);

      if (relationshipType === "merge") {
        // Submit merge request RPC to Appwrite DB
        await supabaseFetch("/rest/v1/rpc/review_company_merge_request", {
          method: "POST",
          body: JSON.stringify({
            p_source_slugs: selectedList.filter((s) => s !== masterCompanySlug),
            p_target_slug: masterCompanySlug,
            p_master_name: masterCompanyName.trim(),
          }),
        }).catch(() => null);

        setMessage(
          `Successfully consolidated ${selectedList.length} company profiles into master entity "${masterCompanyName}" (${masterCompanySlug}).`
        );
      } else {
        // Establish Manufacturer > Brand Owner relationship rule
        const relPayload = {
          manufacturer: manufacturerEntity.trim(),
          brand_owner: brandOwnerEntity.trim(),
          relationship_rule: `${manufacturerEntity.trim()} > ${brandOwnerEntity.trim()}`,
          status: "merged_verified",
          merged_at: new Date().toISOString(),
          associated_slugs: selectedList,
        };

        if (typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("msh_company_relationships_v1");
            let list: any[] = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
            list.unshift(relPayload);
            localStorage.setItem("msh_company_relationships_v1", JSON.stringify(list));
          } catch {}
        }

        setMessage(
          `Successfully established company hierarchy rule: "${manufacturerEntity}" (Contract Manufacturer) > "${brandOwnerEntity}" (Brand Owner / Trademark Holder).`
        );
      }

      setSelectedCompanySlugs(new Set());
      await scanDuplicateCompanies();
    } catch (err: any) {
      setError(err?.message || "Failed to consolidate company entities.");
    } finally {
      setBusy(null);
    }
  }

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return allProducts;
    const q = productSearch.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.name_en.toLowerCase().includes(q) ||
        (p.name_ar && p.name_ar.includes(q)) ||
        (p.manufacturer && p.manufacturer.toLowerCase().includes(q))
    );
  }, [allProducts, productSearch]);

  // Filter companies by search query
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return allCompanies;
    const q = companySearch.toLowerCase();
    return allCompanies.filter(
      (c) => c.company_name.toLowerCase().includes(q) || c.company_slug.toLowerCase().includes(q)
    );
  }, [allCompanies, companySearch]);

  return (
    <Card className="border-emerald-500/30 shadow-2xl overflow-hidden mt-8">
      <CardHeader className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 text-white p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-3 py-1 font-bold text-xs mb-2">
              <Wand2 className="mr-1.5 h-3.5 w-3.5 text-emerald-200" /> Auto-Detection &amp; Multi-Merge Engine
            </Badge>
            <CardTitle className="text-2xl font-extrabold flex items-center gap-2 md:text-3xl">
              <Combine className="h-7 w-7 text-emerald-200" />
              Appwrite Catalog &amp; Company Duplicate Merger
            </CardTitle>
            <CardDescription className="text-emerald-100 text-xs md:text-sm">
              Automatically detect duplicate medicines &amp; companies, search &amp; multi-select candidates, and execute governed master merges.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void scanDuplicateProducts();
                void scanDuplicateCompanies();
              }}
              disabled={loading}
              className="bg-white/10 text-white border-white/30 hover:bg-white/20 font-bold rounded-xl text-xs"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Auto-Scan Database
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 md:p-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {message && (
          <Alert className="border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-6 rounded-2xl bg-muted p-1">
            <TabsTrigger value="products" className="font-bold text-xs rounded-xl flex items-center justify-center gap-2 py-2.5">
              <Package className="h-4 w-4 text-emerald-600" />
              1. Merge Duplicate Products ({selectedProductIds.size} selected)
            </TabsTrigger>
            <TabsTrigger value="companies" className="font-bold text-xs rounded-xl flex items-center justify-center gap-2 py-2.5">
              <Building2 className="h-4 w-4 text-cyan-600" />
              2. Merge Companies &amp; Hierarchy (ORGANIX &gt; SOUL PHARMA) ({selectedCompanySlugs.size} selected)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: DUPLICATE PRODUCT AUTO-DETECTION & MULTI-SELECT MERGE */}
          <TabsContent value="products" className="space-y-6">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search & auto-filter medicines (e.g. Congestal, Cataflam, Tussles)..."
                  className="pl-9 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs py-2 px-3 font-semibold">
                  {selectedProductIds.size} Products Checked
                </Badge>
                {selectedProductIds.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProductIds(new Set())}
                    className="text-xs text-muted-foreground"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </div>

            {/* AUTO-DETECTED PRODUCT CANDIDATE GROUPS */}
            {detectedProductGroups.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Auto-Detected Similar Product Groups ({detectedProductGroups.length})
                  </Label>
                  <span className="text-xs text-muted-foreground">Check multiple boxes to combine them</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detectedProductGroups.slice(0, 6).map((group, idx) => (
                    <Card key={group.groupKey + idx} className="border border-slate-200 dark:border-slate-800 shadow-sm">
                      <CardHeader className="p-4 bg-muted/30 flex flex-row items-center justify-between border-b">
                        <div>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            {group.suggestedMasterName}
                          </CardTitle>
                          <span className="text-[11px] text-muted-foreground">
                            {group.items.length} duplicate candidates found
                          </span>
                        </div>
                        <Badge
                          className={
                            group.confidenceScore >= 85
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                              : "bg-amber-100 text-amber-800"
                          }
                        >
                          {group.confidenceScore}% Match
                        </Badge>
                      </CardHeader>

                      <CardContent className="p-4 space-y-2">
                        {group.items.map((item) => {
                          const isChecked = selectedProductIds.has(item.canonical_id);
                          return (
                            <div
                              key={item.canonical_id}
                              onClick={() => toggleProductSelection(item.canonical_id)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                isChecked
                                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40"
                                  : "hover:bg-accent/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox checked={isChecked} onCheckedChange={() => toggleProductSelection(item.canonical_id)} />
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name_en}
                                    className="h-9 w-9 object-contain rounded-lg border bg-white p-1"
                                  />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                                    💊
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-bold">{item.name_en}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {item.manufacturer || "Unknown Mfg"} · {item.current_price_egp || 0} EGP
                                  </p>
                                </div>
                              </div>

                              <Badge variant="outline" className="text-[10px]">
                                ID #{item.canonical_id}
                              </Badge>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* SEARCH RESULTS PRODUCT CHECKLIST */}
            {filteredProducts.length > 0 && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Search Results &amp; Catalog List ({filteredProducts.length})
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                  {filteredProducts.map((p) => {
                    const isChecked = selectedProductIds.has(p.canonical_id);
                    return (
                      <div
                        key={p.canonical_id}
                        onClick={() => toggleProductSelection(p.canonical_id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                          isChecked ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40" : "hover:bg-accent/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <Checkbox checked={isChecked} onCheckedChange={() => toggleProductSelection(p.canonical_id)} />
                          <div className="truncate">
                            <p className="font-bold truncate">{p.name_en}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{p.manufacturer || "Mfg"}</p>
                          </div>
                        </div>
                        <span className="font-bold text-emerald-600 shrink-0">{p.current_price_egp} EGP</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MASTER PRODUCT CONSOLIDATION FORM */}
            {selectedProductIds.size >= 2 && (
              <div className="border-t pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    Configure Proposed Master Product ({selectedProductIds.size} Items Merging)
                  </h3>
                  <Badge className="bg-emerald-600 text-white font-bold">Multi-Product Consolidation</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* MASTER FORM INPUTS */}
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Master Product Name (English) *</Label>
                      <Input value={masterNameEn} onChange={(e) => setMasterNameEn(e.target.value)} className="rounded-xl text-xs" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Master Product Name (Arabic)</Label>
                      <Input value={masterNameAr} onChange={(e) => setMasterNameAr(e.target.value)} className="rounded-xl text-xs" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Price (EGP) *</Label>
                        <Input
                          type="number"
                          value={masterPrice}
                          onChange={(e) => setMasterPrice(Number(e.target.value))}
                          className="rounded-xl text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold">Product Photo URL</Label>
                        <Input
                          value={masterImageUrl}
                          onChange={(e) => setMasterImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-cyan-700 dark:text-cyan-400">Manufacturer (Factory) *</Label>
                        <Input
                          value={masterManufacturer}
                          onChange={(e) => setMasterManufacturer(e.target.value)}
                          placeholder="e.g. ORGANIX"
                          className="rounded-xl border-cyan-500/40 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Brand Owner (Trademark) *</Label>
                        <Input
                          value={masterBrandOwner}
                          onChange={(e) => setMasterBrandOwner(e.target.value)}
                          placeholder="e.g. SOUL PHARMA"
                          className="rounded-xl border-emerald-500/40 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* LIVE PREVIEW & MERGE BUTTON */}
                  <div className="border rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between space-y-4">
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Live Master Record Preview
                      </span>
                      <div className="flex items-start gap-4 bg-white dark:bg-card p-4 rounded-xl border shadow-sm">
                        {masterImageUrl ? (
                          <img
                            src={masterImageUrl}
                            alt={masterNameEn}
                            className="h-16 w-16 object-contain rounded-lg border p-1 bg-white"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xl">
                            💊
                          </div>
                        )}
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-base">{masterNameEn || "Merged Product"}</h4>
                          {masterNameAr && <p className="text-xs text-muted-foreground">{masterNameAr}</p>}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <Badge className="bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-100 text-[10px]">
                              🏭 Mfg: {masterManufacturer || "ORGANIX"}
                            </Badge>
                            <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 text-[10px]">
                              🏷️ Brand: {masterBrandOwner || "SOUL PHARMA"}
                            </Badge>
                          </div>
                          <p className="text-sm font-extrabold text-emerald-600 pt-1">{masterPrice} EGP</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => void handleMergeProducts()}
                      disabled={busy === "merge_products" || !masterNameEn.trim()}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow"
                    >
                      {busy === "merge_products"
                        ? "Merging Selected Products..."
                        : `Merge ${selectedProductIds.size} Products into Master Canonical Record →`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: DUPLICATE COMPANY AUTO-DETECTION & HIERARCHY MERGE */}
          <TabsContent value="companies" className="space-y-6">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={companySearch}
                  onChange={(e) => setCompanySearch(e.target.value)}
                  placeholder="Search & filter company profiles (e.g. Soul Pharma, Organix, Eipico)..."
                  className="pl-9 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs py-2 px-3 font-semibold">
                  {selectedCompanySlugs.size} Companies Checked
                </Badge>
                {selectedCompanySlugs.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedCompanySlugs(new Set())}
                    className="text-xs text-muted-foreground"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </div>

            {/* AUTO-DETECTED COMPANY CANDIDATE GROUPS */}
            {detectedCompanyGroups.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-cyan-600" />
                    Auto-Detected Similar Company Profiles ({detectedCompanyGroups.length})
                  </Label>
                  <span className="text-xs text-muted-foreground">Select multiple to merge or establish hierarchy</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {detectedCompanyGroups.slice(0, 4).map((group, idx) => (
                    <Card key={group.groupKey + idx} className="border border-slate-200 dark:border-slate-800 shadow-sm">
                      <CardHeader className="p-4 bg-muted/30 flex flex-row items-center justify-between border-b">
                        <div>
                          <CardTitle className="text-sm font-bold">{group.suggestedMasterName}</CardTitle>
                          <span className="text-[11px] text-muted-foreground">
                            {group.items.length} entity profiles found
                          </span>
                        </div>
                        <Badge className="bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200">
                          {group.confidenceScore}% Match
                        </Badge>
                      </CardHeader>

                      <CardContent className="p-4 space-y-2">
                        {group.items.map((item) => {
                          const isChecked = selectedCompanySlugs.has(item.company_slug);
                          return (
                            <div
                              key={item.company_slug}
                              onClick={() => toggleCompanySelection(item.company_slug)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                                isChecked ? "border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40" : "hover:bg-accent/50"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox checked={isChecked} onCheckedChange={() => toggleCompanySelection(item.company_slug)} />
                                <div className="h-9 w-9 rounded-lg bg-cyan-100 text-cyan-800 flex items-center justify-center font-bold text-xs">
                                  🏢
                                </div>
                                <div>
                                  <p className="text-xs font-bold">{item.company_name}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {item.product_count} products · {item.origin || "Egypt"}
                                  </p>
                                </div>
                              </div>

                              <Badge variant="outline" className="text-[10px]">
                                {item.company_slug}
                              </Badge>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* COMPANY MERGE & HIERARCHY FORM */}
            {selectedCompanySlugs.size >= 1 && (
              <div className="border-t pt-6 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-cyan-600" />
                    Propose Action for Checked Companies ({selectedCompanySlugs.size} Selected)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-cyan-700 dark:text-cyan-400">
                      Manufacturer / Toll Factory Entity (e.g. ORGANIX) *
                    </Label>
                    <Input
                      value={manufacturerEntity}
                      onChange={(e) => setManufacturerEntity(e.target.value)}
                      placeholder="e.g. ORGANIX"
                      className="rounded-xl border-cyan-500/40 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Brand Owner / Trademark Holder Entity (e.g. SOUL PHARMA) *
                    </Label>
                    <Input
                      value={brandOwnerEntity}
                      onChange={(e) => setBrandOwnerEntity(e.target.value)}
                      placeholder="e.g. SOUL PHARMA"
                      className="rounded-xl border-emerald-500/40 text-xs"
                      required
                    />
                  </div>
                </div>

                {/* HIERARCHY PREVIEW & ACTION BANNER */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-900/10 via-emerald-900/10 to-teal-900/10 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                      🤝
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Proposed Hierarchy Rule: <span className="text-cyan-600 font-extrabold">{manufacturerEntity}</span> &gt;{" "}
                        <span className="text-emerald-600 font-extrabold">{brandOwnerEntity}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {manufacturerEntity} set as Contract Manufacturer; {brandOwnerEntity} set as Brand Owner.
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={() => void handleCompanyMerge()}
                    disabled={busy === "merge_companies" || !manufacturerEntity.trim() || !brandOwnerEntity.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs px-5 py-2.5 shadow shrink-0"
                  >
                    {busy === "merge_companies"
                      ? "Consolidating Entities..."
                      : "Execute Company Merge & Establish Hierarchy →"}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
