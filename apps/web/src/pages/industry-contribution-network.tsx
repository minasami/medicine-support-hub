import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronsUpDown,
  CircleCheckBig,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  Handshake,
  MapPin,
  Network,
  PencilLine,
  Phone,
  PlusCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserRoundCheck,
  Video,
  X,
} from "lucide-react";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";
import { CompanyMergeRequestPanel } from "@/components/company-merge-request-panel";
import {
  fetchSeoEntityDirectory,
  resolveCompanySlug,
  seoEntityPath,
  type SeoEntity,
} from "@/lib/seo-entities";

type Claim = {
  id: string;
  company_slug: string | null;
  proposed_company_name: string;
  company_type: string;
  work_email: string;
  status: string;
  review_notes: string | null;
  profile_id: string | null;
  organization_id: string | null;
  created_at: string;
  verification_score: number;
  verification_checks: Record<string, unknown> | null;
  automated_recommendation: string;
  risk_flags: string[] | null;
  last_verified_at: string | null;
  evidence_file_paths: string[];
};

type IndustryProfile = {
  id: string;
  organization_id: string;
  company_slug: string;
  display_name: string;
  company_type: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  country: string | null;
  city: string | null;
  full_address: string | null;
  contact_email: string | null;
  mobile_phone: string | null;
  whatsapp_same_as_mobile: boolean;
  whatsapp_phone: string | null;
  therapeutic_areas: string[];
  product_categories: string[];
  capabilities: string[];
  support_programs: string[];
  social_links: Record<string, string>;
  verification_status: string;
  is_public: boolean;
};

type Contribution = {
  id: string;
  profile_id: string;
  company_slug: string;
  contribution_type: string;
  title: string;
  summary: string;
  status: string;
  review_notes: string | null;
  published_at: string | null;
  created_at: string;
};

type ClaimDraft = {
  existingCompanySlug: string;
  proposedCompanyName: string;
  companyType: string;
  country: string;
  city: string;
  fullAddress: string;
  workEmail: string;
  mobilePhone: string;
  whatsappSameAsMobile: boolean;
  whatsappPhone: string;
  roleTitle: string;
  website: string;
  evidenceUrl: string;
  notes: string;
};

type ContributionDraft = {
  profileId: string;
  type: string;
  title: string;
  summary: string;
  productName: string;
  genericName: string;
  category: string;
  registrationReference: string;
  sourceUrl: string;
  evidenceUrls: string;
};

const companyTypes = [
  "pharma_company",
  "medical_products_company",
  "medical_device_company",
  "diagnostics_company",
  "biotech_company",
  "supplier",
  "distributor",
  "healthcare_company",
];

const contributionTypes = [
  "product_addition",
  "product_update",
  "evidence",
  "correction",
  "educational_resource",
  "patient_support_program",
  "partnership_opportunity",
];

const emptyClaim: ClaimDraft = {
  existingCompanySlug: "",
  proposedCompanyName: "",
  companyType: "pharma_company",
  country: "",
  city: "",
  fullAddress: "",
  workEmail: "",
  mobilePhone: "",
  whatsappSameAsMobile: true,
  whatsappPhone: "",
  roleTitle: "",
  website: "",
  evidenceUrl: "",
  notes: "",
};

const emptyContribution: ContributionDraft = {
  profileId: "",
  type: "product_addition",
  title: "",
  summary: "",
  productName: "",
  genericName: "",
  category: "",
  registrationReference: "",
  sourceUrl: "",
  evidenceUrls: "",
};

function splitList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: string[] | null | undefined) {
  return (value || []).join(", ");
}

function humanize(value: string) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeComparable(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function scoreTone(score: number) {
  if (score >= 75) return "bg-emerald-100 text-emerald-800";
  if (score >= 45) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function IndustryContributionNetwork() {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [companies, setCompanies] = useState<SeoEntity[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [profiles, setProfiles] = useState<IndustryProfile[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [claimDraft, setClaimDraft] = useState<ClaimDraft>(emptyClaim);
  const [contributionDraft, setContributionDraft] = useState<ContributionDraft>(emptyContribution);
  const [profileDrafts, setProfileDrafts] = useState<Record<string, IndustryProfile>>({});
  const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [claimFiles, setClaimFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSourceCompany = useMemo(
    () => companies.find((company) => company.slug === claimDraft.existingCompanySlug) || null,
    [companies, claimDraft.existingCompanySlug],
  );

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === contributionDraft.profileId) || profiles[0] || null,
    [profiles, contributionDraft.profileId],
  );

  const pendingClaims = useMemo(
    () => claims.filter((claim) => ["pending", "under_review"].includes(claim.status)),
    [claims],
  );

  const companySearchResults = useMemo(() => {
    const query = normalizeComparable(companySearch);
    if (!query) return companies.slice(0, 40);
    return companies
      .map((company) => {
        const searchable = [company.name, company.sourceValue || "", company.slug, ...(company.aliases || [])]
          .map(normalizeComparable);
        let score = 0;
        if (searchable.some((value) => value === query)) score = 100;
        else if (searchable.some((value) => value.startsWith(query))) score = 80;
        else if (searchable.some((value) => value.includes(query))) score = 60;
        return { company, score };
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || right.company.records - left.company.records)
      .slice(0, 60)
      .map((result) => result.company);
  }, [companies, companySearch]);

  const currentStep = !isAuthenticated
    ? 1
    : profiles.length > 0
      ? 4
      : pendingClaims.length > 0
        ? 3
        : 2;

  const evidenceReadiness = useMemo(() => {
    const productContribution = ["product_addition", "product_update"].includes(contributionDraft.type);
    const checks = [
      Boolean(contributionDraft.title.trim()),
      Boolean(contributionDraft.summary.trim()),
      !productContribution || Boolean(contributionDraft.productName.trim()),
      Boolean(contributionDraft.sourceUrl.trim() || splitList(contributionDraft.evidenceUrls).length),
    ];
    return checks.filter(Boolean).length;
  }, [contributionDraft]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const directory = await fetchSeoEntityDirectory();
      const nextCompanies = directory.entities
        .filter((entity) => entity.type === "company")
        .sort((left, right) => left.name.localeCompare(right.name));
      setCompanies(nextCompanies);

      const linkedSlug = new URLSearchParams(window.location.search).get("company");
      if (linkedSlug) {
        const canonicalSlug = resolveCompanySlug(directory, linkedSlug);
        if (nextCompanies.some((company) => company.slug === canonicalSlug)) {
          setClaimDraft((current) => ({
            ...current,
            existingCompanySlug: canonicalSlug,
            proposedCompanyName: "",
          }));
        }
      }

      if (!isAuthenticated) {
        setClaims([]);
        setProfiles([]);
        setContributions([]);
        return;
      }

      const claimSelect =
        "id,company_slug,proposed_company_name,company_type,work_email,status,review_notes,profile_id,organization_id,created_at,verification_score,verification_checks,automated_recommendation,risk_flags,last_verified_at,evidence_file_paths";
      const profileSelect =
        "id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,full_address,contact_email,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status,is_public";
      const [nextClaims, nextProfiles, nextContributions] = await Promise.all([
        supabaseFetch<Claim[]>(
          `/rest/v1/industry_company_profile_claims?select=${claimSelect}&order=created_at.desc&limit=50`,
        ),
        supabaseFetch<IndustryProfile[]>(
          `/rest/v1/industry_company_profiles?select=${profileSelect}&order=display_name.asc&limit=50`,
        ),
        supabaseFetch<Contribution[]>(
          "/rest/v1/industry_company_contributions?select=id,profile_id,company_slug,contribution_type,title,summary,status,review_notes,published_at,created_at&order=created_at.desc&limit=100",
        ),
      ]);

      const safeClaims = Array.isArray(nextClaims) ? nextClaims : [];
      const safeProfiles = Array.isArray(nextProfiles) ? nextProfiles : [];
      const safeContributions = Array.isArray(nextContributions) ? nextContributions : [];
      setClaims(safeClaims);
      setProfiles(safeProfiles);
      setContributions(safeContributions);
      setProfileDrafts(Object.fromEntries(safeProfiles.map((profile) => [profile.id, profile])));
      setContributionDraft((current) => ({
        ...current,
        profileId: current.profileId || safeProfiles[0]?.id || "",
      }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not load the industry workspace.", "تعذر تحميل مساحة الشركات."),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [isAuthenticated]);

  useEffect(() => {
    const accountEmail = session?.user?.email || "";
    if (!accountEmail) return;
    setClaimDraft((current) =>
      current.workEmail ? current : { ...current, workEmail: accountEmail },
    );
  }, [session?.user?.email]);

  function chooseCompany(company: SeoEntity | null) {
    setClaimDraft((current) => {
      if (!company) {
        return { ...current, existingCompanySlug: "", proposedCompanyName: "" };
      }
      return {
        ...current,
        existingCompanySlug: company.slug,
        proposedCompanyName: "",
        companyType:
          company.companyType && companyTypes.includes(company.companyType)
            ? company.companyType
            : current.companyType,
        country: current.country || company.country || "",
        city: current.city || company.city || "",
        fullAddress: current.fullAddress || company.fullAddress || "",
        website: current.website || company.website || "",
        mobilePhone: current.mobilePhone || company.mobilePhone || "",
        whatsappSameAsMobile:
          current.mobilePhone || current.whatsappPhone
            ? current.whatsappSameAsMobile
            : company.whatsappSameAsMobile !== false,
        whatsappPhone: current.whatsappPhone || company.whatsappPhone || "",
      };
    });
    setCompanySearch("");
    setCompanyPickerOpen(false);
  }

  function addClaimFiles(files: FileList | null) {
    if (!files) return;
    const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
    const next = Array.from(files).filter((file) => {
      if (!allowedTypes.has(file.type)) {
        setError(t("Upload PDF, JPG, PNG, DOC, or DOCX files only.", "ارفع ملفات PDF أو JPG أو PNG أو DOC أو DOCX فقط."));
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError(t("Each verification file must be 10 MB or smaller.", "يجب ألا يزيد حجم كل ملف توثيق عن 10 ميجابايت."));
        return false;
      }
      return true;
    });
    setClaimFiles((current) => [...current, ...next].slice(0, 5));
  }

  async function uploadClaimFiles() {
    if (!session?.user?.id) return [];
    const uploadedPaths: string[] = [];
    for (const file of claimFiles) {
      const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
      const objectPath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
      const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
      await supabaseFetch(`/storage/v1/object/company-verification-documents/${encodedPath}`, {
        method: "POST",
        headers: { "Content-Type": file.type, "x-upsert": "false" },
        body: file,
      });
      uploadedPaths.push(objectPath);
    }
    return uploadedPaths;
  }

  async function submitClaim(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id) {
      setError(t("Sign in before submitting a company claim.", "سجل الدخول قبل إرسال طلب الشركة."));
      return;
    }
    const companyName = selectedSourceCompany?.name || claimDraft.proposedCompanyName.trim();
    if (!companyName || !claimDraft.workEmail.trim() || !claimDraft.roleTitle.trim()) {
      setError(t("Choose the company and confirm your work email and role.", "اختر الشركة وأكد بريد العمل ودورك."));
      return;
    }
    if (!claimDraft.evidenceUrl.trim() && claimFiles.length === 0) {
      setError(t("Add at least one authorization file or evidence link.", "أضف ملف تفويض واحدًا على الأقل أو رابط دليل."));
      return;
    }
    if (!claimDraft.whatsappSameAsMobile && !claimDraft.whatsappPhone.trim()) {
      setError(
        t(
          "Enter the WhatsApp number or confirm that it is the same as the mobile number.",
          "أدخل رقم واتساب أو أكد أنه نفس رقم الهاتف المحمول.",
        ),
      );
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const evidenceFilePaths = await uploadClaimFiles();
      const rows = await supabaseFetch<Claim[]>(
        "/rest/v1/industry_company_profile_claims?select=id,company_slug,proposed_company_name,company_type,work_email,status,review_notes,profile_id,organization_id,created_at,verification_score,verification_checks,automated_recommendation,risk_flags,last_verified_at,evidence_file_paths",
        {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            company_slug: selectedSourceCompany?.slug || null,
            proposed_company_name: companyName,
            company_type: claimDraft.companyType,
            country: claimDraft.country.trim() || null,
            city: claimDraft.city.trim() || null,
            full_address: claimDraft.fullAddress.trim() || null,
            work_email: claimDraft.workEmail.trim(),
            mobile_phone: claimDraft.mobilePhone.trim() || null,
            whatsapp_same_as_mobile: claimDraft.whatsappSameAsMobile,
            whatsapp_phone: claimDraft.whatsappSameAsMobile
              ? null
              : claimDraft.whatsappPhone.trim() || null,
            role_title: claimDraft.roleTitle.trim() || null,
            website: normalizeUrl(claimDraft.website),
            evidence_url: normalizeUrl(claimDraft.evidenceUrl),
            evidence_file_paths: evidenceFilePaths,
            notes: claimDraft.notes.trim() || null,
            requested_by: session.user.id,
            status: "pending",
          }),
        },
      );
      const claim = Array.isArray(rows) ? rows[0] : null;
      setClaimDraft({ ...emptyClaim, workEmail: session.user.email || "" });
      setClaimFiles([]);
      setMessage(
        claim
          ? t(
              `Request submitted. Automated verification scored it ${claim.verification_score}/100 (${humanize(claim.automated_recommendation)}). A platform administrator will make the final decision.`,
              `تم إرسال الطلب. حصل على ${claim.verification_score}/100 في التحقق الآلي (${humanize(claim.automated_recommendation)}). وسيتخذ مسؤول المنصة القرار النهائي.`,
            )
          : t(
              "Your company profile request was submitted for verification.",
              "تم إرسال طلب ملف الشركة للمراجعة والتوثيق.",
            ),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the company request.", "تعذر إرسال طلب الشركة."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function recheckClaim(id: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/recheck_industry_company_claim", {
        method: "POST",
        body: JSON.stringify({ target_claim: id }),
      });
      setMessage(
        t("Automated verification checks were refreshed.", "تم تحديث فحوص التوثيق الآلية."),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not recheck this claim.", "تعذر إعادة فحص الطلب."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(profileId: string) {
    const draft = profileDrafts[profileId];
    if (!draft) return;
    if (!draft.whatsapp_same_as_mobile && !draft.whatsapp_phone?.trim()) {
      setError(
        t(
          "Enter the WhatsApp number or mark it as the same as the mobile number.",
          "أدخل رقم واتساب أو حدد أنه نفس رقم الهاتف المحمول.",
        ),
      );
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const profileSelect =
        "id,organization_id,company_slug,display_name,company_type,description,website_url,logo_url,country,city,full_address,contact_email,mobile_phone,whatsapp_same_as_mobile,whatsapp_phone,therapeutic_areas,product_categories,capabilities,support_programs,social_links,verification_status,is_public";
      const rows = await supabaseFetch<IndustryProfile[]>(
        `/rest/v1/industry_company_profiles?id=eq.${encodeURIComponent(profileId)}&select=${profileSelect}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            display_name: draft.display_name.trim(),
            company_type: draft.company_type,
            description: draft.description?.trim() || null,
            website_url: normalizeUrl(draft.website_url || ""),
            logo_url: normalizeUrl(draft.logo_url || ""),
            country: draft.country?.trim() || null,
            city: draft.city?.trim() || null,
            full_address: draft.full_address?.trim() || null,
            contact_email: draft.contact_email?.trim() || null,
            mobile_phone: draft.mobile_phone?.trim() || null,
            whatsapp_same_as_mobile: draft.whatsapp_same_as_mobile,
            whatsapp_phone: draft.whatsapp_same_as_mobile
              ? null
              : draft.whatsapp_phone?.trim() || null,
            therapeutic_areas: draft.therapeutic_areas,
            product_categories: draft.product_categories,
            capabilities: draft.capabilities,
            support_programs: draft.support_programs,
            social_links: draft.social_links || {},
          }),
        },
      );
      const updated = rows[0];
      if (updated) {
        setProfiles((current) =>
          current.map((profile) => (profile.id === updated.id ? updated : profile)),
        );
        setProfileDrafts((current) => ({ ...current, [updated.id]: updated }));
      }
      setMessage(t("Official company profile updated.", "تم تحديث ملف الشركة الرسمي."));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not update the company profile.", "تعذر تحديث ملف الشركة."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitContribution(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id || !activeProfile) return;
    const productContribution = ["product_addition", "product_update"].includes(
      contributionDraft.type,
    );
    if (productContribution && !contributionDraft.productName.trim()) {
      setError(
        t(
          "Add the medicine or product name before submitting this contribution.",
          "أضف اسم الدواء أو المنتج قبل إرسال هذه المساهمة.",
        ),
      );
      return;
    }
    if (
      !contributionDraft.sourceUrl.trim() &&
      splitList(contributionDraft.evidenceUrls).length === 0
    ) {
      setError(
        t(
          "Add at least one official source or evidence URL so moderators can verify the contribution.",
          "أضف مصدرًا رسميًا واحدًا أو رابط دليل واحدًا على الأقل حتى يتمكن المراجعون من التحقق من المساهمة.",
        ),
      );
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/industry_company_contributions", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          profile_id: activeProfile.id,
          organization_id: activeProfile.organization_id,
          company_slug: activeProfile.company_slug,
          contribution_type: contributionDraft.type,
          title: contributionDraft.title.trim(),
          summary: contributionDraft.summary.trim(),
          payload: {
            product_name: contributionDraft.productName.trim() || null,
            generic_name: contributionDraft.genericName.trim() || null,
            category: contributionDraft.category.trim() || null,
            registration_reference: contributionDraft.registrationReference.trim() || null,
            source_url: normalizeUrl(contributionDraft.sourceUrl),
          },
          evidence_urls: splitList(contributionDraft.evidenceUrls).map(
            (value) => normalizeUrl(value) || value,
          ),
          submitted_by: session.user.id,
          status: "submitted",
        }),
      });
      setContributionDraft({ ...emptyContribution, profileId: activeProfile.id });
      setMessage(
        t(
          "Contribution submitted. It will be attributed to the company and published only after evidence review.",
          "تم إرسال المساهمة، وستُنسب إلى الشركة ولن تُنشر إلا بعد مراجعة الأدلة.",
        ),
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the contribution.", "تعذر إرسال المساهمة."),
      );
    } finally {
      setSaving(false);
    }
  }

  function updateProfileDraft(profileId: string, patch: Partial<IndustryProfile>) {
    setProfileDrafts((current) => ({
      ...current,
      [profileId]: { ...current[profileId], ...patch },
    }));
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <section className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[1.25fr_.75fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              <Network className="h-4 w-4" />
              {t("Industry contribution network", "شبكة مساهمات قطاع الرعاية الصحية")}
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">
              {t(
                "Register your company, get verified, and improve the medicines database",
                "سجل شركتك واحصل على التوثيق وساهم في تطوير قاعدة بيانات الأدوية",
              )}
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
              {t(
                "Find the existing company by typing its name, add complete contact and location information, prove that you represent it, maintain the official profile, and submit attributable medicine additions, updates, corrections, and evidence.",
                "ابحث عن الشركة بكتابة اسمها، وأضف بيانات الاتصال والموقع كاملة، وأثبت أنك تمثلها، وحدّث ملفها الرسمي، ثم أرسل إضافات وتحديثات وتصحيحات وأدلة الأدوية المنسوبة للشركة.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => scrollTo(isAuthenticated ? "company-claim-form" : "participate")}>
                {isAuthenticated
                  ? t("Start company registration", "ابدأ تسجيل الشركة")
                  : t("Create an account", "إنشاء حساب")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" asChild>
                <Link href="/companies">{t("Browse company directory", "تصفح دليل الشركات")}</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-muted/30 p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-3 text-primary"><Video className="h-6 w-6" /></div>
              <div>
                <div className="font-semibold">{t("Company onboarding videos", "فيديوهات تسجيل الشركات")}</div>
                <div className="text-sm text-muted-foreground">
                  {t(
                    "Separate English and Arabic narrated guides cover registration, verification, profile management, and medicine contributions.",
                    "دليلان منفصلان بالعربية والإنجليزية يشرحان التسجيل والتوثيق وإدارة الملف والمساهمة في بيانات الأدوية.",
                  )}
                </div>
              </div>
            </div>
            <ol className="mt-5 space-y-3 text-sm text-muted-foreground">
              <li>1. {t("Create or sign in to an account.", "أنشئ حسابًا أو سجل الدخول.")}</li>
              <li>2. {t("Search for the company or add a new one.", "ابحث عن الشركة أو أضف شركة جديدة.")}</li>
              <li>3. {t("Submit contact, location, identity, and authority evidence.", "أرسل بيانات الاتصال والموقع والهوية والتفويض.")}</li>
              <li>4. {t("After approval, maintain the profile and contribute medicine data.", "بعد الموافقة، حدّث الملف وساهم ببيانات الأدوية.")}</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="company-onboarding-steps">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="company-onboarding-steps" className="text-3xl font-bold">
              {t("How company participation works", "كيف تعمل مشاركة الشركات")}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {t(
                "Your current stage is highlighted. Approval is required before medicine contributions are enabled.",
                "يتم تمييز مرحلتك الحالية، ويلزم الحصول على الموافقة قبل تفعيل مساهمات الأدوية.",
              )}
            </p>
          </div>
          <Badge variant="outline" className="px-3 py-1.5">
            {companies.length.toLocaleString()} {t("canonical company identities searchable", "هوية شركة موحدة قابلة للبحث")}
          </Badge>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <WorkflowStep number={1} current={currentStep === 1} complete={currentStep > 1} icon={UserRoundCheck} title={t("Create an account", "إنشاء حساب")} description={t("Use an account controlled by the company representative.", "استخدم حسابًا تحت سيطرة ممثل الشركة.")} />
          <WorkflowStep number={2} current={currentStep === 2} complete={currentStep > 2} icon={Search} title={t("Find or add the company", "البحث عن الشركة أو إضافتها")} description={t("Type the company name instead of scrolling through the directory.", "اكتب اسم الشركة بدلًا من التمرير خلال القائمة.")} />
          <WorkflowStep number={3} current={currentStep === 3} complete={currentStep > 3} icon={ShieldCheck} title={t("Verification and approval", "التحقق والموافقة")} description={t("Automated checks assist the final platform-admin review.", "تساعد الفحوص الآلية مسؤول المنصة في المراجعة النهائية.")} />
          <WorkflowStep number={4} current={currentStep === 4} complete={false} icon={FilePlus2} title={t("Contribute medicine knowledge", "المساهمة في بيانات الأدوية")} description={t("Submit products, updates, corrections, evidence, and resources.", "أرسل المنتجات والتحديثات والتصحيحات والأدلة والموارد.")} />
        </div>
      </section>

      <section id="participate" className="mt-10 scroll-mt-28">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">{t("Company participation workspace", "مساحة مشاركة الشركات")}</h2>
            <p className="mt-2 text-muted-foreground">{t("Participation is account-based, attributable, automatically checked, and finally moderated.", "المشاركة مرتبطة بالحساب ومنسوبة لصاحبها وتخضع للفحص الآلي ثم للمراجعة النهائية.")}</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />{t("Refresh", "تحديث")}</Button>
        </div>

        {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
        {message && <Alert className="mt-5"><CircleCheckBig className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

        {!isAuthenticated && !loading && (
          <Card className="mt-5 border-primary/30 bg-primary/5"><CardContent className="p-6 md:p-8"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><h3 className="text-2xl font-semibold">{t("Sign in to represent a company", "سجل الدخول لتمثيل شركة")}</h3><p className="mt-2 max-w-2xl text-muted-foreground">{t("Create an account, preferably with your company email. After signing in, search for the company, provide your contact information, role and evidence, and submit the claim for approval.", "أنشئ حسابًا ويفضل استخدام بريد الشركة. بعد تسجيل الدخول ابحث عن الشركة وأضف بيانات الاتصال ودورك والأدلة ثم أرسل الطلب للموافقة.")}</p></div><Link href="/account" className="rounded-lg bg-primary px-5 py-3 text-center text-sm font-semibold text-primary-foreground">{t("Sign in or create account", "تسجيل الدخول أو إنشاء حساب")}</Link></div></CardContent></Card>
        )}

        {isAuthenticated && !loading && (
          <div className="mt-5 grid gap-6 xl:grid-cols-[.95fr_1.05fr]">
            <Card id="company-claim-form" className="scroll-mt-28">
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />{t("Create or claim a company profile", "إنشاء أو المطالبة بملف شركة")}</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={submitClaim} className="space-y-5">
                  <div>
                    <Label>{t("Find your company", "ابحث عن شركتك")}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">{t("Search by company name. Canonical merges hide reviewed duplicates. Choose “new company” only when no reliable match exists.", "ابحث باسم الشركة. تخفي الهوية الموحدة التكرارات التي تمت مراجعتها. اختر «شركة جديدة» فقط عند عدم وجود تطابق موثوق.")}</p>
                    <SearchableCompanyPicker open={companyPickerOpen} setOpen={setCompanyPickerOpen} query={companySearch} setQuery={setCompanySearch} selected={selectedSourceCompany} results={companySearchResults} total={companies.length} onSelect={chooseCompany} t={t} />
                  </div>

                  {selectedSourceCompany ? (
                    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{selectedSourceCompany.name}</div><div className="mt-1 text-xs text-muted-foreground">{selectedSourceCompany.records.toLocaleString()} {t("medicine records", "سجل دوائي")}{selectedSourceCompany.country ? ` · ${selectedSourceCompany.country}` : ""}</div>{selectedSourceCompany.aliases?.length ? <div className="mt-1 text-xs text-muted-foreground">{t("Merged aliases", "الأسماء المدمجة")}: {selectedSourceCompany.aliases.join(", ")}</div> : null}</div><Link href={seoEntityPath("company", selectedSourceCompany.slug)} className="inline-flex items-center text-sm font-semibold text-primary">{t("Preview record", "معاينة السجل")}<ExternalLink className="ml-1 h-3.5 w-3.5" /></Link></div></div>
                  ) : (
                    <Field label={t("Company name", "اسم الشركة")} value={claimDraft.proposedCompanyName} onChange={(value) => setClaimDraft({ ...claimDraft, proposedCompanyName: value })} placeholder={t("Enter the official company name", "اكتب الاسم الرسمي للشركة")} required />
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label={t("Work email", "بريد العمل")} type="email" value={claimDraft.workEmail} onChange={(value) => setClaimDraft({ ...claimDraft, workEmail: value })} description={t("We prefill your account email. A company-domain address can speed up review.", "نملأ بريد حسابك تلقائيًا، وقد يسرّع بريد نطاق الشركة المراجعة.")} required />
                    <Field label={t("Your role at the company", "دورك في الشركة")} value={claimDraft.roleTitle} onChange={(value) => setClaimDraft({ ...claimDraft, roleTitle: value })} placeholder={t("Product manager, regulatory affairs…", "مدير منتج، الشؤون التنظيمية…")} required />
                  </div>

                  <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
                    <div className="flex items-start gap-3"><UploadCloud className="mt-0.5 h-5 w-5 text-primary" /><div><Label htmlFor="company-verification-files">{t("Authorization or company verification files", "ملفات التفويض أو توثيق الشركة")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("Upload up to 5 files: authorization letter, company ID, registration extract, or proof of employment. PDF, JPG, PNG, DOC, or DOCX; maximum 10 MB each.", "ارفع حتى 5 ملفات: خطاب تفويض أو هوية الشركة أو مستخرج السجل أو إثبات العمل. PDF أو JPG أو PNG أو DOC أو DOCX؛ بحد أقصى 10 ميجابايت للملف.")}</p></div></div>
                    <Input id="company-verification-files" className="mt-3" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(event) => { addClaimFiles(event.target.files); event.target.value = ""; }} />
                    {claimFiles.length > 0 && <div className="mt-3 space-y-2">{claimFiles.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-3 rounded-lg bg-background p-2 text-sm"><FileCheck2 className="h-4 w-4 text-primary" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" aria-label={t("Remove file", "حذف الملف")} onClick={() => setClaimFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-4 w-4" /></button></div>)}</div>}
                  </div>

                  <details className="rounded-xl border p-4">
                    <summary className="cursor-pointer font-semibold">{t("Add optional company and contact details", "إضافة بيانات اختيارية للشركة والتواصل")}</summary>
                    <p className="mt-2 text-xs text-muted-foreground">{t("These fields can improve verification, but you can complete them later after approval.", "قد تحسن هذه البيانات التوثيق، ويمكنك إكمالها لاحقًا بعد الموافقة.")}</p>
                    <div className="mt-4 space-y-4">
                      <SelectField label={t("Company type", "نوع الشركة")} value={claimDraft.companyType} values={companyTypes} onChange={(value) => setClaimDraft({ ...claimDraft, companyType: value })} />
                      <div className="grid gap-4 md:grid-cols-2"><Field label={t("Country", "الدولة")} value={claimDraft.country} onChange={(value) => setClaimDraft({ ...claimDraft, country: value })} /><Field label={t("City", "المدينة")} value={claimDraft.city} onChange={(value) => setClaimDraft({ ...claimDraft, city: value })} /></div>
                      <div><Label>{t("Full address", "العنوان الكامل")}</Label><Textarea className="mt-1 min-h-20" value={claimDraft.fullAddress} onChange={(event) => setClaimDraft({ ...claimDraft, fullAddress: event.target.value })} /></div>
                      <Field label={t("Mobile phone number", "رقم الهاتف المحمول")} type="tel" value={claimDraft.mobilePhone} onChange={(value) => setClaimDraft({ ...claimDraft, mobilePhone: value })} placeholder="+20 10 0000 0000" />
                      {claimDraft.mobilePhone && <WhatsAppChoice same={claimDraft.whatsappSameAsMobile} number={claimDraft.whatsappPhone} onSameChange={(same) => setClaimDraft({ ...claimDraft, whatsappSameAsMobile: same, whatsappPhone: same ? "" : claimDraft.whatsappPhone })} onNumberChange={(whatsappPhone) => setClaimDraft({ ...claimDraft, whatsappPhone })} t={t} />}
                      <Field label={t("Company website", "موقع الشركة")} type="url" value={claimDraft.website} onChange={(value) => setClaimDraft({ ...claimDraft, website: value })} placeholder="company.com" />
                      <Field label={t("Evidence link (alternative to uploading a file)", "رابط دليل (بديل عن رفع ملف)")} type="url" value={claimDraft.evidenceUrl} onChange={(value) => setClaimDraft({ ...claimDraft, evidenceUrl: value })} />
                      <div><Label>{t("Anything else the reviewer should know?", "هل توجد معلومات أخرى للمراجع؟")}</Label><Textarea className="mt-1 min-h-20" value={claimDraft.notes} onChange={(event) => setClaimDraft({ ...claimDraft, notes: event.target.value })} /></div>
                    </div>
                  </details>

                  <div className="rounded-xl bg-muted/50 p-4 text-sm"><div className="font-semibold">{t("Only three things are needed to start", "تحتاج فقط إلى ثلاثة أشياء للبدء")}</div><ul className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-3"><li>1. {t("Choose or name the company", "اختر الشركة أو اكتب اسمها")}</li><li>2. {t("Confirm your email and role", "أكد بريدك ودورك")}</li><li>3. {t("Add one authorization file or link", "أضف ملف تفويض أو رابطًا واحدًا")}</li></ul></div>

                  <Button type="submit" disabled={saving || (!selectedSourceCompany && !claimDraft.proposedCompanyName.trim()) || !claimDraft.workEmail.trim() || !claimDraft.roleTitle.trim() || (!claimDraft.evidenceUrl.trim() && claimFiles.length === 0)}><ShieldCheck className="mr-2 h-4 w-4" />{saving ? t("Uploading and submitting…", "جارٍ رفع الملفات والإرسال…") : t("Submit company verification request", "إرسال طلب توثيق الشركة")}</Button>
                </form>
              </CardContent>
            </Card>

            <Card id="profile-requests"><CardHeader><CardTitle>{t("Your company verification requests", "طلبات توثيق شركاتك")}</CardTitle></CardHeader><CardContent className="space-y-3">
              {claims.map((claim) => <div key={claim.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{claim.proposed_company_name}</div><div className="mt-1 text-xs text-muted-foreground">{humanize(claim.company_type)} · {new Date(claim.created_at).toLocaleDateString()}</div></div><StatusBadge status={claim.status} /></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreTone(Number(claim.verification_score || 0))}`}>{t("Automated score", "الدرجة الآلية")}: {Number(claim.verification_score || 0)}/100</span><Badge variant="outline">{humanize(claim.automated_recommendation)}</Badge></div>{(claim.risk_flags || []).length > 0 && <div className="mt-3 flex flex-wrap gap-2">{(claim.risk_flags || []).map((flag) => <Badge key={flag} variant="destructive">{humanize(flag)}</Badge>)}</div>}<p className="mt-3 text-xs text-muted-foreground">{t("Automated checks are advisory. Final profile ownership requires platform-admin approval.", "الفحوص الآلية استشارية، وتتطلب ملكية الملف موافقة مسؤول المنصة النهائية.")}</p>{claim.review_notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{claim.review_notes}</p>}<div className="mt-3 flex flex-wrap gap-3">{!["approved", "rejected"].includes(claim.status) && <Button size="sm" variant="outline" disabled={saving} onClick={() => void recheckClaim(claim.id)}><RefreshCw className="mr-2 h-3.5 w-3.5" />{t("Recheck", "إعادة الفحص")}</Button>}{claim.status === "approved" && claim.company_slug && <Link href={seoEntityPath("company", claim.company_slug)} className="inline-flex items-center text-sm font-semibold text-primary">{t("Open public profile", "فتح الملف العام")}</Link>}{claim.status === "approved" && <Button size="sm" onClick={() => scrollTo("company-contribution-form")}>{t("Contribute medicine data", "المساهمة ببيانات الأدوية")}<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button>}</div></div>)}
              {claims.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{t("No company requests yet. Search for the company and submit the form beside this panel.", "لا توجد طلبات شركات بعد. ابحث عن الشركة وأرسل النموذج المجاور.")}</p></div>}
            </CardContent></Card>
          </div>
        )}
      </section>

      {isAuthenticated && profiles.length > 0 && (
        <section className="mt-10"><div><h2 className="text-3xl font-bold">{t("Official company profiles you manage", "ملفات الشركات الرسمية التي تديرها")}</h2><p className="mt-2 text-muted-foreground">{t("Maintain verified official information without overwriting independent dataset evidence.", "حدّث المعلومات الرسمية الموثقة دون الكتابة فوق أدلة قاعدة البيانات المستقلة.")}</p></div><div className="mt-5 grid gap-6 xl:grid-cols-2">
          {profiles.map((profile) => { const draft = profileDrafts[profile.id] || profile; return <Card key={profile.id} className="border-primary/20"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2">{profile.display_name}{profile.verification_status === "verified" && <BadgeCheck className="h-5 w-5 text-primary" />}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{humanize(profile.company_type)}</p></div><StatusBadge status={profile.verification_status} /></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label={t("Display name", "الاسم المعروض")} value={draft.display_name} onChange={(value) => updateProfileDraft(profile.id, { display_name: value })} /><SelectField label={t("Company type", "نوع الشركة")} value={draft.company_type} values={companyTypes} onChange={(value) => updateProfileDraft(profile.id, { company_type: value })} /></div><div><Label>{t("Company overview", "نبذة الشركة")}</Label><Textarea className="mt-1 min-h-28" value={draft.description || ""} onChange={(event) => updateProfileDraft(profile.id, { description: event.target.value })} /></div><div className="grid gap-4 md:grid-cols-2"><Field label={t("Website", "الموقع")} type="url" value={draft.website_url || ""} onChange={(value) => updateProfileDraft(profile.id, { website_url: value })} /><Field label={t("Logo URL", "رابط الشعار")} type="url" value={draft.logo_url || ""} onChange={(value) => updateProfileDraft(profile.id, { logo_url: value })} /><Field label={t("Country", "الدولة")} value={draft.country || ""} onChange={(value) => updateProfileDraft(profile.id, { country: value })} /><Field label={t("City", "المدينة")} value={draft.city || ""} onChange={(value) => updateProfileDraft(profile.id, { city: value })} /><Field label={t("Contact email", "بريد التواصل")} type="email" value={draft.contact_email || ""} onChange={(value) => updateProfileDraft(profile.id, { contact_email: value })} /><Field label={t("Mobile phone", "الهاتف المحمول")} type="tel" value={draft.mobile_phone || ""} onChange={(value) => updateProfileDraft(profile.id, { mobile_phone: value })} /></div><div><Label>{t("Full address", "العنوان الكامل")}</Label><Textarea className="mt-1 min-h-20" value={draft.full_address || ""} onChange={(event) => updateProfileDraft(profile.id, { full_address: event.target.value })} /></div><WhatsAppChoice same={draft.whatsapp_same_as_mobile} number={draft.whatsapp_phone || ""} onSameChange={(same) => updateProfileDraft(profile.id, { whatsapp_same_as_mobile: same, whatsapp_phone: same ? null : draft.whatsapp_phone })} onNumberChange={(whatsapp_phone) => updateProfileDraft(profile.id, { whatsapp_phone })} t={t} /><ListField label={t("Therapeutic areas", "المجالات العلاجية")} value={joinList(draft.therapeutic_areas)} onChange={(value) => updateProfileDraft(profile.id, { therapeutic_areas: splitList(value) })} /><ListField label={t("Product categories", "فئات المنتجات")} value={joinList(draft.product_categories)} onChange={(value) => updateProfileDraft(profile.id, { product_categories: splitList(value) })} /><ListField label={t("Capabilities", "القدرات")} value={joinList(draft.capabilities)} onChange={(value) => updateProfileDraft(profile.id, { capabilities: splitList(value) })} /><ListField label={t("Support programs", "برامج الدعم")} value={joinList(draft.support_programs)} onChange={(value) => updateProfileDraft(profile.id, { support_programs: splitList(value) })} /><div className="flex flex-wrap gap-3"><Button onClick={() => void saveProfile(profile.id)} disabled={saving}><PencilLine className="mr-2 h-4 w-4" />{t("Save official profile", "حفظ الملف الرسمي")}</Button><Link href={seoEntityPath("company", profile.company_slug)} className="rounded-lg border px-4 py-2 text-sm font-semibold">{t("View public profile", "عرض الملف العام")}</Link></div></CardContent></Card>; })}
        </div></section>
      )}

      {isAuthenticated && profiles.length > 0 ? (
        <section className="mt-10 grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
          <Card id="company-contribution-form" className="scroll-mt-28"><CardHeader><CardTitle className="flex items-center gap-2"><FilePlus2 className="h-5 w-5" />{t("Contribute to the medicines database", "المساهمة في قاعدة بيانات الأدوية")}</CardTitle></CardHeader><CardContent><form onSubmit={submitContribution} className="space-y-5"><SelectField label={t("Company profile", "ملف الشركة")} value={contributionDraft.profileId || profiles[0].id} values={profiles.map((profile) => profile.id)} labels={Object.fromEntries(profiles.map((profile) => [profile.id, profile.display_name]))} onChange={(value) => setContributionDraft({ ...contributionDraft, profileId: value })} /><SelectField label={t("What are you contributing?", "ما نوع المساهمة؟")} value={contributionDraft.type} values={contributionTypes} onChange={(value) => setContributionDraft({ ...contributionDraft, type: value })} /><Field label={t("Contribution title", "عنوان المساهمة")} value={contributionDraft.title} onChange={(value) => setContributionDraft({ ...contributionDraft, title: value })} placeholder={t("Example: Add official information for Product X 20 mg", "مثال: إضافة المعلومات الرسمية للمنتج س 20 مجم")} required /><div><Label>{t("Summary and requested change", "الملخص والتغيير المطلوب")}</Label><Textarea className="mt-1 min-h-28" value={contributionDraft.summary} onChange={(event) => setContributionDraft({ ...contributionDraft, summary: event.target.value })} placeholder={t("Explain what should be added or corrected, why it is accurate, and what evidence supports it.", "اشرح ما الذي يجب إضافته أو تصحيحه ولماذا هو دقيق وما الدليل الذي يدعمه.")} required /></div><div className="grid gap-4 md:grid-cols-2"><Field label={t("Product or medicine name", "اسم المنتج أو الدواء")} value={contributionDraft.productName} onChange={(value) => setContributionDraft({ ...contributionDraft, productName: value })} required={["product_addition", "product_update"].includes(contributionDraft.type)} /><Field label={t("Generic or active ingredient", "المادة الفعالة")} value={contributionDraft.genericName} onChange={(value) => setContributionDraft({ ...contributionDraft, genericName: value })} /><Field label={t("Category or dosage form", "الفئة أو الشكل الدوائي")} value={contributionDraft.category} onChange={(value) => setContributionDraft({ ...contributionDraft, category: value })} /><Field label={t("Registration reference", "مرجع التسجيل")} value={contributionDraft.registrationReference} onChange={(value) => setContributionDraft({ ...contributionDraft, registrationReference: value })} /><Field label={t("Official source URL", "رابط المصدر الرسمي")} type="url" value={contributionDraft.sourceUrl} onChange={(value) => setContributionDraft({ ...contributionDraft, sourceUrl: value })} placeholder="company.com/products/product-name" /></div><ListField label={t("Evidence URLs", "روابط الأدلة")} value={contributionDraft.evidenceUrls} onChange={(value) => setContributionDraft({ ...contributionDraft, evidenceUrls: value })} description={t("Add one URL per line or separate URLs with commas. Official leaflets, regulatory references, and company product pages are strongest.", "أضف رابطًا واحدًا في كل سطر أو افصل الروابط بفواصل. النشرات الرسمية والمراجع التنظيمية وصفحات المنتجات هي الأقوى.")} /><div className="rounded-xl border bg-muted/30 p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold">{t("Submission readiness", "جاهزية الإرسال")}</div><div className="text-xs text-muted-foreground">{t("Complete the essential information before review.", "أكمل المعلومات الأساسية قبل المراجعة.")}</div></div><Badge variant={evidenceReadiness === 4 ? "default" : "outline"}>{evidenceReadiness}/4</Badge></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><ReadinessItem ready={Boolean(contributionDraft.title.trim())} label={t("Clear title", "عنوان واضح")} /><ReadinessItem ready={Boolean(contributionDraft.summary.trim())} label={t("Detailed summary", "ملخص تفصيلي")} /><ReadinessItem ready={!['product_addition','product_update'].includes(contributionDraft.type) || Boolean(contributionDraft.productName.trim())} label={t("Product identified", "تحديد المنتج")} /><ReadinessItem ready={Boolean(contributionDraft.sourceUrl.trim() || splitList(contributionDraft.evidenceUrls).length)} label={t("Verifiable evidence", "دليل قابل للتحقق")} /></div></div><Button type="submit" disabled={saving || !contributionDraft.title.trim() || !contributionDraft.summary.trim() || evidenceReadiness < 4}><FilePlus2 className="mr-2 h-4 w-4" />{saving ? t("Submitting…", "جارٍ الإرسال…") : t("Submit medicine contribution for review", "إرسال مساهمة الدواء للمراجعة")}</Button></form></CardContent></Card>

          <Card><CardHeader><CardTitle>{t("Contribution history", "سجل المساهمات")}</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><FileCheck2 className="h-4 w-4 text-primary" />{t("What happens after submission?", "ماذا يحدث بعد الإرسال؟")}</div><ol className="mt-2 space-y-1 text-muted-foreground"><li>1. {t("The contribution is attributed to your verified company.", "تُنسب المساهمة إلى شركتك الموثقة.")}</li><li>2. {t("A moderator checks the evidence and requested change.", "يراجع المسؤول الأدلة والتغيير المطلوب.")}</li><li>3. {t("Approved knowledge becomes connected to the relevant company and medicine records.", "تُربط المعرفة المعتمدة بسجلات الشركة والأدوية ذات الصلة.")}</li><li>4. {t("Regulatory approval is never inferred from platform publication.", "لا يعني النشر على المنصة اعتمادًا تنظيميًا.")}</li></ol></div>{contributions.map((item) => <div key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold">{item.title}</div><div className="mt-1 text-xs text-muted-foreground">{humanize(item.contribution_type)} · {item.company_slug}</div></div><StatusBadge status={item.status} /></div><p className="mt-3 text-sm text-muted-foreground">{item.summary}</p>{item.review_notes && <p className="mt-3 rounded-lg bg-muted p-3 text-sm text-muted-foreground">{item.review_notes}</p>}{item.published_at && <p className="mt-2 text-xs text-muted-foreground">{t("Published", "نُشرت")}: {new Date(item.published_at).toLocaleDateString()}</p>}</div>)}{contributions.length === 0 && <div className="rounded-xl border border-dashed p-6 text-center"><Handshake className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">{t("No contributions yet. Use the form to submit the first evidence-backed update.", "لا توجد مساهمات بعد. استخدم النموذج لإرسال أول تحديث مدعوم بالأدلة.")}</p></div>}</CardContent></Card>
        </section>
      ) : isAuthenticated && !loading ? (
        <section className="mt-10"><Card className="border-dashed"><CardContent className="p-6 md:p-8"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h2 className="text-2xl font-semibold">{t("Medicine contributions unlock after verification", "تُفعّل مساهمات الأدوية بعد التوثيق")}</h2><p className="mt-2 max-w-3xl text-muted-foreground">{pendingClaims.length ? t("Your request is under review. Once approved, the official company profile and medicine-contribution form will appear here automatically.", "طلبك قيد المراجعة. بعد الموافقة سيظهر ملف الشركة الرسمي ونموذج مساهمات الأدوية هنا تلقائيًا.") : t("Submit a company claim above. The platform administrator must verify your relationship to the company before contributions can be attributed to it.", "أرسل طلب الشركة أعلاه. يجب أن يتحقق مسؤول المنصة من علاقتك بالشركة قبل نسبة المساهمات إليها.")}</p></div><Button variant="outline" onClick={() => scrollTo("company-claim-form")}>{t("Open company form", "فتح نموذج الشركة")}</Button></div></CardContent></Card></section>
      ) : null}

      <CompanyMergeRequestPanel />
      <Alert className="mt-10"><AlertDescription>{t("Company verification confirms a governed platform relationship and does not replace regulatory licensing, marketing authorization, quality certification, or independent validation of every submitted product claim.", "يوثق اعتماد الشركة علاقتها الخاضعة للحوكمة بالمنصة، ولا يستبدل الترخيص التنظيمي أو تصريح التسويق أو شهادات الجودة أو التحقق المستقل من كل ادعاء متعلق بالمنتج.")}</AlertDescription></Alert>
    </main>
  );
}

function SearchableCompanyPicker({ open, setOpen, query, setQuery, selected, results, total, onSelect, t }: { open: boolean; setOpen: (open: boolean) => void; query: string; setQuery: (value: string) => void; selected: SeoEntity | null; results: SeoEntity[]; total: number; onSelect: (company: SeoEntity | null) => void; t: (en: string, ar: string) => string }) {
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-expanded={open} className="mt-2 min-h-14 w-full justify-between px-4 text-left font-normal"><span className="truncate">{selected ? selected.name : t("Search company name or choose a new company", "ابحث باسم الشركة أو اختر شركة جديدة")}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent className="w-[min(94vw,780px)] p-0" align="start"><Command shouldFilter={false}><CommandInput value={query} onValueChange={setQuery} placeholder={t("Type company name…", "اكتب اسم الشركة…")} /><CommandList className="max-h-[55vh]"><CommandEmpty>{t("No matching company found.", "لم يتم العثور على شركة مطابقة.")}</CommandEmpty><CommandGroup heading={t("Company choice", "اختيار الشركة")}><CommandItem value="__new_company__" onSelect={() => onSelect(null)}><PlusCircle className="mr-3 h-5 w-5 text-primary" /><span className="flex-1"><span className="block font-semibold">{t("New or currently unlisted company", "شركة جديدة أو غير مدرجة حاليًا")}</span><span className="block text-xs text-muted-foreground">{t("Use only when the search has no reliable match.", "استخدم هذا الخيار فقط عند عدم وجود تطابق موثوق.")}</span></span>{!selected && <Check className="h-4 w-4" />}</CommandItem></CommandGroup><CommandGroup heading={t("Dataset companies", "شركات قاعدة البيانات")}>{results.map((company) => <CommandItem key={company.slug} value={company.slug} onSelect={() => onSelect(company)}><Building2 className="mr-3 h-5 w-5 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{company.name}</span><span className="block truncate text-xs text-muted-foreground">{company.records.toLocaleString()} {t("records", "سجل")}{company.country ? ` · ${company.country}` : ""}{company.official ? ` · ${t("official", "رسمي")}` : ""}</span></span>{selected?.slug === company.slug && <Check className="h-4 w-4" />}</CommandItem>)}</CommandGroup></CommandList><div className="border-t px-4 py-3 text-xs text-muted-foreground">{t("Searching", "البحث داخل")} {total.toLocaleString()} {t("canonical company identities", "هوية شركة موحدة")}</div></Command></PopoverContent></Popover>;
}

function WhatsAppChoice({ same, number, onSameChange, onNumberChange, t }: { same: boolean; number: string; onSameChange: (value: boolean) => void; onNumberChange: (value: string) => void; t: (en: string, ar: string) => string }) {
  return <div className="rounded-xl border p-4"><div className="flex items-center gap-2 font-semibold"><Phone className="h-4 w-4 text-primary" />{t("Is the mobile number also used for WhatsApp?", "هل رقم الهاتف المحمول هو نفسه رقم واتساب؟")}</div><label className={`mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-sm ${same ? "border-primary bg-primary/5" : ""}`}><input type="checkbox" checked={same} onChange={(event) => onSameChange(event.target.checked)} />{t("Yes", "نعم")}</label>{!same && <div className="mt-4"><Field label={t("WhatsApp number", "رقم واتساب")} type="tel" value={number} onChange={onNumberChange} placeholder="+20 10 0000 0000" required /></div>}</div>;
}

function WorkflowStep({ number, current, complete, icon: Icon, title, description }: { number: number; current: boolean; complete: boolean; icon: typeof Search; title: string; description: string }) {
  return <Card className={current ? "border-primary shadow-sm" : ""}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className={`rounded-xl p-2.5 ${complete ? "bg-emerald-100 text-emerald-700" : current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="h-5 w-5" /></div><Badge variant={current ? "default" : "outline"}>{complete ? "✓" : number}</Badge></div><div className="mt-4 font-semibold">{title}</div><p className="mt-2 text-sm text-muted-foreground">{description}</p></CardContent></Card>;
}

function Field({ label, value, onChange, type = "text", placeholder, description, required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; description?: string; required?: boolean }) {
  return <div><Label>{label}</Label><Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>;
}

function SelectField({ label, value, values, labels, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <div><Label>{label}</Label><select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option key={item} value={item}>{labels?.[item] || humanize(item)}</option>)}</select></div>;
}

function ListField({ label, value, onChange, description }: { label: string; value: string; onChange: (value: string) => void; description?: string }) {
  return <div><Label>{label}</Label><Textarea className="mt-1 min-h-20" value={value} onChange={(event) => onChange(event.target.value)} />{description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const variant = ["verified", "approved"].includes(status) ? "default" : ["rejected", "suspended"].includes(status) ? "destructive" : "secondary";
  return <Badge variant={variant}>{humanize(status)}</Badge>;
}

function ReadinessItem({ ready, label }: { ready: boolean; label: string }) {
  return <div className="flex items-center gap-2"><span className={`flex h-5 w-5 items-center justify-center rounded-full ${ready ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{ready ? <Check className="h-3.5 w-3.5" /> : "·"}</span>{label}</div>;
}
