import { Link } from "wouter";
import { Bot, ExternalLink, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

const MCP_URL = "https://msh-mcp.vercel.app/mcp";
const HEALTH_URL = "https://msh-mcp.vercel.app/health";

export default function AiMcpPage() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  return (
    <main className="bg-white text-slate-900" dir={isAr ? "rtl" : "ltr"}>
      <section className="border-b bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold text-blue-700">
            <Bot className="h-4 w-4" />
            {t("AI connectors", "وصلات الذكاء الاصطناعي")}
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
            {t(
              "Use Medicine Support Hub from Grok, ChatGPT, or Claude",
              "استخدم منصة دعم الدواء من Grok أو ChatGPT أو Claude",
            )}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {t(
              "Remote MCP server for Egyptian catalog search, indicative EGP cost estimates, and generic insurance hints. Not a pharmacy quote and not an insurance approval.",
              "خادم MCP للبحث في الكتالوج المصري وتقدير التكلفة بالجنيه وإشارات تأمين عامة. ليس عرض سعر من صيدلية ولا موافقة تأمين.",
            )}
          </p>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <article className="rounded-2xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold">{t("Connect URL", "رابط الاتصال")}</h2>
            <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 font-mono text-sm">{MCP_URL}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <a href={MCP_URL} target="_blank" rel="noreferrer">
                  {t("Open MCP", "فتح MCP")}
                  <ExternalLink className="h-4 w-4 ltr:ml-2 rtl:mr-2" />
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={HEALTH_URL} target="_blank" rel="noreferrer">
                  {t("Health check", "فحص الصحة")}
                </a>
              </Button>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-left text-xs text-slate-100">
              {`grok mcp add --transport http msh ${MCP_URL}`}
            </pre>
          </article>

          <article className="rounded-2xl border p-6 shadow-sm">
            <h2 className="text-xl font-bold">{t("What the tools do", "ماذا تفعل الأدوات")}</h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-slate-600">
              <li>{t("Search and fetch Egyptian catalog products", "البحث واستعراض منتجات الكتالوج المصري")}</li>
              <li>{t("Indicative EGP cost estimates with a disclaimer", "تقدير تكلفة إرشادي بالجنيه مع تنويه")}</li>
              <li>{t("Generic insurance hints only — not eligibility", "إشارات تأمين عامة فقط — ليست أهلية")}</li>
            </ul>
          </article>

          <article className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
              <p className="text-sm leading-6 text-amber-950">
                {t(
                  "Do not send national IDs, policy numbers, or card numbers to this server. Prices are catalog snapshots.",
                  "لا ترسل الرقم القومي ولا رقم الوثيقة ولا رقم الكارت إلى هذا الخادم. الأسعار لقطة من الكتالوج.",
                )}
              </p>
            </div>
          </article>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/medicines">{t("Open catalog", "فتح الكتالوج")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/about">{t("About the platform", "عن المنصة")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
