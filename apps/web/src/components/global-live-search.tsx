import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, Sparkles, ArrowRight, Pill, Baby, Building2 } from "lucide-react";
import { searchCollection, SearchableMedicine } from "@/lib/search-engine";
import { BABY_FORMULAS_DATA } from "@/data/baby-formulas-data";

export function GlobalLiveSearch() {
  const { language, t } = useLanguage();
  const [, setLocation] = useLocation();
  const isAr = language === "ar";

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [dataset, setDataset] = useState<SearchableMedicine[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load public dataset on mount for instant client-side autocomplete
  useEffect(() => {
    fetch("/data/egyptian-medicines-dataset.json")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.medicines)) {
          setDataset(data.medicines);
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Perform instant fuzzy search across dataset + baby formulas
  const combinedList = [...BABY_FORMULAS_DATA, ...dataset];
  const searchResults = query.trim().length >= 2 ? searchCollection(combinedList, query).slice(0, 7) : [];

  const handleSelect = (item: SearchableMedicine) => {
    setIsOpen(false);
    setQuery("");
    if (item.brand || item.stage || (item as any).specialty_category) {
      setLocation(`/formulas?q=${encodeURIComponent(item.name_en || "")}`);
    } else {
      setLocation(`/medicines?q=${encodeURIComponent(item.name_en || "")}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      setIsOpen(false);
      setLocation(`/medicines?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("Search medicines, formulas, active ingredients...", "بحث عن الأدوية، حليب الأطفال، المواد الفعالة...")}
          className="pl-9 pr-8 h-9 text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-full focus-visible:ring-blue-500 shadow-sm transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Instant Autocomplete Live Search Dropdown */}
      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden text-xs divide-y divide-slate-100 dark:divide-slate-900">
          <div className="p-2 bg-slate-50/80 dark:bg-slate-900/50 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              {t("Instant Suggestions", "اقتراحات فورية")}
            </span>
            <span>{searchResults.length} {t("results", "نتائج")}</span>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {searchResults.length > 0 ? (
              searchResults.map(({ item, matchReason }) => {
                const isFormula = !!(item as any).brand || !!(item as any).stage;
                return (
                  <button
                    key={item.canonical_id || item.id || item.name_en}
                    onClick={() => handleSelect(item)}
                    className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-blue-50/70 dark:hover:bg-blue-950/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border shrink-0 flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                        ) : isFormula ? (
                          <Baby className="h-4 w-4 text-sky-500" />
                        ) : (
                          <Pill className="h-4 w-4 text-blue-500" />
                        )}
                      </div>
                      <div className="truncate">
                        <div className="font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          <span>{isAr ? item.name_ar || item.name_en : item.name_en}</span>
                          {isFormula && (
                            <Badge className="bg-sky-500/90 text-white text-[9px] px-1 py-0">
                              Formula
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {item.manufacturer} • {item.scientific_name || item.category || item.dosage_form}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {item.current_price_egp ? (
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                          {item.current_price_egp} EGP
                        </span>
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-500 text-xs">
                {t("No matching medicines found", "لم يتم العثور على أدوية مطابقة")}
              </div>
            )}
          </div>

          {/* Full Search Redirect Button */}
          <button
            onClick={() => {
              setIsOpen(false);
              setLocation(`/medicines?q=${encodeURIComponent(query.trim())}`);
            }}
            className="w-full p-2.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>{t(`Search all results for "${query}"`, `البحث عن جميع النتائج لـ "${query}"`)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
