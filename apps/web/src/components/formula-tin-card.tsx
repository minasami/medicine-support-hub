import React from "react";
import { Badge } from "@/components/ui/badge";

interface FormulaTinProps {
  brand: string;
  nameEn: string;
  nameAr: string;
  stage: string;
  specialtyCategory: string;
  specialtyLabelEn: string;
  specialtyLabelAr: string;
  isAr?: boolean;
}

const BRAND_THEMES: Record<string, { bg: string; border: string; accent: string; text: string }> = {
  "hero baby": {
    bg: "from-blue-600 to-indigo-700",
    border: "border-blue-300",
    accent: "bg-amber-400 text-slate-900",
    text: "Hero Baby",
  },
  "bebelac": {
    bg: "from-sky-500 to-blue-700",
    border: "border-sky-300",
    accent: "bg-sky-200 text-sky-900",
    text: "Bebelac",
  },
  "nan (nestlé)": {
    bg: "from-blue-700 to-slate-800",
    border: "border-amber-300",
    accent: "bg-amber-300 text-blue-950",
    text: "NAN Optipro",
  },
  "aptamil": {
    bg: "from-blue-800 to-indigo-900",
    border: "border-cyan-400",
    accent: "bg-cyan-300 text-slate-950",
    text: "Aptamil Advance",
  },
  "novalac": {
    bg: "from-teal-600 to-blue-800",
    border: "border-teal-300",
    accent: "bg-teal-200 text-teal-950",
    text: "Novalac",
  },
  "similac": {
    bg: "from-amber-600 to-amber-800",
    border: "border-amber-300",
    accent: "bg-amber-200 text-amber-950",
    text: "Similac Gold",
  },
};

export function FormulaTinCard({
  brand,
  nameEn,
  nameAr,
  stage,
  specialtyCategory,
  specialtyLabelEn,
  specialtyLabelAr,
  isAr = false,
}: FormulaTinProps) {
  const brandKey = brand.toLowerCase().trim();
  const theme = BRAND_THEMES[brandKey] || {
    bg: "from-blue-700 to-indigo-800",
    border: "border-blue-300",
    accent: "bg-amber-300 text-slate-900",
    text: brand,
  };

  const isLactoseFree = specialtyCategory === "lactose_free" || nameEn.toLowerCase().includes("lf");
  const isAntiReflux = specialtyCategory === "anti_reflux" || nameEn.toLowerCase().includes("ar");
  const isAntiColic = specialtyCategory === "anti_colic" || nameEn.toLowerCase().includes("ec") || nameEn.toLowerCase().includes("comfort");

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center p-3 shadow-inner">
      {/* Soft Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-blue-950 to-slate-900" />

      {/* Formula Canister Graphic */}
      <div className="relative z-10 flex items-center gap-4 w-full max-w-[280px]">
        {/* Metal Formula Tin Container */}
        <div className="relative w-24 h-32 rounded-2xl bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 border-2 border-slate-300 shadow-xl flex flex-col items-center justify-between p-1.5 shrink-0 overflow-hidden">
          {/* Top Lid / Scoop Seal */}
          <div className="w-full h-4 rounded-t-xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 border-b border-amber-500 flex items-center justify-center">
            <div className="w-6 h-1 rounded-full bg-amber-600/60" />
          </div>

          {/* Main Brand Tin Label */}
          <div className={`w-full flex-1 my-1 rounded-lg bg-gradient-to-b ${theme.bg} p-1.5 flex flex-col justify-between items-center text-center text-white shadow-inner`}>
            {/* Top Brand Tag */}
            <span className="text-[9px] font-black uppercase tracking-wider text-amber-200 drop-shadow">
              {theme.text}
            </span>

            {/* Center Formula Stage Badge */}
            <div className="my-auto">
              <span className="text-xs font-black drop-shadow-md block leading-tight">
                {isLactoseFree
                  ? "LF"
                  : isAntiReflux
                  ? "AR"
                  : isAntiColic
                  ? "EC"
                  : stage.includes("1")
                  ? "1"
                  : stage.includes("2")
                  ? "2"
                  : "3"}
              </span>
              <span className="text-[8px] opacity-90 block font-semibold">
                {isLactoseFree
                  ? "Lactose Free"
                  : isAntiReflux
                  ? "Anti Reflux"
                  : isAntiColic
                  ? "Anti Colic"
                  : "Infant Milk"}
              </span>
            </div>

            {/* Bottom Net Weight */}
            <span className="text-[7px] text-blue-100/80 font-mono">400g e</span>
          </div>

          {/* Bottom Rim */}
          <div className="w-full h-1.5 rounded-b-xl bg-slate-400/80" />
        </div>

        {/* Canister Label Highlights */}
        <div className="space-y-1.5 text-left text-white flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
              {brand}
            </span>
          </div>

          <div className="text-xs font-bold text-white line-clamp-2 leading-tight">
            {isAr ? nameAr : nameEn}
          </div>

          <div className="flex flex-wrap gap-1 pt-0.5">
            {isLactoseFree ? (
              <Badge className="bg-red-500 text-white text-[9px] px-1.5 py-0">
                🚫 {isAr ? "خالي من اللاكتوز" : "Lactose Free"}
              </Badge>
            ) : isAntiReflux ? (
              <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0">
                🛡️ {isAr ? "مضاد للارتجاع" : "Anti Reflux"}
              </Badge>
            ) : isAntiColic ? (
              <Badge className="bg-teal-600 text-white text-[9px] px-1.5 py-0">
                🌿 {isAr ? "مضاد للتقلصات" : "Anti Colic"}
              </Badge>
            ) : (
              <Badge className="bg-blue-600 text-white text-[9px] px-1.5 py-0">
                🍼 {isAr ? "حليب أطفال قياسي" : "Standard Formula"}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
