import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface FormulaTinProps {
  brand: string;
  nameEn: string;
  nameAr: string;
  stage: string;
  specialtyCategory: string;
  specialtyLabelEn: string;
  specialtyLabelAr: string;
  imageUrl?: string;
  isAr?: boolean;
}

const BRAND_PHOTOS: Record<string, string> = {
  "hero-baby-1": "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80",
  "hero-baby-2": "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&auto=format&fit=crop&q=80",
  "hero-baby-lf": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
  "hero-baby-ar": "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&auto=format&fit=crop&q=80",
  "bebelac-1": "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80",
  "bebelac-2": "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&auto=format&fit=crop&q=80",
  "bebelac-lf": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
  "bebelac-ar": "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=600&auto=format&fit=crop&q=80",
  "nan-optipro-1": "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&auto=format&fit=crop&q=80",
  "nan-optipro-2": "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&auto=format&fit=crop&q=80",
  "nan-lf": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
  "aptamil-1": "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80",
  "aptamil-lf": "https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=80",
  "novalac-1": "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&auto=format&fit=crop&q=80",
  "similac-gold-1": "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80",
};

export function FormulaTinCard({
  brand,
  nameEn,
  nameAr,
  stage,
  specialtyCategory,
  specialtyLabelEn,
  specialtyLabelAr,
  imageUrl,
  isAr = false,
}: FormulaTinProps) {
  const [imageError, setImageError] = useState(false);

  const nameKey = nameEn.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  const photoUrl =
    imageUrl ||
    BRAND_PHOTOS[nameKey] ||
    "https://images.unsplash.com/photo-1595855759920-86582396756a?w=600&auto=format&fit=crop&q=80";

  const isLactoseFree = specialtyCategory === "lactose_free" || nameEn.toLowerCase().includes("lf");
  const isAntiReflux = specialtyCategory === "anti_reflux" || nameEn.toLowerCase().includes("ar");
  const isAntiColic = specialtyCategory === "anti_colic" || nameEn.toLowerCase().includes("ec");

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 shadow-md group">
      {/* Real Product Photo Background */}
      {!imageError ? (
        <img
          src={photoUrl}
          alt={nameEn}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 flex items-center justify-center p-4 text-center">
          <div className="text-white space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">{brand}</div>
            <div className="text-sm font-extrabold">{isAr ? nameAr : nameEn}</div>
          </div>
        </div>
      )}

      {/* Dark Overlay Gradient for Text Readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-black/20" />

      {/* Top Specialty Badge */}
      <div className="absolute top-2.5 right-2.5 z-10">
        <Badge className="bg-blue-600/90 hover:bg-blue-600 text-white text-[10px] backdrop-blur-md border border-white/20 font-bold px-2 py-0.5 shadow-sm">
          {isAr ? specialtyLabelAr : specialtyLabelEn}
        </Badge>
      </div>

      {/* Bottom Brand & Canister Details Overlay */}
      <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 text-white space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-300 drop-shadow">
            {brand}
          </span>
          <span className="text-[9px] text-blue-200/90 font-mono font-bold bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
            400g Canister
          </span>
        </div>

        <div className="text-xs font-extrabold text-white line-clamp-1 drop-shadow">
          {isAr ? nameAr : nameEn}
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          {isLactoseFree ? (
            <Badge variant="outline" className="bg-red-500/80 text-white border-red-400 text-[9px] px-1.5 py-0">
              🚫 {isAr ? "خالي من اللاكتوز" : "Lactose Free"}
            </Badge>
          ) : isAntiReflux ? (
            <Badge variant="outline" className="bg-purple-600/80 text-white border-purple-400 text-[9px] px-1.5 py-0">
              🛡️ {isAr ? "مضاد للارتجاع" : "Anti Reflux"}
            </Badge>
          ) : isAntiColic ? (
            <Badge variant="outline" className="bg-teal-600/80 text-white border-teal-400 text-[9px] px-1.5 py-0">
              🌿 {isAr ? "مضاد للتقلصات" : "Anti Colic"}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-600/80 text-white border-emerald-400 text-[9px] px-1.5 py-0">
              🍼 {isAr ? "حليب أطفال قياسي" : "Standard Formula"}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
