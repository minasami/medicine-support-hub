/**
 * High-impact UX polish for pilot friendliness.
 *
 *   node scripts/wire-ux-polish-pass.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function patch(file, fn) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  const next = fn(s);
  if (next !== s) {
    fs.writeFileSync(p, next);
    console.log("patched", file);
  } else {
    console.log("unchanged", file);
  }
}

// —— 1. Layout: primary nav only on mobile strip; rest stay in drawer/more ——
patch("apps/web/src/components/layout.tsx", (s) => {
  const oldNav = `  const publicNav = [
    { href: "/journey", labelEn: "Journey", labelAr: "الرحلة" },
    { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية" },
    { href: "/scan", labelEn: "Scan Barcode", labelAr: "مسح الباركود" },
    { href: "/world-search", labelEn: "World Search", labelAr: "بحث عالمي" },
    { href: "/formulas", labelEn: "Baby Formulas", labelAr: "حليب الأطفال" },
    { href: "/marketplace", labelEn: "Marketplace", labelAr: "السوق" },
    { href: "/ngos", labelEn: "NGO Network", labelAr: "الجمعيات الأهلية" },
    { href: "/psps", labelEn: "PSPs Directory", labelAr: "دليل برامج الدعم" },
    { href: "/companies", labelEn: "Companies", labelAr: "الشركات" },
    { href: "/jobs", labelEn: "Jobs", labelAr: "الوظائف" },
    { href: "/clinics", labelEn: "Care Network", labelAr: "شبكة الرعاية" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
    { href: "/industry", labelEn: "Industry", labelAr: "قطاع الصناعة" },
    { href: "/request", labelEn: "Request Support", labelAr: "طلب دعم" },
  ];`;

  const newNav = `  // Mobile top strip: task-first. Full list remains available via sidebar/drawer.
  const publicNavPrimary = [
    { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية" },
    { href: "/scan", labelEn: "Scan", labelAr: "مسح" },
    { href: "/world-search", labelEn: "World", labelAr: "عالمي" },
    { href: "/companies", labelEn: "Companies", labelAr: "شركات" },
    { href: "/industry", labelEn: "Industry", labelAr: "صناعة" },
  ];
  const publicNavSecondary = [
    { href: "/journey", labelEn: "Journey", labelAr: "الرحلة" },
    { href: "/formulas", labelEn: "Baby Formulas", labelAr: "حليب الأطفال" },
    { href: "/marketplace", labelEn: "Marketplace", labelAr: "السوق" },
    { href: "/ngos", labelEn: "NGO Network", labelAr: "الجمعيات الأهلية" },
    { href: "/psps", labelEn: "PSPs Directory", labelAr: "دليل برامج الدعم" },
    { href: "/jobs", labelEn: "Jobs", labelAr: "الوظائف" },
    { href: "/clinics", labelEn: "Care Network", labelAr: "شبكة الرعاية" },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم" },
    { href: "/request", labelEn: "Request Support", labelAr: "طلب دعم" },
  ];
  const publicNav = [...publicNavPrimary, ...publicNavSecondary];
  // On small screens only show primary links in the horizontal strip
  const publicNavStrip = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches
    ? publicNavPrimary
    : publicNav;`;

  // Can't use window during SSR render of nav map easily — use CSS/responsive approach instead:
  const newNavCss = `  const publicNavPrimary = [
    { href: "/medicines", labelEn: "Medicines", labelAr: "الأدوية", priority: true },
    { href: "/scan", labelEn: "Scan", labelAr: "مسح", priority: true },
    { href: "/world-search", labelEn: "World", labelAr: "عالمي", priority: true },
    { href: "/companies", labelEn: "Companies", labelAr: "شركات", priority: true },
    { href: "/industry", labelEn: "Industry", labelAr: "صناعة", priority: true },
    { href: "/journey", labelEn: "Journey", labelAr: "الرحلة", priority: false },
    { href: "/formulas", labelEn: "Baby Formulas", labelAr: "حليب الأطفال", priority: false },
    { href: "/marketplace", labelEn: "Marketplace", labelAr: "السوق", priority: false },
    { href: "/ngos", labelEn: "NGO Network", labelAr: "الجمعيات الأهلية", priority: false },
    { href: "/psps", labelEn: "PSPs Directory", labelAr: "دليل برامج الدعم", priority: false },
    { href: "/jobs", labelEn: "Jobs", labelAr: "الوظائف", priority: false },
    { href: "/clinics", labelEn: "Care Network", labelAr: "شبكة الرعاية", priority: false },
    { href: "/learn", labelEn: "Learning", labelAr: "التعلم", priority: false },
    { href: "/request", labelEn: "Request Support", labelAr: "طلب دعم", priority: false },
  ];
  const publicNav = publicNavPrimary;`;

  if (s.includes(oldNav)) s = s.replace(oldNav, newNavCss);

  // Add responsive hide for non-priority nav links in the strip
  if (s.includes("publicNav.map((link)") && !s.includes("link.priority")) {
    s = s.replace(
      "publicNav.map((link) => {",
      "publicNav.map((link) => {",
    );
    // Inject className on Link for secondary items
    s = s.replace(
      /publicNav\.map\(\(link\) => \{\s*const isActive =/,\
      `publicNav.map((link) => {
                const isActive =`,
    );
    // After isActive block, we need class on Link - find Link key={link.href}
    if (!s.includes("max-md:hidden") && s.includes("key={link.href}")) {
      s = s.replace(
        /key=\{link\.href\}\s*\n\s*href=\{link\.href\}/,
        `key={link.href}
                    href={link.href}
                    className={!(link).priority ? "max-md:hidden" : undefined}`.replace(
          "!(link).priority",
          "!(link as { priority?: boolean }).priority",
        ),
      );
      // Simpler approach without TS cast issues - use priority on object
      s = s.replace(
        /className=\{\!\(link as \{ priority\?: boolean \}\)\.priority \? "max-md:hidden" : undefined\}/,
        `className={!link.priority ? "max-md:hidden" : undefined}`,
      );
    }
  }

  // Better: append priority hide onto existing className of the nav Link
  // Look for pattern in horizontal nav links
  if (s.includes("publicNav.map") && !s.includes("!link.priority")) {
    const re =
      /(publicNav\.map\(\(link\) => \{[\s\S]*?return \(\s*<Link\s+key=\{link\.href\}\s+href=\{link\.href\})/;
    if (re.test(s)) {
      s = s.replace(
        re,
        `$1
                    data-priority={link.priority ? "1" : "0"}`,
      );
    }
  }

  return s;
});

// —— 2. Encyclopedia: public-friendly meta + empty state ——
patch("apps/web/src/pages/medicines-encyclopedia.tsx", (s) => {
  // Hide Live Appwrite + cursor on all small screens / demote
  s = s.replace(
    `{dataSource === "appwrite" && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {t("Live Appwrite", "Appwrite مباشر")}
            </Badge>
          )}`,
    `{dataSource === "appwrite" && (
            <Badge variant="outline" className="hidden sm:inline-flex text-[10px] font-normal text-muted-foreground">
              {t("Live catalog", "موسوعة مباشرة")}
            </Badge>
          )}`,
  );

  s = s.replace(
    /\{nextCursor && \([\s\S]*?cursor[\s\S]*?\)\}/,
    `{/* pagination cursor intentionally hidden from users */}`,
  );

  s = s.replace(
    `{t("(total may be capped by API)", "(الإجمالي قد يكون محدوداً من الواجهة)")}`,
    `{t("(full catalog searchable)", "(البحث في الموسوعة كاملة)")}`,
  );

  // Richer empty state CTAs already partially exist — improve copy
  s = s.replace(
    `t("Not in the local catalog yet", "غير موجود في الموسوعة المحلية بعد")`,
    `t("No exact match in the Egyptian catalog", "لا توجد نتيجة مطابقة في الموسوعة المصرية")`,
  );

  return s;
});

// —— 3. PWA: delay install longer; never block first search ——
patch("apps/web/src/components/pwa-experience.tsx", (s) => {
  // Delay notification center prompt
  s = s.replace(
    "const timer = window.setTimeout(() => setShowCenter(true), 3200);",
    "const timer = window.setTimeout(() => setShowCenter(true), 12000);",
  );

  // If install shows immediately on event, delay setShowInstall
  if (s.includes("setShowInstall(true)") && !s.includes("INSTALL_UX_DELAY")) {
    s = s.replace(
      /setShowInstall\(true\)/g,
      `/* INSTALL_UX_DELAY */ window.setTimeout(() => setShowInstall(true), 8000)`,
    );
  }

  return s;
});

// —— 4. Mobile CSS: denser, calmer catalog ——
patch("apps/web/src/mobile-platform.css", (s) => {
  if (s.includes("/* ux-polish-pass */")) return s;
  return (
    s +
    `

/* ux-polish-pass */
@media (max-width: 767px) {
  /* Secondary top-nav links marked data-priority=0 */
  nav [data-priority="0"] {
    display: none !important;
  }

  /* Calmer product cards */
  main .container {
    padding-left: 0.875rem;
    padding-right: 0.875rem;
  }

  /* Hide noisy engineering badges if any remain */
  [data-eng-badge="true"] {
    display: none !important;
  }
}
`
  );
});

console.log("UX polish pass complete.");
