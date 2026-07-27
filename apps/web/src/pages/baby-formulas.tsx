import React, { useState, useMemo } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { BABY_FORMULAS_DATA, BabyFormula } from "@/data/baby-formulas-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Search, Baby, RefreshCw, CheckCircle2, AlertCircle, HeartHandshake, ShieldCheck, Sparkles, Filter, ArrowRight } from "lucide-react";

export default function BabyFormulasPage() {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");

  // Alternatives Modal State
  const [selectedFormulaForSimilars, setSelectedFormulaForSimilars] = useState<BabyFormula | null>(null);
  const [isSimilarsOpen, setIsSimilarsOpen] = useState(false);

  // Filter Formulas
  const filteredFormulas = useMemo(() => {
    return BABY_FORMULAS_DATA.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.name_en.toLowerCase().includes(q) ||
        item.name_ar.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.manufacturer.toLowerCase().includes(q) ||
        item.key_ingredients.toLowerCase().includes(q);

      const matchesStage = selectedStage === "all" || item.stage === selectedStage;
      const matchesSpecialty = selectedSpecialty === "all" || item.specialty_category === selectedSpecialty;

      return matchesSearch && matchesStage && matchesSpecialty;
    });
  }, [searchQuery, selectedStage, selectedSpecialty]);

  // Find exact alternatives & similars for a given formula
  const similarsList = useMemo(() => {
    if (!selectedFormulaForSimilars) return [];
    return BABY_FORMULAS_DATA.filter((item) => {
      if (item.id === selectedFormulaForSimilars.id) return false;
      
      // Match by specialty category or stage
      const sameSpecialty = item.specialty_category === selectedFormulaForSimilars.specialty_category;
      const sameStage = item.stage === selectedFormulaForSimilars.stage;

      return sameSpecialty || sameStage;
    });
  }, [selectedFormulaForSimilars]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-16 dark:bg-slate-950">
      {/* Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-900 px-4 py-12 text-white sm:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-sm">
                <Baby className="h-4 w-4 text-blue-300" />
                <span>{t("Pediatric Infant Nutrition Engine", "محرك حليب الرضع والتغذية التخصصية")}</span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-white">
                {t("Baby Formulas & Alternatives Search", "دليل حليب الأطفال وبدائل الرضع")}
              </h1>
              <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed">
                {t(
                  "Search, compare, and instantly find exact equivalent alternatives for infant formulas (Stage 1, Stage 2, Lactose-Free, Anti-Reflux, Anti-Colic, and Hypoallergenic) from the central medicines encyclopedia.",
                  "ابحث وقارن واعثر فورياً على البدائل المطابقة والأنواع المماثلة لحليب الرضع (المرحلة الأولى، الثانية، الخالي من اللاكتوز، مضاد الارتجاع، والتركيبات التخصصية) من موسوعة الدواء."
                )}
              </p>

              <div className="pt-2 flex flex-wrap gap-3 justify-center md:justify-start">
                <Button asChild className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">
                  <Link href="/request">
                    <HeartHandshake className="mr-2 h-4 w-4" />
                    {t("Request Formula Support", "طلب دعم حليب أطفال")}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-blue-300/40 text-blue-100 hover:bg-blue-800/50 rounded-xl">
                  <Link href="/ngos">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    {t("NGO Formula Programs", "برامج الجمعيات لحليب الأطفال")}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-300/30 flex items-center justify-center mx-auto text-blue-200">
                <RefreshCw className="h-8 w-8 animate-spin-slow" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  {t("Instant Alternatives Engine", "مستكشف البدائل الفوري")}
                </h3>
                <p className="text-xs text-blue-200 mt-1">
                  {t("Is your formula out of stock? Click 'Find Alternatives' on any product to view exact substitutes with matching nutritional specs.", "هل الحليب غير متوفر؟ انقر فوق 'بحث عن بدائل' لمعاينة الأنواع المطابقة للمواصفات فوراً.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <main className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Search & Filter Control Panel */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-sm space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search by formula name (e.g. Hero Baby, NAN, Bebelac, Aptamil, Novalac, LF, AR)...", "ابحث باسم حليب الأطفال (مثال: هيرو بيبى، نان، بيبلاك، أبتاميل، نوفالاك، LF، AR)...")}
              className="pl-10 h-11 text-sm rounded-xl border-slate-200 dark:border-slate-800"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t text-xs">
            {/* Stage Filter */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t("Age Stage", "المرحلة العمرية")}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "all", labelEn: "All Stages", labelAr: "كل المراحل" },
                  { key: "stage_1", labelEn: "Stage 1 (0-6m)", labelAr: "المرحلة 1 (0-6 أشهر)" },
                  { key: "stage_2", labelEn: "Stage 2 (6-12m)", labelAr: "المرحلة 2 (6-12 شهرًا)" },
                  { key: "specialty", labelEn: "Special Needs / Medical", labelAr: "حالات خاصة وترميمية" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSelectedStage(s.key)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition ${
                      selectedStage === s.key
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {isAr ? s.labelAr : s.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Specialty Category Filter */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                {t("Special Medical Indication", "التصنيف الطبي التخصصي")}:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: "all", labelEn: "All Formulas", labelAr: "جميع الأنواع" },
                  { key: "standard", labelEn: "Standard", labelAr: "قياسي" },
                  { key: "lactose_free", labelEn: "Lactose-Free (LF)", labelAr: "خالي من اللاكتوز (LF)" },
                  { key: "anti_reflux", labelEn: "Anti-Reflux (AR)", labelAr: "مضاد للارتجاع (AR)" },
                  { key: "anti_colic", labelEn: "Anti-Colic / Easy Digest", labelAr: "مضاد للتقلصات" },
                ].map((sp) => (
                  <button
                    key={sp.key}
                    onClick={() => setSelectedSpecialty(sp.key)}
                    className={`px-3 py-1.5 rounded-lg border font-medium transition ${
                      selectedSpecialty === sp.key
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {isAr ? sp.labelAr : sp.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Stats */}
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>
            {t(`Showing ${filteredFormulas.length} baby formula products`, `عرض ${filteredFormulas.length} منتج حليب أطفال`)}
          </span>
          {(selectedStage !== "all" || selectedSpecialty !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedStage("all");
                setSelectedSpecialty("all");
              }}
              className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
            >
              <RefreshCw className="h-3 w-3" />
              {t("Reset filters", "إعادة ضبط الفلاتر")}
            </button>
          )}
        </div>

        {/* Baby Formulas Product Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFormulas.map((formula) => (
            <Card key={formula.id} className="flex flex-col justify-between overflow-hidden hover:shadow-lg transition-all border-slate-200 dark:border-slate-800">
              <CardHeader className="p-4 bg-slate-50/70 dark:bg-slate-900/50 border-b">
                <div className="flex items-start justify-between gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold">
                    👶 {isAr ? formula.stage_label_ar : formula.stage_label_en}
                  </Badge>
                  <Badge className="bg-emerald-600 text-white text-xs font-bold">
                    {formula.price_egp} EGP
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white mt-2 leading-tight">
                  {isAr ? formula.name_ar : formula.name_en}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 font-medium">
                  {formula.brand} • {formula.manufacturer}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 space-y-3 text-xs flex-1">
                <div className="aspect-video rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                  <img
                    src={formula.image_url}
                    alt={formula.name_en}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-indigo-600/90 text-white text-[10px] backdrop-blur-sm">
                      {isAr ? formula.specialty_label_ar : formula.specialty_label_en}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border text-[11px]">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t("Nutritional Highlights", "المواصفات الغذائية")}:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-2">
                    {formula.key_ingredients}
                  </p>
                </div>

                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed italic">
                  "{isAr ? formula.notes_ar : formula.notes_en}"
                </p>
              </CardContent>

              <CardFooter className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setSelectedFormulaForSimilars(formula);
                    setIsSimilarsOpen(true);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm"
                >
                  <Sparkles className="mr-2 h-4 w-4 text-yellow-300" />
                  {t("Find Similars & Alternatives", "البحث عن البدائل والأنواع المماثلة")}
                </Button>

                <Button asChild variant="outline" className="w-full text-xs rounded-xl border-slate-300">
                  <Link href={`/request?medicine=${encodeURIComponent(formula.name_en)}`}>
                    {t("Request this formula", "طلب هـذا الحليب")}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>

      {/* Similars & Alternatives Dialog */}
      <Dialog open={isSimilarsOpen} onOpenChange={setIsSimilarsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600">
              <Sparkles className="h-5 w-5" />
              <DialogTitle className="text-xl font-bold">
                {t("Equivalent Alternatives & Similars Engine", "محرك البدائل والأنواع المطابقة")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              {t("Direct substitutes matching stage, nutritional base, and medical indication for:", "البدائل المباشرة المطابقة للمرحلة العمرية والتصنيف الطبي لـ:")}{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {selectedFormulaForSimilars ? (isAr ? selectedFormulaForSimilars.name_ar : selectedFormulaForSimilars.name_en) : ""}
              </strong>
            </DialogDescription>
          </DialogHeader>

          {selectedFormulaForSimilars && (
            <div className="space-y-6 py-2">
              {/* Selected Reference Card */}
              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-200 dark:border-blue-800 flex items-start gap-4">
                <img
                  src={selectedFormulaForSimilars.image_url}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border"
                />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-sm text-blue-950 dark:text-blue-100">
                    {isAr ? selectedFormulaForSimilars.name_ar : selectedFormulaForSimilars.name_en}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 text-[10px]">
                      {isAr ? selectedFormulaForSimilars.stage_label_ar : selectedFormulaForSimilars.stage_label_en}
                    </Badge>
                    <Badge variant="outline" className="bg-indigo-100 text-indigo-800 text-[10px]">
                      {isAr ? selectedFormulaForSimilars.specialty_label_ar : selectedFormulaForSimilars.specialty_label_en}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Substitutes List */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {t("Recommended Equivalent Substitutes", "البدائل والبدائل المطابقة الموصى بها")}:
                </h4>

                {similarsList.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-4 text-center border rounded-xl">
                    {t("No other exact substitutes currently indexed in this category.", "لا توجد بدائل أخرى مدرجة حالياً في هذه الفئة المحدد.")}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {similarsList.map((alt) => (
                      <div
                        key={alt.id}
                        className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 hover:border-blue-400 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs text-slate-900 dark:text-white leading-snug">
                            {isAr ? alt.name_ar : alt.name_en}
                          </div>
                          <Badge className="bg-emerald-600 text-white text-[10px] shrink-0">
                            {alt.price_egp} EGP
                          </Badge>
                        </div>

                        <div className="text-[11px] text-slate-500">
                          {alt.brand} • {alt.manufacturer}
                        </div>

                        <div className="text-[10px] bg-slate-50 dark:bg-slate-800 p-2 rounded text-slate-600 dark:text-slate-300">
                          <strong>{t("Ingredients", "المكونات")}:</strong> {alt.key_ingredients}
                        </div>

                        <div className="pt-1 flex items-center justify-between">
                          <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            ✓ {t("Direct Equivalent", "بديل مباشر مطابق")}
                          </Badge>

                          <Button asChild size="sm" variant="secondary" className="h-7 text-[10px]">
                            <Link href={`/request?medicine=${encodeURIComponent(alt.name_en)}`}>
                              {t("Request", "طلب")}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSimilarsOpen(false)}>
              {t("Close", "إغلاق")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
