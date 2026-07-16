import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Camera,
  EllipsisVertical,
  Link2Off,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/i18n";
import { usePatientAuth } from "@/lib/patient-auth";

type CompanyRelationship = { company_slug: string; company_name: string };
type Membership = { organization_id: string };
export type ManagedProductCompany = {
  id: string;
  organization_id: string;
  company_slug: string;
  display_name: string;
  canonical_company_slug?: string;
};
type Resolution = {
  source_company_slug: string;
  canonical_company_slug: string;
};
type RequestKind =
  | "portfolio_correction"
  | "portfolio_disassociation"
  | "product_photo_update";

const actionOptions = [
  {
    value: "portfolio_correction",
    icon: PencilLine,
    en: "Propose an edit",
    ar: "اقتراح تعديل",
  },
  {
    value: "portfolio_disassociation",
    icon: Link2Off,
    en: "Report incorrect portfolio association",
    ar: "الإبلاغ عن ارتباط خاطئ بالمحفظة",
  },
  {
    value: "product_photo_update",
    icon: Camera,
    en: "Submit an updated product photo",
    ar: "إرسال صورة محدثة للمنتج",
  },
] as const;

export function CompanyProductManagementMenu({
  canonicalId,
  productName,
  relationships,
  authorizedProfiles,
  cardMenu = false,
}: {
  canonicalId: number;
  productName: string;
  relationships: CompanyRelationship[];
  authorizedProfiles?: ManagedProductCompany[];
  cardMenu?: boolean;
}) {
  const { t } = useLanguage();
  const { session, isAuthenticated, supabaseFetch } = usePatientAuth();
  const [profiles, setProfiles] = useState<ManagedProductCompany[]>([]);
  const [kind, setKind] = useState<RequestKind>("portfolio_correction");
  const [profileId, setProfileId] = useState("");
  const [details, setDetails] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    if (
      authorizedProfiles !== undefined ||
      !isAuthenticated ||
      !userId ||
      relationships.length === 0
    )
      return;
    let cancelled = false;
    void (async () => {
      try {
        const memberships = await supabaseFetch<Membership[]>(
          `/rest/v1/organization_members?select=organization_id&user_id=eq.${userId}&is_active=eq.true`,
        );
        const organizationIds = memberships.map((row) => row.organization_id);
        if (organizationIds.length === 0) return;
        const companyProfiles = await supabaseFetch<ManagedProductCompany[]>(
          `/rest/v1/industry_company_profiles?select=id,organization_id,company_slug,display_name&organization_id=in.(${organizationIds.join(",")})&verification_status=eq.verified`,
        );
        const slugs = Array.from(
          new Set([
            ...companyProfiles.map((row) => row.company_slug),
            ...relationships.map((row) => row.company_slug),
          ]),
        );
        const resolutions = slugs.length
          ? await supabaseFetch<Resolution[]>(
              `/rest/v1/company_directory_resolutions_v1?select=source_company_slug,canonical_company_slug&source_company_slug=in.(${slugs.map(encodeURIComponent).join(",")})`,
            )
          : [];
        const canonicalBySlug = new Map(
          resolutions.map((row) => [
            row.source_company_slug,
            row.canonical_company_slug,
          ]),
        );
        const productCompanies = new Set(
          relationships.map(
            (row) => canonicalBySlug.get(row.company_slug) || row.company_slug,
          ),
        );
        const owned = companyProfiles.filter((profile) =>
          productCompanies.has(
            canonicalBySlug.get(profile.company_slug) || profile.company_slug,
          ),
        );
        if (!cancelled) {
          setProfiles(owned);
          setProfileId(owned[0]?.id || "");
        }
      } catch {
        if (!cancelled) setProfiles([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizedProfiles, isAuthenticated, session?.user?.id, canonicalId]);

  const availableProfiles = authorizedProfiles ?? profiles;

  const selectedProfile = useMemo(
    () =>
      availableProfiles.find((profile) => profile.id === profileId) ||
      availableProfiles[0] ||
      null,
    [availableProfiles, profileId],
  );
  if (!selectedProfile) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.user?.id || !selectedProfile || details.trim().length < 10)
      return;
    if (kind === "product_photo_update" && !photo) {
      setError(
        t(
          "Choose the updated product photo first.",
          "اختر صورة المنتج المحدثة أولاً.",
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const filePaths: string[] = [];
      const fileNames: string[] = [];
      if (photo) {
        if (
          photo.size > 10 * 1024 * 1024 ||
          !["image/jpeg", "image/png", "image/webp"].includes(photo.type)
        )
          throw new Error(
            t(
              "Use a JPG, PNG, or WebP image up to 10 MB.",
              "استخدم صورة JPG أو PNG أو WebP بحجم لا يتجاوز 10 ميجابايت.",
            ),
          );
        const safeName =
          photo.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-") ||
          "product-photo";
        const objectPath = `${session.user.id}/${crypto.randomUUID()}-${safeName}`;
        const encodedPath = objectPath
          .split("/")
          .map(encodeURIComponent)
          .join("/");
        await supabaseFetch(
          `/storage/v1/object/medicine-data-submissions/${encodedPath}`,
          {
            method: "POST",
            headers: { "Content-Type": photo.type, "x-upsert": "false" },
            body: photo,
          },
        );
        filePaths.push(objectPath);
        fileNames.push(photo.name);
      }
      await supabaseFetch("/rest/v1/medicine_catalog_submissions", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          submitted_by: session.user.id,
          organization_id: selectedProfile.organization_id,
          company_profile_id: selectedProfile.id,
          submitter_kind: "company_representative",
          submission_kind: kind,
          canonical_id: canonicalId,
          request_company_slug: selectedProfile.company_slug,
          title: `${productName}: ${actionOptions.find((option) => option.value === kind)?.en}`,
          medicine_name: productName,
          description: details.trim(),
          source_url: normalizeUrl(sourceUrl),
          file_paths: filePaths,
          file_names: fileNames,
        }),
      });
      setMessage(
        t(
          "Your request was sent for governed review. The public product stays unchanged until approval.",
          "تم إرسال طلبك للمراجعة المنضبطة. سيظل المنتج العام دون تغيير حتى الموافقة.",
        ),
      );
      setDetails("");
      setSourceUrl("");
      setPhoto(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not submit the request.", "تعذر إرسال الطلب."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {cardMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-full bg-background/95 shadow-md backdrop-blur"
              aria-label={t("Manage company product", "إدارة منتج الشركة")}
            >
              <EllipsisVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>
              {t("Manage this portfolio product", "إدارة منتج المحفظة هذا")}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {actionOptions.map(({ value, icon: Icon, en, ar }) => (
              <DropdownMenuItem
                key={value}
                className="min-h-11 cursor-pointer gap-3"
                onSelect={() => {
                  setKind(value);
                  setOpen(true);
                }}
              >
                <Icon className="h-4 w-4" />
                {t(en, ar)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          <Building2 className="mr-2 h-4 w-4" />
          {t("Manage this company product", "إدارة منتج الشركة هذا")}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("Company product request", "طلب إدارة منتج الشركة")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Choose an action and send it to the authorized review queue. No public data changes automatically.",
                "اختر الإجراء وأرسله إلى قائمة المراجعة المخولة. لا تتغير أي بيانات عامة تلقائياً.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                <ShieldCheck className="mr-1 h-3 w-3" />
                {t("Verified representative", "ممثل موثق")}
              </Badge>
              <span className="text-sm font-semibold">
                {selectedProfile.display_name}
              </span>
            </div>
            {availableProfiles.length > 1 && (
              <div>
                <Label>{t("Acting for", "التصرف نيابة عن")}</Label>
                <select
                  className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                  value={selectedProfile.id}
                  onChange={(event) => setProfileId(event.target.value)}
                >
                  {availableProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.display_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              {actionOptions.map(({ value, icon: Icon, en, ar }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={`min-h-28 rounded-xl border p-4 text-left transition ${kind === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40 hover:bg-muted/40"}`}
                >
                  <Icon className="mb-3 h-5 w-5" />
                  <span className="text-sm font-semibold">{t(en, ar)}</span>
                </button>
              ))}
            </div>
            <div>
              <Label>
                {kind === "portfolio_disassociation"
                  ? t(
                      "Why does this product not belong to your portfolio?",
                      "لماذا لا ينتمي هذا المنتج إلى محفظتكم؟",
                    )
                  : t(
                      "Requested change and supporting details",
                      "التغيير المطلوب والتفاصيل الداعمة",
                    )}
              </Label>
              <Textarea
                className="mt-1 min-h-28"
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                required
                minLength={10}
              />
            </div>
            <div>
              <Label>
                {t(
                  "Official evidence link (optional)",
                  "رابط دليل رسمي (اختياري)",
                )}
              </Label>
              <Input
                className="mt-1"
                inputMode="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="company.com/product"
              />
            </div>
            {kind === "product_photo_update" && (
              <div className="rounded-xl border border-dashed p-4">
                <Label>
                  {t("Updated product photo", "صورة المنتج المحدثة")}
                </Label>
                <Input
                  className="mt-2"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) =>
                    setPhoto(event.target.files?.[0] || null)
                  }
                  required
                />
              </div>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={busy || details.trim().length < 10}>
              {busy
                ? t("Submitting…", "جارٍ الإرسال…")
                : t("Submit for approval", "إرسال للموافقة")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}
