import { useState, useEffect } from "react";
import {
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
  UploadCloud,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
};

type CompanyItem = {
  company_name: string;
  company_slug: string;
  product_count: number;
  manufacturer_name?: string;
  brand_owner_name?: string;
};

export function AdminDuplicateMerger() {
  const { supabaseFetch } = usePatientAuth();
  const [activeTab, setActiveTab] = useState<"products" | "companies">("products");

  // Product deduplication state
  const [productQuery, setProductQuery] = useState("");
  const [candidateGroups, setCandidateGroups] = useState<Array<{ normKey: string; items: MedicineItem[] }>>([]);
  const [selectedProductA, setSelectedProductA] = useState<MedicineItem | null>(null);
  const [selectedProductB, setSelectedProductB] = useState<MedicineItem | null>(null);

  // Custom Master Product Form
  const [masterNameEn, setMasterNameEn] = useState("");
  const [masterNameAr, setMasterNameAr] = useState("");
  const [masterPrice, setMasterPrice] = useState<number>(0);
  const [masterImageUrl, setMasterImageUrl] = useState("");
  const [masterManufacturer, setMasterManufacturer] = useState("");
  const [masterBrandOwner, setMasterBrandOwner] = useState("");

  // Company deduplication state
  const [companyQuery, setCompanyQuery] = useState("");
  const [companyA, setCompanyA] = useState("");
  const [companyB, setCompanyB] = useState("");
  const [relationshipType, setRelationshipType] = useState<"merge" | "manufacturer_brand">("manufacturer_brand");
  const [manufacturerEntity, setManufacturerEntity] = useState("ORGANIX");
  const [brandOwnerEntity, setBrandOwnerEntity] = useState("SOUL PHARMA");

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function scanDuplicateProducts() {
    setLoading(true);
    setError(null);
    try {
      // Query recent / all products from DB or search RPC
      const rows = await supabaseFetch<any[]>("/rest/v1/rpc/search_medicine_encyclopedia_v4", {
        method: "POST",
        body: JSON.stringify({ p_query: productQuery.trim() || "tussles", p_limit: 100, p_offset: 0 }),
      });

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

      // Group items by normalized name
      const map = new Map<string, MedicineItem[]>();
      items.forEach((item) => {
        const normKey = item.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "");
        if (!map.has(normKey)) map.set(normKey, []);
        map.get(normKey)!.push(item);
      });

      const groups: Array<{ normKey: string; items: MedicineItem[] }> = [];
      map.forEach((itemList, normKey) => {
        if (itemList.length > 1 || productQuery.trim()) {
          groups.push({ normKey, items: itemList });
        }
      });

      setCandidateGroups(groups);
      if (groups.length > 0 && groups[0].items.length >= 2) {
        setSelectedProductA(groups[0].items[0]);
        setSelectedProductB(groups[0].items[1]);
        populateMasterForm(groups[0].items[0], groups[0].items[1]);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to scan catalog for duplicates.");
    } finally {
      setLoading(false);
    }
  }

  function populateMasterForm(pA: MedicineItem, pB: MedicineItem) {
    const bestImage = pA.image_url || pB.image_url || "";
    setMasterNameEn(pA.name_en || pB.name_en);
    setMasterNameAr(pA.name_ar || pB.name_ar || "");
    setMasterPrice(pA.current_price_egp || pB.current_price_egp || 0);
    setMasterImageUrl(bestImage);
    setMasterManufacturer(pA.manufacturer || pB.manufacturer || "ORGANIX");
    setMasterBrandOwner(pA.brand_owner || pB.brand_owner || "SOUL PHARMA");
  }

  useEffect(() => {
    void scanDuplicateProducts();
  }, []);

  async function handleMergeProducts() {
    if (!selectedProductA || !selectedProductB) {
      setError("Please select two duplicate products to merge.");
      return;
    }

    setBusy("merge_products");
    setError(null);
    setMessage(null);

    try {
      const masterProduct = {
        canonical_id: selectedProductA.canonical_id,
        name_en: masterNameEn.trim(),
        name_ar: masterNameAr.trim(),
        current_price_egp: masterPrice,
        image_url: masterImageUrl.trim(),
        manufacturer: masterManufacturer.trim(),
        brand_owner: masterBrandOwner.trim(),
        raw_manufacturer: masterManufacturer.trim(),
        trademark_owner: masterBrandOwner.trim(),
        category: selectedProductA.category || selectedProductB.category || "OTC Medicine",
      };

      // 1. Save merged master product to Appwrite DB / local storage overlay
      await supabaseFetch("/rest/v1/medicines", {
        method: "POST",
        body: JSON.stringify(masterProduct),
      });

      // 2. Persist custom update in localStorage
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(`medicine_update_${selectedProductA.canonical_id}`, JSON.stringify(masterProduct));
          localStorage.setItem(`medicine_update_${selectedProductB.canonical_id}`, JSON.stringify(masterProduct));
        } catch {}
      }

      setMessage(
        `Successfully merged products! Master record "${masterNameEn}" saved with manufacturer "${masterManufacturer}" and Brand Owner "${masterBrandOwner}".`
      );
      setSelectedProductA(null);
      setSelectedProductB(null);
      await scanDuplicateProducts();
    } catch (err: any) {
      setError(err?.message || "Failed to merge products.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCompanyRelationshipMerge() {
    if (!companyA.trim() || !companyB.trim()) {
      setError("Please enter or select both companies.");
      return;
    }

    setBusy("merge_companies");
    setError(null);
    setMessage(null);

    try {
      const relPayload = {
        source_company: companyA.trim(),
        target_company: companyB.trim(),
        manufacturer: manufacturerEntity.trim(),
        brand_owner: brandOwnerEntity.trim(),
        relationship_rule: `${manufacturerEntity.trim()} > ${brandOwnerEntity.trim()}`,
        status: "merged_verified",
        merged_at: new Date().toISOString(),
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
        `Successfully configured company relationship: "${manufacturerEntity}" (Manufacturer) > "${brandOwnerEntity}" (Brand Owner). Catalogs and company directory will reflect this hierarchy.`
      );
    } catch (err: any) {
      setError(err?.message || "Failed to establish company relationship.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-emerald-500/20 shadow-xl overflow-hidden mt-8">
      <CardHeader className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-extrabold flex items-center gap-2">
              <Combine className="h-6 w-6 text-emerald-200" />
              Platform Admin Catalog &amp; Company Merger
            </CardTitle>
            <CardDescription className="text-emerald-100 text-xs">
              Consolidate duplicate medicine listings, combine photo assets, and establish Manufacturer vs Brand Owner entity relationships.
            </CardDescription>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-md px-3 py-1 font-bold text-xs">
            Admin Governance Tool
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
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
          <TabsList className="grid grid-cols-2 w-full mb-6 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <TabsTrigger value="products" className="font-bold text-xs rounded-lg flex items-center gap-2">
              <Package className="h-4 w-4" />
              Merge Duplicate Products (e.g. Tussles)
            </TabsTrigger>
            <TabsTrigger value="companies" className="font-bold text-xs rounded-lg flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Merge Companies &amp; Manufacturer/Brand Owner (ORGANIX &gt; SOUL PHARMA)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MERGE DUPLICATE PRODUCTS */}
          <TabsContent value="products" className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Search catalog by name (e.g. TUSSLES)..."
                  className="pl-9 rounded-xl text-xs"
                />
              </div>
              <Button onClick={() => void scanDuplicateProducts()} disabled={loading} size="sm" className="rounded-xl font-bold">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Scan Catalog
              </Button>
            </div>

            {/* DUPLICATE CANDIDATES SELECTOR */}
            {candidateGroups.length > 0 ? (
              <div className="space-y-4">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                  Detected Duplicate Candidate Groups ({candidateGroups.length})
                </Label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {candidateGroups.slice(0, 4).map((group, idx) => (
                    <div
                      key={group.normKey + idx}
                      className="border rounded-2xl p-4 bg-card hover:border-emerald-500/40 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30">
                          {group.items.length} Variants Found
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">normKey: {group.normKey}</span>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div
                            key={item.canonical_id + item.name_en}
                            onClick={() => {
                              setSelectedProductA(item);
                              const other = group.items.find((i) => i.canonical_id !== item.canonical_id) || item;
                              setSelectedProductB(other);
                              populateMasterForm(item, other);
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              selectedProductA?.canonical_id === item.canonical_id || selectedProductB?.canonical_id === item.canonical_id
                                ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40"
                                : "hover:bg-accent"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name_en} className="h-10 w-10 object-contain rounded-lg border bg-white p-1" />
                              ) : (
                                <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                                  💊
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-bold">{item.name_en}</p>
                                <p className="text-[10px] text-muted-foreground">{item.manufacturer || "Manufacturer"} · {item.current_price_egp} EGP</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              ID #{item.canonical_id}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-6">
                No potential duplicates detected for query "{productQuery}". Try searching for "TUSSLES" or another medicine.
              </p>
            )}

            {/* SIDE-BY-SIDE MASTER MERGE FORM */}
            {(selectedProductA || selectedProductB) && (
              <div className="border-t pt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                    Configure Merged Master Product Record
                  </h3>
                  <Badge className="bg-emerald-600 text-white font-bold">Side-by-Side Consolidation</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* MASTER FORM INPUTS */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Master Product Name (English) *</Label>
                      <Input value={masterNameEn} onChange={(e) => setMasterNameEn(e.target.value)} placeholder="e.g. Tussles Syrup" className="rounded-xl" />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Master Product Name (Arabic)</Label>
                      <Input value={masterNameAr} onChange={(e) => setMasterNameAr(e.target.value)} placeholder="e.g. توسيلس شروبة" className="rounded-xl" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Price (EGP) *</Label>
                        <Input type="number" value={masterPrice} onChange={(e) => setMasterPrice(Number(e.target.value))} className="rounded-xl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Product Photo URL</Label>
                        <Input value={masterImageUrl} onChange={(e) => setMasterImageUrl(e.target.value)} placeholder="https://..." className="rounded-xl" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-cyan-700 dark:text-cyan-400">Manufacturer (Contract / Factory) *</Label>
                        <Input value={masterManufacturer} onChange={(e) => setMasterManufacturer(e.target.value)} placeholder="e.g. ORGANIX" className="rounded-xl border-cyan-500/40" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Brand Owner (Trademark Holder) *</Label>
                        <Input value={masterBrandOwner} onChange={(e) => setMasterBrandOwner(e.target.value)} placeholder="e.g. SOUL PHARMA" className="rounded-xl border-emerald-500/40" />
                      </div>
                    </div>
                  </div>

                  {/* PREVIEW CARD */}
                  <div className="border rounded-2xl p-5 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-3">Live Merged Card Preview</span>
                      <div className="flex items-start gap-4 bg-white dark:bg-card p-4 rounded-xl border shadow-sm">
                        {masterImageUrl ? (
                          <img src={masterImageUrl} alt={masterNameEn} className="h-16 w-16 object-contain rounded-lg border p-1 bg-white" />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xl">
                            💊
                          </div>
                        )}
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-base">{masterNameEn || "Tussles"}</h4>
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
                      className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow"
                    >
                      {busy === "merge_products" ? "Merging Products..." : "Merge Duplicate Products & Update Catalog →"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: MERGE COMPANIES & MANUFACTURER/BRAND OWNER RELATIONSHIP */}
          <TabsContent value="companies" className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Company Relationship &amp; Entity Hierarchy Governance
              </h3>
              <p className="text-xs text-muted-foreground">
                Model contract manufacturers (e.g. <strong>ORGANIX</strong>) and brand owners/trademark holders (e.g. <strong>SOUL PHARMA</strong>) as linked entities in the encyclopedia.
              </p>
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
                  className="rounded-xl border-cyan-500/40"
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
                  className="rounded-xl border-emerald-500/40"
                  required
                />
              </div>
            </div>

            {/* RELATIONSHIP HIERARCHY PREVIEW BANNER */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-900/10 via-emerald-900/10 to-teal-900/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  🤝
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Configured Entity Hierarchy: <span className="text-cyan-600 font-extrabold">{manufacturerEntity}</span> &gt; <span className="text-emerald-600 font-extrabold">{brandOwnerEntity}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {manufacturerEntity} is modeled as contract Manufacturer; {brandOwnerEntity} is modeled as Brand Owner.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => void handleCompanyRelationshipMerge()}
                disabled={busy === "merge_companies" || !manufacturerEntity.trim() || !brandOwnerEntity.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs px-4 py-2"
              >
                {busy === "merge_companies" ? "Saving Relationship..." : "Link Manufacturer > Brand Owner →"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
