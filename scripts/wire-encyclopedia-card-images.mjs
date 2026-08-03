#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "apps/web/src/pages/medicines-encyclopedia.tsx");
let t = fs.readFileSync(target, "utf8");
if (t.trim() === "PLACEHOLDER" || t.length < 500) {
  console.error(
    "encyclopedia file is missing/corrupt — restore from git first:\n  git checkout 6a5d46e70e38826efceda5ab4a209a5cd9c6f651 -- apps/web/src/pages/medicines-encyclopedia.tsx",
  );
  process.exit(1);
}
if (t.includes("object-contain") && t.includes("image_url?:")) {
  console.log("Already has card images");
  process.exit(0);
}

if (!t.includes("image_url?:")) {
  t = t.replace(
    "  current_price_egp: number | null;\n  public_url?: string | null;",
    "  current_price_egp: number | null;\n  image_url?: string | null;\n  public_url?: string | null;",
  );
}

const needle = `                <Card
                  key={\`${item.canonical_id}-${item.name_en}\`}
                  className="group hover:shadow-md transition-all duration-200 border-border hover:border-emerald-500/40 flex flex-col justify-between"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-foreground group-hover:text-emerald-600 transition-colors line-clamp-2 text-base">
                          {item.name_en || item.name_ar || "Unnamed Medicine"}
                        </h4>`;

const insert = `                <Card
                  key={\`${item.canonical_id}-${item.name_en}\`}
                  className="group hover:shadow-md transition-all duration-200 border-border hover:border-emerald-500/40 flex flex-col justify-between overflow-hidden"
                >
                  <a href={monographHref(item)} className="block relative aspect-[4/3] bg-muted/40 overflow-hidden border-b border-border">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name_en || item.name_ar || "Medicine"}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
                        onError={(e) => {
                          const el = e.currentTarget;
                          el.style.display = "none";
                          const fb = el.nextElementSibling as HTMLElement | null;
                          if (fb) fb.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={\`absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground ${item.image_url ? "hidden" : ""}\`}
                    >
                      <span className="text-3xl opacity-50" aria-hidden>
                        💊
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {t("No photo", "لا توجد صورة")}
                      </span>
                    </div>
                  </a>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-foreground group-hover:text-emerald-600 transition-colors line-clamp-2 text-base">
                          {item.name_en || item.name_ar || "Unnamed Medicine"}
                        </h4>`;

if (!t.includes(needle)) {
  console.error("Card marker not found — file structure changed");
  process.exit(1);
}
t = t.replace(needle, insert);
fs.writeFileSync(target, t);
console.log("Patched product card images into", target);
