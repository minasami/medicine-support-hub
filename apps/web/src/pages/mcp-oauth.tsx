/**
 * MCP OAuth bridge: user signs in with existing Appwrite/Google session,
 * then we create an Appwrite JWT and POST it (with ticket) to
 * mcp.medicinesupport.app/oauth/complete — never GET-assign ticket+jwt
 * (tickets used to embed giant DCR client_ids and truncated in the URL).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Bot, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { account } from "@/lib/appwrite";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";

const MCP_COMPLETE =
  (import.meta.env.VITE_MCP_PUBLIC_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://mcp.medicinesupport.app";

function readTicketFromLocation(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("ticket") || "";
}

export default function McpOAuthPage() {
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const auth = usePatientAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ticket, setTicket] = useState(() => readTicketFromLocation());

  // Re-read ticket from the live URL on each complete attempt (not a stale useMemo).
  const refreshTicket = useCallback(() => {
    const next = readTicketFromLocation();
    setTicket(next);
    return next;
  }, []);

  async function completeWithSession() {
    setError(null);
    setBusy(true);
    try {
      const liveTicket = refreshTicket();
      if (!liveTicket || liveTicket.length < 20) {
        throw new Error(
          "Missing or incomplete OAuth ticket. Restart connect from ChatGPT / Grok / Claude.",
        );
      }
      await account.get();
      const jwt = await account.createJWT();
      const res = await fetch(`${MCP_COMPLETE}/oauth/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ ticket: liveTicket, appwrite_jwt: jwt.jwt }),
      });

      let data: { redirect?: string; error?: string } = {};
      const raw = await res.text();
      try {
        data = JSON.parse(raw) as { redirect?: string; error?: string };
      } catch {
        /* plain-text error from older MCP */
      }

      if (res.status === 302) {
        const loc = res.headers.get("Location");
        if (loc) {
          setDone(true);
          window.location.assign(loc);
          return;
        }
      }

      if (!res.ok || !data.redirect) {
        const msg = data.error || raw || `complete failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      setDone(true);
      window.location.assign(data.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  useEffect(() => {
    const live = refreshTicket();
    if (!live) {
      setError("Missing ticket. Open this page from an MCP connector authorize redirect.");
      return;
    }
    if (auth.loading) return;
    if (auth.isAuthenticated) {
      void completeWithSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.isAuthenticated]);

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
                      const live = refreshTicket();
                      const next = `/mcp-oauth/?ticket=${encodeURIComponent(live)}`;
                      void auth.signInWithGoogle(next);
                    }}
                    disabled={auth.loading}
                  >
                    {t("Sign in with Google", "تسجيل الدخول عبر Google")}
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      href={`/login?next=${encodeURIComponent(`/mcp-oauth/?ticket=${ticket}`)}`}
                    >
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
