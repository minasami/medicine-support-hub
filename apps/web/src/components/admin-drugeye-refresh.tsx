import { useState } from "react";
import { FlaskConical, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type DrugEyeHit = {
  name_en: string;
  price_egp: number | null;
  scientific_name?: string | null;
  drug_class?: string | null;
  manufacturer?: string | null;
};

type RefreshResponse = {
  ok?: boolean;
  message?: string;
  query?: string;
  score?: number;
  hit?: DrugEyeHit | null;
  candidates?: DrugEyeHit[];
  proposed_patch?: Record<string, unknown>;
  reasons?: string[];
  applied?: boolean;
  document_id?: string | null;
};

type Props = {
  /** Prefill trade name (e.g. from monograph page). */
  defaultNameEn?: string;
  /** Appwrite document $id when known. */
  documentId?: string | null;
  /** Called after a successful apply so the parent can reload product data. */
  onApplied?: (result: RefreshResponse) => void;
  compact?: boolean;
};

const APPWRITE_ENDPOINT = (
  import.meta.env.VITE_APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1"
).replace(/\/$/, "");
const APPWRITE_PROJECT =
  import.meta.env.VITE_APPWRITE_PROJECT_ID || "6a54ac3a00272c02d6e0";
const DRUGEYE_FUNCTION_ID =
  import.meta.env.VITE_APPWRITE_FUNCTION_DRUGEYE_REFRESH || "drugeye-refresh";

async function callLegacyApi(
  token: string,
  payload: Record<string, unknown>,
): Promise<RefreshResponse> {
  const response = await fetch("/api/admin-drugeye-refresh", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as RefreshResponse;
  if (!response.ok) {
    throw new Error(data.message || `API ${response.status}`);
  }
  return data;
}

/**
 * Execute Appwrite Function `drugeye-refresh` (works on Appwrite Sites hosting).
 */
async function callAppwriteFunction(
  token: string,
  payload: Record<string, unknown>,
): Promise<RefreshResponse> {
  const url = `${APPWRITE_ENDPOINT}/functions/${encodeURIComponent(DRUGEYE_FUNCTION_ID)}/executions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT,
      "X-Appwrite-JWT": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      body: JSON.stringify(payload),
      async: false,
    }),
  });
  const execution = await response.json();
  if (!response.ok) {
    throw new Error(
      execution?.message ||
        execution?.error ||
        `Function execution HTTP ${response.status}`,
    );
  }

  // Appwrite wraps the function response in execution.responseBody
  const raw =
    execution.responseBody ||
    execution.response ||
    execution.body ||
    execution;
  let data: RefreshResponse;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw) as RefreshResponse;
    } catch {
      throw new Error(raw.slice(0, 200) || "Empty function response");
    }
  } else {
    data = raw as RefreshResponse;
  }

  if (data && data.ok === false && data.message) {
    // still return structured no-match results
    return data;
  }
  return data;
}

export function AdminDrugEyeRefresh({
  defaultNameEn = "",
  documentId = null,
  onApplied,
  compact = false,
}: Props) {
  const { t } = useLanguage();
  const { session } = usePatientAuth();
  const [nameEn, setNameEn] = useState(defaultNameEn);
  const [docId, setDocId] = useState(documentId || "");
  const [forcePrice, setForcePrice] = useState(false);
  const [apply, setApply] = useState(Boolean(documentId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefreshResponse | null>(null);
  const [via, setVia] = useState<string | null>(null);

  async function runRefresh() {
    if (!session?.access_token) {
      setError(
        t(
          "Sign in as a platform admin first.",
          "سجّل الدخول كمسؤول منصة أولاً.",
        ),
      );
      return;
    }
    const q = nameEn.trim();
    if (!q) {
      setError(t("Enter a product name.", "أدخل اسم المنتج."));
      return;
    }

    const payload = {
      name_en: q,
      document_id: docId.trim() || undefined,
      apply: apply && Boolean(docId.trim()),
      force_price: forcePrice,
    };

    setBusy(true);
    setError(null);
    setResult(null);
    setVia(null);
    try {
      let data: RefreshResponse | null = null;

      // 1) Prefer legacy /api when hosted (Vercel)
      try {
        data = await callLegacyApi(session.access_token, payload);
        setVia("/api/admin-drugeye-refresh");
      } catch {
        // 2) Appwrite Function (native to Appwrite Sites)
        data = await callAppwriteFunction(session.access_token, payload);
        setVia(`function:${DRUGEYE_FUNCTION_ID}`);
      }

      setResult(data);
      if (data.applied) onApplied?.(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not refresh from DrugEye.", "تعذر التحديث من DrugEye."),
      );
    } finally {
      setBusy(false);
    }
  }

  const body = (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="drugeye-name">
            {t("Trade name", "الاسم التجاري")}
          </Label>
          <Input
            id="drugeye-name"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="e.g. Panadol Advance 500"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="drugeye-doc">
            {t("Appwrite document id (optional)", "معرّف مستند Appwrite (اختياري)")}
          </Label>
          <Input
            id="drugeye-doc"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            placeholder="$id to PATCH live price"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={apply}
            onChange={(e) => setApply(e.target.checked)}
          />
          {t("Apply patch to Appwrite", "تطبيق التحديث على Appwrite")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={forcePrice}
            onChange={(e) => setForcePrice(e.target.checked)}
          />
          {t("Overwrite existing price", "استبدال السعر الحالي")}
        </label>
      </div>

      <Button
        type="button"
        onClick={() => void runRefresh()}
        disabled={busy || !nameEn.trim()}
        className="gap-2"
      >
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        {busy
          ? t("Refreshing…", "جاري التحديث…")
          : t("Refresh price from DrugEye", "تحديث السعر من DrugEye")}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={result.ok ? "default" : "secondary"}>
              {result.applied
                ? t("Applied", "تم التطبيق")
                : result.ok
                  ? t("Match", "مطابقة")
                  : t("No match", "لا مطابقة")}
            </Badge>
            {result.score != null && (
              <span className="text-muted-foreground">
                {t("Score", "الدرجة")}:{" "}
                {result.score.toFixed?.(1) ?? result.score}
              </span>
            )}
            {via && (
              <span className="text-xs text-muted-foreground">via {via}</span>
            )}
          </div>
          <p>{result.message}</p>
          {result.hit && (
            <div className="grid gap-1 text-xs sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">
                  {t("DrugEye", "DrugEye")}:{" "}
                </span>
                {result.hit.name_en}
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t("Price", "السعر")}:{" "}
                </span>
                EGP {result.hit.price_egp ?? "—"}
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">
                  {t("Composition", "التركيب")}:{" "}
                </span>
                {result.hit.scientific_name || "—"}
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">
                  {t("Manufacturer", "الشركة")}:{" "}
                </span>
                {result.hit.manufacturer || "—"}
              </div>
            </div>
          )}
          {result.proposed_patch &&
            Object.keys(result.proposed_patch).length > 0 && (
              <pre className="overflow-x-auto rounded-lg bg-background p-2 text-[11px]">
                {JSON.stringify(result.proposed_patch, null, 2)}
              </pre>
            )}
        </div>
      )}
    </div>
  );

  if (compact) return body;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FlaskConical className="h-5 w-5" />
          {t("DrugEye price refresh", "تحديث أسعار DrugEye")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t(
            "Platform admins can pull the latest observed price and composition from DrugEye and optionally write it to Appwrite (via API or Appwrite Function).",
            "يمكن لمسؤولي المنصة سحب أحدث سعر وتركيب من DrugEye وكتابته اختيارياً في Appwrite (عبر API أو Appwrite Function).",
          )}
        </p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
