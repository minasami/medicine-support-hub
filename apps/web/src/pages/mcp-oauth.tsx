/**
 * MCP OAuth bridge: user signs in with existing Appwrite/Google session,
 * then we create an Appwrite JWT and return to mcp.medicinesupport.app/oauth/complete.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Bot, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { account } from "@/lib/appwrite";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

const MCP_COMPLETE =
  (import.meta.env.VITE_MCP_PUBLIC_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://mcp.medicinesupport.app";

export default function McpOAuthPage() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const auth = usePatientAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const ticket = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("ticket") || "";
  }, []);

  async function completeWithSession() {
    setError(null);
    setBusy(true);
    try {
      if (!ticket) throw new Error("Missing OAuth ticket. Restart connect from ChatGPT / Grok / Claude.");
      await account.get();
      const jwt = await account.createJWT();
      const url = `${MCP_COMPLETE}/oauth/complete?ticket=${encodeURIComponent(ticket)}&appwrite_jwt=${encodeURIComponent(jwt.jwt)}`;
      setDone(true);
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!ticket) {
      setError("Missing ticket. Open this page from an MCP connector authorize redirect.");
      return;
    }
    if (auth.loading) return;
    if (auth.isAuthenticated) {
      void completeWithSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, auth.loading, auth.isAuthenticated]);

  return (
    <main className="bg-white text-slate-900" dir={isAr ? "rtl" : "ltr"}>
      <section className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border p-8 shadow-sm">
          <div className="inline-flex items-center gap-2 rounded-full border bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-800">
            <Bot className="h-4 w-4" />
            {t("MCP connector login", "تسجيل دخول وصلة MCP")}
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            {t("Connect Medicine Support Hub", "ربط منصة دعم الدواء")}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t(
              "Sign in with your existing Google / Appwrite account so ChatGPT, Grok, Claude, Codex, or Gemini can submit support requests, prescriptions, contributions, and watchlist alerts on your behalf.",
              "سجّل الدخول بحساب Google / Appwrite الحالي حتى يتمكن ChatGPT أو Grok أو Claude أو Codex أو Gemini من إرسال طلبات الدعم والروشتات والمساهمات وتنبيهات الأسعار نيابة عنك.",
            )}
          </p>

          {error && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
          )}

          {done || busy ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("Returning to the MCP connector…", "جارٍ العودة إلى وصلة MCP…")}
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {auth.isAuthenticated ? (
                <Button onClick={() => void completeWithSession()} disabled={!ticket}>
                  <ShieldCheck className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                  {t("Continue as signed-in user", "متابعة بالمستخدم الحالي")}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      const next = `/mcp-oauth?ticket=${encodeURIComponent(ticket)}`;
                      void auth.signInWithGoogle(next);
                    }}
                    disabled={auth.loading}
                  >
                    {t("Sign in with Google", "تسجيل الدخول عبر Google")}
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/login?next=${encodeURIComponent(`/mcp-oauth?ticket=${ticket}`)}`}>
                      {t("Email / password login", "دخول بالبريد وكلمة المرور")}
                    </Link>
                  </Button>
                </>
              )}
            </div>
          )}

          <p className="mt-6 text-xs text-slate-500">
            {t(
              "Public catalog tools stay open without login. Only account tools request this consent.",
              "أدوات الكتالوج العامة تبقى مفتوحة بدون تسجيل. أدوات الحساب فقط تطلب هذه الموافقة.",
            )}
          </p>
        </div>
      </section>
    </main>
  );
}
