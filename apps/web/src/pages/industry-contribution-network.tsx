/* eslint-disable @typescript-eslint/no-explicit-any */
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  FileCheck2,
  FileSpreadsheet,
  Globe2,
  Layers,
  Mail,
  Phone,
  ShieldCheck,
  UploadCloud,
  UserCheck,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type ClaimDraft = {
  companyName: string;
  officialRegNo: string;
  taxRegistrationNo: string;
  edaLicenseNo: string;
  manufacturingLicenseNo: string;
  workEmail: string;
  mobilePhone: string;
  contactName: string;
  titleRole: string;
  websiteUrl: string;
  headquartersAddress: string;
  city: string;
  country: string;
  therapeuticAreas: string;
  brandPortfolioSummary: string;
  documentationNote: string;
  declaredAuthority: boolean;
};

const DEFAULT_DRAFT: ClaimDraft = {
  companyName: "",
  officialRegNo: "",
  taxRegistrationNo: "",
  edaLicenseNo: "",
  manufacturingLicenseNo: "",
  workEmail: "",
  mobilePhone: "",
  contactName: "",
  titleRole: "",
  websiteUrl: "",
  headquartersAddress: "",
  city: "Cairo",
  country: "Egypt",
  therapeuticAreas: "",
  brandPortfolioSummary: "",
  documentationNote: "",
  declaredAuthority: false,
};

export default function IndustryContributionNetwork() {
  const { t } = useLanguage();
  const { session, isAuthenticated, signUp } = usePatientAuth();
  const [claimDraft, setClaimDraft] = useState<ClaimDraft>(DEFAULT_DRAFT);
  const [accountPassword, setAccountPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitAfterAuthentication, setSubmitAfterAuthentication] = useState(false);

  const handleClaimSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!claimDraft.declaredAuthority) {
      setError(
        t(
          "You must declare authority as an authorized representative of the pharmaceutical entity.",
          "يجب أن تقر بتفويضك كممثل معتمد للمنشأة الدوائية.",
        ),
      );
      return;
    }

    if (!isAuthenticated) {
      if (!accountPassword || accountPassword.length < 8) {
        setError(
          t(
            "Please create a password (at least 8 characters) to secure your company representative portal.",
            "برجاء إنشاء كلمة مرور (٨ أحرف على الأقل) لتأمين بوابة ممثل الشركة.",
          ),
        );
        return;
      }
      setSaving(true);
      setError(null);
      try {
        setSubmitAfterAuthentication(true);
        const result = await signUp(
          claimDraft.workEmail.trim(),
          accountPassword,
        );
        if (result.requiresEmailConfirmation) {
          setMessage(
            t(
              "Your application details are ready. Confirm the email we sent, return to this page, and submit; your entries remain here while this tab stays open.",
              "بيانات طلبك جاهزة. أكد البريد الذي أرسلناه ثم عد إلى هذه الصفحة وأرسل الطلب؛ ستظل بياناتك موجودة ما دامت هذه الصفحة مفتوحة.",
            ),
          );
        }
      } catch (err: any) {
        setError(err?.message || "Failed to initialize company account.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      setMessage(
        t(
          "Your company representative claim has been submitted to the platform administration for verification.",
          "تم إرسال طلب توثيق ممثل الشركة إلى إدارة المنصة للمراجعة.",
        ),
      );
      setClaimDraft(DEFAULT_DRAFT);
    } catch (err: any) {
      setError(err?.message || "Failed to submit claim.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold">Industry Contribution Network</h1>
        <p className="text-muted-foreground">
          Official portal for pharmaceutical manufacturers, brand owners, and toll manufacturing representatives to manage brand portfolios and official directory entries.
        </p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleClaimSubmit} className="space-y-4">
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {message && <Alert><AlertDescription>{message}</AlertDescription></Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={claimDraft.companyName}
                onChange={(e) => setClaimDraft({ ...claimDraft, companyName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Work Email</Label>
              <Input
                type="email"
                value={claimDraft.workEmail}
                onChange={(e) => setClaimDraft({ ...claimDraft, workEmail: e.target.value })}
                required
              />
            </div>
          </div>

          {!isAuthenticated && (
            <div className="space-y-2 border-t pt-4">
              <Label>Account Password (for new representative access)</Label>
              <Input
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                required
              />
            </div>
          )}

          <div className="flex items-center gap-2 border-t pt-4">
            <input
              type="checkbox"
              id="authority"
              checked={claimDraft.declaredAuthority}
              onChange={(e) => setClaimDraft({ ...claimDraft, declaredAuthority: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="authority" className="text-xs">
              I declare that I am an authorized representative of this pharmaceutical entity.
            </label>
          </div>

          <Button type="submit" disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            {saving ? "Submitting…" : "Submit Representative Application"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
