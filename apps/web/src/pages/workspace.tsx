import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, Building2, Plus, RefreshCw, Users, Wallet } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { useLanguage } from "@/lib/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Membership = {
  organization_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
    country: string | null;
    city: string | null;
    currency: string;
    mission: string | null;
    vision: string | null;
  } | null;
};
type Program = {
  id: string;
  name: string;
  status: string;
  budget_amount: number | string;
  currency: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
};
type Beneficiary = {
  id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  primary_condition: string | null;
  risk_level: string;
  status: string;
  program_id: string | null;
};

export default function WorkspacePage() {
  const { t } = useLanguage();
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [programDraft, setProgramDraft] = useState({
    name: "",
    description: "",
    budget_amount: "",
    currency: "EGP",
  });
  const [beneficiaryDraft, setBeneficiaryDraft] = useState({
    full_name: "",
    phone: "",
    city: "",
    primary_condition: "",
    risk_level: "standard",
    program_id: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const organization = membership?.organizations ?? null;
  const totalBudget = useMemo(
    () => programs.reduce((sum, p) => sum + Number(p.budget_amount || 0), 0),
    [programs],
  );

  async function load() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isAuthenticated || !session?.user?.id) {
        throw new Error(
          t(
            "Sign in from the platform portal first.",
            "سجّل الدخول من بوابة المنصة أولًا.",
          ),
        );
      }
      const memberships = await supabaseFetch<Membership[]>(
        `/rest/v1/organization_members?select=organization_id,role,organizations(id,name,country,city,currency,mission,vision)&user_id=eq.${session.user.id}&is_active=eq.true&limit=1`,
      );
      const active = memberships[0] ?? null;
      setMembership(active);
      if (!active) {
        throw new Error(
          t(
            "Your account is not linked to an organization workspace.",
            "حسابك غير مرتبط بمساحة عمل للمنظمة.",
          ),
        );
      }
      const [programRows, beneficiaryRows] = await Promise.all([
        supabaseFetch<Program[]>(
          `/rest/v1/programs?select=id,name,status,budget_amount,currency,description,start_date,end_date&organization_id=eq.${active.organization_id}&order=created_at.desc`,
        ),
        supabaseFetch<Beneficiary[]>(
          `/rest/v1/beneficiaries?select=id,full_name,phone,city,primary_condition,risk_level,status,program_id&organization_id=eq.${active.organization_id}&order=created_at.desc`,
        ),
      ]);
      setPrograms(programRows);
      setBeneficiaries(beneficiaryRows);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to load workspace.", "تعذّر تحميل مساحة العمل."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated, session?.user?.id, session?.access_token]);

  async function createProgram() {
    if (!membership || !programDraft.name.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/programs`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          organization_id: membership.organization_id,
          name: programDraft.name.trim(),
          description: programDraft.description.trim() || null,
          budget_amount: Number(programDraft.budget_amount || 0),
          currency: programDraft.currency || organization?.currency || "EGP",
          status: "active",
        }),
      });
      setProgramDraft({
        name: "",
        description: "",
        budget_amount: "",
        currency: organization?.currency || "EGP",
      });
      setMessage(t("Program created successfully.", "تم إنشاء البرنامج بنجاح."));
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to create program.", "تعذّر إنشاء البرنامج."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function createBeneficiary() {
    if (!membership || !beneficiaryDraft.full_name.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch(`/rest/v1/beneficiaries`, {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          organization_id: membership.organization_id,
          program_id: beneficiaryDraft.program_id || null,
          full_name: beneficiaryDraft.full_name.trim(),
          phone: beneficiaryDraft.phone.trim() || null,
          city: beneficiaryDraft.city.trim() || null,
          primary_condition: beneficiaryDraft.primary_condition.trim() || null,
          risk_level: beneficiaryDraft.risk_level,
          status: "active",
        }),
      });
      setBeneficiaryDraft({
        full_name: "",
        phone: "",
        city: "",
        primary_condition: "",
        risk_level: "standard",
        program_id: "",
      });
      setMessage(
        t("Beneficiary added successfully.", "تمت إضافة المستفيد بنجاح."),
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : t("Failed to add beneficiary.", "تعذّر إضافة المستفيد."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge className="mb-3 bg-blue-100 text-blue-700 hover:bg-blue-100">
            {t("Enterprise Workspace v1", "مساحة العمل المؤسسية v1")}
          </Badge>
          <h1 className="flex items-center gap-3 text-3xl font-bold">
            <Building2 className="h-8 w-8 text-blue-700" />
            {organization?.name ??
              t("Organization Workspace", "مساحة عمل المنظمة")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {organization
              ? `${organization.city ?? ""}${organization.city && organization.country ? ", " : ""}${organization.country ?? ""} • ${t("Role", "الدور")}: ${membership?.role}`
              : t(
                  "Programs, beneficiaries, budgets, and organizational operations.",
                  "البرامج والمستفيدون والميزانيات وعمليات المنظمة.",
                )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/ngo/dashboard">{t("NGO dashboard", "لوحة الجمعية")}</Link>
          </Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t("Refresh", "تحديث")}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="mb-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-2xl font-bold">{programs.length}</div>
              <div className="text-sm text-muted-foreground">
                {t("Programs", "البرامج")}
              </div>
            </div>
            <Building2 className="h-6 w-6 text-blue-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-2xl font-bold">{beneficiaries.length}</div>
              <div className="text-sm text-muted-foreground">
                {t("Beneficiaries", "المستفيدون")}
              </div>
            </div>
            <Users className="h-6 w-6 text-emerald-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-2xl font-bold">
                {Math.round(totalBudget).toLocaleString()}{" "}
                {organization?.currency ?? "EGP"}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("Program budgets", "ميزانيات البرامج")}
              </div>
            </div>
            <Wallet className="h-6 w-6 text-amber-700" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("Create program", "إنشاء برنامج")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("Name", "الاسم")}</Label>
              <Input
                value={programDraft.name}
                onChange={(e) =>
                  setProgramDraft({ ...programDraft, name: e.target.value })
                }
                placeholder={t(
                  "Diabetes Medicine Support",
                  "دعم أدوية السكري",
                )}
              />
            </div>
            <div>
              <Label>{t("Description", "الوصف")}</Label>
              <Textarea
                value={programDraft.description}
                onChange={(e) =>
                  setProgramDraft({
                    ...programDraft,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Budget", "الميزانية")}</Label>
                <Input
                  type="number"
                  value={programDraft.budget_amount}
                  onChange={(e) =>
                    setProgramDraft({
                      ...programDraft,
                      budget_amount: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>{t("Currency", "العملة")}</Label>
                <Input
                  value={programDraft.currency}
                  onChange={(e) =>
                    setProgramDraft({
                      ...programDraft,
                      currency: e.target.value.toUpperCase(),
                    })
                  }
                />
              </div>
            </div>
            <Button
              onClick={() => void createProgram()}
              disabled={saving || !programDraft.name.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("Create program", "إنشاء برنامج")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Add beneficiary", "إضافة مستفيد")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("Full name", "الاسم بالكامل")}</Label>
              <Input
                value={beneficiaryDraft.full_name}
                onChange={(e) =>
                  setBeneficiaryDraft({
                    ...beneficiaryDraft,
                    full_name: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("Phone", "الهاتف")}</Label>
                <Input
                  value={beneficiaryDraft.phone}
                  onChange={(e) =>
                    setBeneficiaryDraft({
                      ...beneficiaryDraft,
                      phone: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>{t("City", "المدينة")}</Label>
                <Input
                  value={beneficiaryDraft.city}
                  onChange={(e) =>
                    setBeneficiaryDraft({
                      ...beneficiaryDraft,
                      city: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>{t("Primary condition", "الحالة الأساسية")}</Label>
              <Input
                value={beneficiaryDraft.primary_condition}
                onChange={(e) =>
                  setBeneficiaryDraft({
                    ...beneficiaryDraft,
                    primary_condition: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label>{t("Program", "البرنامج")}</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={beneficiaryDraft.program_id}
                onChange={(e) =>
                  setBeneficiaryDraft({
                    ...beneficiaryDraft,
                    program_id: e.target.value,
                  })
                }
              >
                <option value="">{t("Unassigned", "غير مُسند")}</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={() => void createBeneficiary()}
              disabled={saving || !beneficiaryDraft.full_name.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("Add beneficiary", "إضافة مستفيد")}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("Programs", "البرامج")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {programs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("No programs yet.", "لا توجد برامج بعد.")}
              </p>
            ) : (
              programs.map((p) => (
                <Link
                  key={p.id}
                  href={`/workspace/programs/${p.id}`}
                  className="block rounded-lg border p-4 transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{p.name}</div>
                    <Badge variant="secondary">{p.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.description || t("No description", "بدون وصف")}
                  </p>
                  <div className="mt-2 text-sm font-medium">
                    {Number(p.budget_amount || 0).toLocaleString()} {p.currency}
                  </div>
                  <div className="mt-2 text-xs font-semibold text-blue-700">
                    {t("Open program dashboard", "افتح لوحة البرنامج")}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Beneficiaries", "المستفيدون")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {beneficiaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("No beneficiaries yet.", "لا يوجد مستفيدون بعد.")}
              </p>
            ) : (
              beneficiaries.map((b) => (
                <Link
                  key={b.id}
                  href={`/workspace/beneficiaries/${b.id}`}
                  className="block rounded-lg border p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{b.full_name}</div>
                    <Badge variant="secondary">{b.risk_level}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[b.primary_condition, b.city, b.phone]
                      .filter(Boolean)
                      .join(" • ") ||
                      t("No additional details", "لا توجد تفاصيل إضافية")}
                  </p>
                  <div className="mt-2 text-xs font-semibold text-emerald-700">
                    {t("Open Beneficiary 360°", "افتح ملف المستفيد 360°")}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
