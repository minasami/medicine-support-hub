import { useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, CheckCircle, Clock, Search, Heart, Wind, Pill, Palette } from "lucide-react";

type ProductStatus = "pending" | "dispensed" | "flagged";
type ProductCategory = "all" | "skin_care" | "hair" | "otc" | "cosmetics";

interface CosmeticProduct {
  id: number;
  name: string;
  nameAr: string;
  category: "skin_care" | "hair" | "otc" | "cosmetics";
  brand: string;
  quantity: number;
  requester: string;
  date: string;
  status: ProductStatus;
}

const MOCK_PRODUCTS: CosmeticProduct[] = [
  { id: 1, name: "Eucerin Urea Cream 10%", nameAr: "كريم يوسيرين يوريا 10%", category: "skin_care", brand: "Eucerin", quantity: 2, requester: "Fatima Al-Ahmad", date: "2026-06-22", status: "pending" },
  { id: 2, name: "Nizoral Anti-Dandruff Shampoo", nameAr: "شامبو نيزورال لقشرة الرأس", category: "hair", brand: "Nizoral", quantity: 1, requester: "Sara Nasser", date: "2026-06-22", status: "pending" },
  { id: 3, name: "Cetaphil Moisturizing Lotion", nameAr: "لوشن سيتافيل المرطب", category: "skin_care", brand: "Cetaphil", quantity: 3, requester: "Layla Hussein", date: "2026-06-21", status: "dispensed" },
  { id: 4, name: "Voltaren Emulgel 1%", nameAr: "فولتارين جل 1%", category: "otc", brand: "Voltaren", quantity: 2, requester: "Ahmed Khalid", date: "2026-06-21", status: "pending" },
  { id: 5, name: "La Roche-Posay Anthelios SPF50", nameAr: "لا روش بوزيه أنثيليوس SPF50", category: "cosmetics", brand: "La Roche-Posay", quantity: 1, requester: "Mona Ali", date: "2026-06-20", status: "dispensed" },
  { id: 6, name: "Bioderma Sensibio H2O", nameAr: "بيوديرما سنسيبيو H2O", category: "skin_care", brand: "Bioderma", quantity: 2, requester: "Nour Hassan", date: "2026-06-22", status: "pending" },
  { id: 7, name: "Pantene Hairfall Control Shampoo", nameAr: "شامبو بانتين لتساقط الشعر", category: "hair", brand: "Pantene", quantity: 1, requester: "Hessa Saad", date: "2026-06-22", status: "pending" },
  { id: 8, name: "Panadol Extra", nameAr: "بانادول إكسترا", category: "otc", brand: "Panadol", quantity: 2, requester: "Omar Saeed", date: "2026-06-22", status: "flagged" },
  { id: 9, name: "Maybelline Fit Me Foundation", nameAr: "كريم أساس مايبيلين فيت مي", category: "cosmetics", brand: "Maybelline", quantity: 1, requester: "Rania Khaled", date: "2026-06-21", status: "pending" },
  { id: 10, name: "Avène Cicalfate Cream", nameAr: "كريم أفين سيكالفات", category: "skin_care", brand: "Avène", quantity: 1, requester: "Dana Faris", date: "2026-06-20", status: "dispensed" },
];

const CATEGORY_CONFIG: Record<string, { labelEn: string; labelAr: string; color: string; bgColor: string; icon: React.ElementType }> = {
  all:       { labelEn: "All",       labelAr: "الكل",              color: "text-slate-700",  bgColor: "bg-slate-100",  icon: Sparkles },
  skin_care: { labelEn: "Skin Care", labelAr: "العناية بالبشرة",   color: "text-pink-700",   bgColor: "bg-pink-100",   icon: Heart },
  hair:      { labelEn: "Hair",      labelAr: "الشعر",             color: "text-purple-700", bgColor: "bg-purple-100", icon: Wind },
  otc:       { labelEn: "OTC",       labelAr: "أدوية مكشوفة",      color: "text-amber-700",  bgColor: "bg-amber-100",  icon: Pill },
  cosmetics: { labelEn: "Cosmetics", labelAr: "مستحضرات التجميل",  color: "text-rose-700",   bgColor: "bg-rose-100",   icon: Palette },
};

const STATUS_CONFIG: Record<ProductStatus, { en: string; ar: string; color: string }> = {
  pending:  { en: "Pending",  ar: "قيد الانتظار", color: "bg-yellow-100 text-yellow-800" },
  dispensed:{ en: "Dispensed",ar: "تم الصرف",     color: "bg-emerald-100 text-emerald-800" },
  flagged:  { en: "Flagged",  ar: "موقوف",         color: "bg-red-100 text-red-800" },
};

export default function CosmeticianPortal() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [products, setProducts] = useState<CosmeticProduct[]>(MOCK_PRODUCTS);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ProductCategory>("all");
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  function applyFilters(list: CosmeticProduct[]) {
    let filtered = list;
    if (categoryFilter !== "all") filtered = filtered.filter(p => p.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) || p.nameAr.includes(q) || p.requester.toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  const pending   = applyFilters(products.filter(p => p.status === "pending"));
  const dispensed = applyFilters(products.filter(p => p.status === "dispensed"));
  const flagged   = applyFilters(products.filter(p => p.status === "flagged"));

  const categoryCounts = Object.keys(CATEGORY_CONFIG).reduce<Record<string, number>>((acc, key) => {
    acc[key] = key === "all"
      ? products.filter(p => p.status === "pending").length
      : products.filter(p => p.category === key && p.status === "pending").length;
    return acc;
  }, {});

  function handleDispense(id: number) {
    setLoading(l => ({ ...l, [id]: true }));
    setTimeout(() => {
      setProducts(ps => ps.map(p => p.id === id ? { ...p, status: "dispensed" } : p));
      setLoading(l => ({ ...l, [id]: false }));
      toast({ title: t("Product Dispensed", "تم صرف المنتج") });
    }, 600);
  }

  function handleFlag(id: number) {
    setProducts(ps => ps.map(p => p.id === id ? { ...p, status: "flagged" } : p));
    toast({ title: t("Product Flagged", "تم إيقاف المنتج"), variant: "destructive" });
  }

  function ProductCard({ p, canAct }: { p: CosmeticProduct; canAct: boolean }) {
    const cat = CATEGORY_CONFIG[p.category];
    const st = STATUS_CONFIG[p.status];
    const Icon = cat.icon;
    return (
      <Card className="border-l-4 border-l-pink-400 hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="font-bold text-sm mb-1">{language === "en" ? p.name : p.nameAr}</div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cat.bgColor} ${cat.color}`}>
                  <Icon className="w-3 h-3" />
                  {language === "en" ? cat.labelEn : cat.labelAr}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                  {language === "en" ? st.en : st.ar}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="text-xs text-muted-foreground">{p.date}</div>
              <div className="text-xs font-semibold mt-0.5">{p.brand}</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm bg-pink-50 rounded px-3 py-2 mb-3">
            <div>
              <span className="text-muted-foreground text-xs">{t("For:", "لـ:")}</span>
              <span className="font-medium ml-1">{p.requester}</span>
            </div>
            <span className="font-semibold text-pink-700">×{p.quantity}</span>
          </div>

          {canAct && (
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 gap-1.5 bg-pink-600 hover:bg-pink-700"
                onClick={() => handleDispense(p.id)} disabled={loading[p.id]}>
                <CheckCircle className="w-3.5 h-3.5" />
                {t("Mark Dispensed", "تم الصرف")}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => handleFlag(p.id)}>
                {t("Flag", "إيقاف")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {t("Cosmetician Portal", "بوابة خبير التجميل")}
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-pink-600" />
          {t("Cosmetic & OTC Product Queue", "قائمة منتجات التجميل والأدوية المكشوفة")}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("Review and dispense cosmetic, skincare, hair, and OTC products.", "راجع واصرف منتجات التجميل والعناية بالبشرة والشعر والأدوية المكشوفة.")}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { count: products.length, label: t("Total", "الإجمالي"), className: "bg-pink-700 text-white border-0", numColor: "" },
          { count: products.filter(p => p.status === "pending").length, label: t("Pending", "قيد الانتظار"), className: "bg-yellow-50 border-yellow-200", numColor: "text-yellow-800" },
          { count: products.filter(p => p.status === "dispensed").length, label: t("Dispensed", "تم الصرف"), className: "bg-emerald-50 border-emerald-200", numColor: "text-emerald-800" },
          { count: products.filter(p => p.status === "flagged").length, label: t("Flagged", "موقوف"), className: "bg-red-50 border-red-200", numColor: "text-red-800" },
        ].map((s, i) => (
          <Card key={i} className={s.className}>
            <CardContent className="p-4 text-center">
              <div className={`text-2xl font-bold ${s.numColor}`}>{s.count}</div>
              <div className={`text-xs mt-1 ${i === 0 ? "text-pink-200" : "text-muted-foreground"}`}>{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(CATEGORY_CONFIG) as ProductCategory[]).map(key => {
          const cfg = CATEGORY_CONFIG[key];
          const Icon = cfg.icon;
          const isActive = categoryFilter === key;
          return (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all
                ${isActive
                  ? `${cfg.bgColor} ${cfg.color} border-current shadow-sm`
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
            >
              <Icon className="w-3 h-3" />
              {language === "en" ? cfg.labelEn : cfg.labelAr}
              {categoryCounts[key] > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${isActive ? "bg-white/30" : "bg-slate-100"}`}>
                  {categoryCounts[key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t("Search products or requesters…", "ابحث عن المنتجات أو مقدمي الطلبات…")}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Status tabs */}
      <Tabs defaultValue="pending">
        <TabsList className="mb-4">
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t("Pending", "قيد الانتظار")} {pending.length > 0 ? `(${pending.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="dispensed">{t("Dispensed", "تم الصرف")} {dispensed.length > 0 ? `(${dispensed.length})` : ""}</TabsTrigger>
          <TabsTrigger value="flagged">{t("Flagged", "موقوف")} {flagged.length > 0 ? `(${flagged.length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pending.map(p => <ProductCard key={p.id} p={p} canAct />)}
          {!pending.length && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
              <div className="font-medium">{t("All products dispensed!", "تم صرف جميع المنتجات!")}</div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="dispensed" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dispensed.map(p => <ProductCard key={p.id} p={p} canAct={false} />)}
          {!dispensed.length && <div className="col-span-full text-center py-12 text-muted-foreground text-sm">{t("No dispensed products", "لا منتجات تم صرفها")}</div>}
        </TabsContent>
        <TabsContent value="flagged" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {flagged.map(p => <ProductCard key={p.id} p={p} canAct={false} />)}
          {!flagged.length && <div className="col-span-full text-center py-12 text-muted-foreground text-sm">{t("No flagged products", "لا منتجات موقوفة")}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
