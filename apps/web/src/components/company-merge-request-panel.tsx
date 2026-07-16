import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Building2,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ShieldCheck,
  X,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchSeoEntityDirectory,
  type SeoEntity,
} from "@/lib/seo-entities";
import { usePatientAuth } from "@/lib/patient-auth";

type Profile = { company_slug: string; display_name: string };
type RequestRow = {
  id: string;
  source_company_slug: string;
  target_company_slug: string;
  requested_classification: string;
  status: string;
  review_notes: string | null;
  created_at: string;
};

const humanize = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

const normalizeComparable = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();

export function CompanyMergeRequestPanel() {
  const { session, supabaseFetch } = usePatientAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [companies, setCompanies] = useState<SeoEntity[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState<SeoEntity | null>(null);
  const [classification, setClassification] = useState("same_legal_entity");
  const [justification, setJustification] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!session?.user?.id) return;
    const [profileRows, requestRows, directory] = await Promise.all([
      supabaseFetch<Profile[]>(
        "/rest/v1/industry_company_profiles?select=company_slug,display_name&verification_status=eq.verified&order=display_name",
      ),
      supabaseFetch<RequestRow[]>(
        "/rest/v1/company_merge_requests?select=id,source_company_slug,target_company_slug,requested_classification,status,review_notes,created_at&order=created_at.desc&limit=50",
      ),
      fetchSeoEntityDirectory(),
    ]);
    setProfiles(Array.isArray(profileRows) ? profileRows : []);
    setRequests(Array.isArray(requestRows) ? requestRows : []);
    setCompanies(
      directory.entities
        .filter((entity) => entity.type === "company")
        .sort((left, right) => left.name.localeCompare(right.name)),
    );
  }

  useEffect(() => {
    void load().catch((cause) => {
      setError(cause instanceof Error ? cause.message : "Could not load company choices.");
    });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!source && profiles[0]) setSource(profiles[0].company_slug);
  }, [profiles, source]);

  const results = useMemo(() => {
    const normalizedQuery = normalizeComparable(query);
    return companies
      .filter((company) => company.slug !== source)
      .map((company) => {
        const searchableValues = [
          company.name,
          company.sourceValue || "",
          company.slug,
          ...(company.aliases || []),
          ...(company.aliasSlugs || []),
        ].map(normalizeComparable);
        let score = 0;
        if (!normalizedQuery) score = 1;
        else if (searchableValues.some((value) => value === normalizedQuery)) score = 100;
        else if (searchableValues.some((value) => value.startsWith(normalizedQuery))) score = 80;
        else if (searchableValues.some((value) => value.includes(normalizedQuery))) score = 60;
        return { company, score };
      })
      .filter(({ score }) => score > 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.company.records - left.company.records ||
          left.company.name.localeCompare(right.company.name),
      )
      .slice(0, 60)
      .map(({ company }) => company);
  }, [companies, query, source]);

  const ready = useMemo(
    () => Boolean(source && target && justification.trim().length >= 20),
    [source, target, justification],
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || !target) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/submit_company_merge_request", {
        method: "POST",
        body: JSON.stringify({
          p_source_slug: source,
          p_target_slug: target.slug,
          p_classification: classification,
          p_justification: justification.trim(),
          p_evidence_urls: evidence
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      setMessage(
        "Merge request submitted. Platform governance will review it before any directory consolidation.",
      );
      setTarget(null);
      setQuery("");
      setJustification("");
      setEvidence("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit merge request.");
    } finally {
      setBusy(false);
    }
  }

  if (!session?.user?.id || profiles.length === 0) return null;

  return (
    <section className="mt-10">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Request a company profile merge
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Use this when two directory identities represent the same company, a legacy name,
            or an approved group consolidation. Nothing is merged until platform governance
            approves it.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="merge-source-company">Your verified company</Label>
                <select
                  id="merge-source-company"
                  className="mt-1 min-h-11 w-full rounded-md border bg-background px-3"
                  value={source}
                  onChange={(event) => {
                    setSource(event.target.value);
                    setTarget(null);
                    setQuery("");
                  }}
                >
                  {profiles.map((profile) => (
                    <option key={profile.company_slug} value={profile.company_slug}>
                      {profile.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="merge-relationship">Relationship</Label>
                <select
                  id="merge-relationship"
                  className="mt-1 min-h-11 w-full rounded-md border bg-background px-3"
                  value={classification}
                  onChange={(event) => setClassification(event.target.value)}
                >
                  <option value="duplicate">Duplicate profile</option>
                  <option value="same_legal_entity">Same legal entity</option>
                  <option value="legacy_alias">Legacy or former name</option>
                  <option value="administrative_consolidation">
                    Administrative/group consolidation
                  </option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Company to merge with</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="mt-1 min-h-14 w-full justify-between px-4 text-left font-normal"
                  >
                    <span className="min-w-0 truncate">
                      {target?.name || "Search and select a company"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(94vw,780px)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={query}
                      onValueChange={setQuery}
                      placeholder="Search by company name, alias, or identifier…"
                    />
                    <CommandList className="max-h-[55vh]">
                      <CommandEmpty>No matching company found.</CommandEmpty>
                      <CommandGroup heading="Companies in the medicines database">
                        {results.map((company) => (
                          <CommandItem
                            key={company.slug}
                            value={company.slug}
                            onSelect={() => {
                              setTarget(company);
                              setQuery("");
                              setError(null);
                              setPickerOpen(false);
                            }}
                          >
                            <Building2 className="mr-3 h-5 w-5 text-muted-foreground" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{company.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {company.records.toLocaleString()} medicine records
                                {company.country ? ` · ${company.country}` : ""}
                                {company.official ? " · verified profile" : ""}
                              </span>
                            </span>
                            {target?.slug === company.slug && <Check className="h-4 w-4" />}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {target && (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-primary bg-primary/5 p-3">
                  <div className="min-w-0">
                    <strong className="block truncate">{target.name}</strong>
                    <span className="text-xs text-muted-foreground">
                      {target.slug} · {target.records.toLocaleString()} medicine records
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Clear ${target.name}`}
                    onClick={() => setTarget(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="merge-justification">Why should these profiles be merged?</Label>
              <Textarea
                id="merge-justification"
                className="mt-1 min-h-28"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                minLength={20}
                placeholder="Explain the legal or operational relationship and which identity should remain canonical."
                required
              />
            </div>
            <div>
              <Label htmlFor="merge-evidence">Evidence URLs (optional, one per line)</Label>
              <Textarea
                id="merge-evidence"
                className="mt-1 min-h-20"
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                placeholder="Official website, registry, announcement, or other evidence"
              />
            </div>
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                A request is evidence, not authority. Administrators, delegated reviewers, or an
                explicitly activated governance rule make the decision. All decisions remain
                audited and reversible.
              </AlertDescription>
            </Alert>
            <Button type="submit" disabled={!ready || busy}>
              {busy ? "Submitting…" : "Submit merge request"}
            </Button>
          </form>

          {requests.length > 0 && (
            <div>
              <h3 className="font-semibold">Your recent requests</h3>
              <div className="mt-3 space-y-2">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <div className="font-medium">
                        {request.source_company_slug} → {request.target_company_slug}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(request.created_at).toLocaleDateString()} ·{" "}
                        {humanize(request.requested_classification)}
                      </div>
                      {request.review_notes && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {request.review_notes}
                        </p>
                      )}
                    </div>
                    <Badge>{humanize(request.status)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
