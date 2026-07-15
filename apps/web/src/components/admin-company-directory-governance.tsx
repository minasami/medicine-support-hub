import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Building2, Check, EyeOff, GitMerge, ListChecks, PencilLine, RefreshCw, RotateCcw, Search, ShieldAlert, Split } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePatientAuth } from "@/lib/patient-auth";

export type DirectoryEntry = {
  company_slug: string;
  display_name: string;
  dataset_name: string | null;
  source_name: string | null;
  product_count: number;
  official_profile_id: string | null;
  organization_id: string | null;
  verification_status: string | null;
  is_public: boolean | null;
  company_type: string | null;
  website_url: string | null;
  country: string | null;
  city: string | null;
  full_address: string | null;
  contact_email: string | null;
  mobile_phone: string | null;
  whatsapp_same_as_mobile: boolean;
  whatsapp_phone: string | null;
  canonical_company_slug: string;
  is_alias: boolean;
  is_hidden: boolean;
};

type DuplicateCandidate = {
  left_slug: string;
  left_name: string;
  left_products: number;
  left_official: boolean;
  right_slug: string;
  right_name: string;
  right_products: number;
  right_official: boolean;
  match_reason: string;
  score: number;
};

type ReviewedPair = {
  left_slug: string;
  left_name: string;
  right_slug: string;
  right_name: string;
  decision: "not_duplicate" | "related_distinct";
  notes: string | null;
  reviewed_at: string;
};

type EditDraft = {
  company_slug: string;
  display_name: string;
  company_type: string;
  description: string;
  website_url: string;
  logo_url: string;
  country: string;
  city: string;
  full_address: string;
  contact_email: string;
  mobile_phone: string;
  whatsapp_same_as_mobile: boolean;
  whatsapp_phone: string;
  is_hidden: boolean;
};

const emptyEdit: EditDraft = {
  company_slug: "",
  display_name: "",
  company_type: "pharma_company",
  description: "",
  website_url: "",
  logo_url: "",
  country: "",
  city: "",
  full_address: "",
  contact_email: "",
  mobile_phone: "",
  whatsapp_same_as_mobile: true,
  whatsapp_phone: "",
  is_hidden: false,
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

function humanize(value: string | null | undefined) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function draftFromEntry(entry: DirectoryEntry): EditDraft {
  return {
    ...emptyEdit,
    company_slug: entry.canonical_company_slug || entry.company_slug,
    display_name: entry.display_name || "",
    company_type: entry.company_type || "pharma_company",
    website_url: entry.website_url || "",
    country: entry.country || "",
    city: entry.city || "",
    full_address: entry.full_address || "",
    contact_email: entry.contact_email || "",
    mobile_phone: entry.mobile_phone || "",
    whatsapp_same_as_mobile: entry.whatsapp_same_as_mobile !== false,
    whatsapp_phone: entry.whatsapp_phone || "",
    is_hidden: entry.is_hidden,
  };
}

export function AdminCompanyDirectoryGovernance() {
  const { supabaseFetch } = usePatientAuth();
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [reviewedPairs, setReviewedPairs] = useState<ReviewedPair[]>([]);
  const [reviewSearch, setReviewSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DirectoryEntry[]>([]);
  const [source, setSource] = useState<DirectoryEntry | null>(null);
  const [target, setTarget] = useState<DirectoryEntry | null>(null);
  const [editEntry, setEditEntry] = useState<DirectoryEntry | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(emptyEdit);
  const [classification, setClassification] = useState("duplicate");
  const [reason, setReason] = useState("");
  const [bulkEntries, setBulkEntries] = useState<Record<string, DirectoryEntry>>({});
  const [bulkTargetSlug, setBulkTargetSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCandidates() {
    setLoading(true);
    setError(null);
    try {
      const rows = await supabaseFetch<DuplicateCandidate[]>("/rest/v1/rpc/list_company_duplicate_candidates", { method: "POST", body: JSON.stringify({ p_limit: 100 }) });
      setCandidates(Array.isArray(rows) ? rows : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load duplicate suggestions.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReviewedPairs(query = reviewSearch) {
    try {
      const rows = await supabaseFetch<ReviewedPair[]>("/rest/v1/rpc/list_company_pair_reviews", {
        method: "POST",
        body: JSON.stringify({ p_query: query.trim() || null, p_limit: 100 }),
      });
      setReviewedPairs(Array.isArray(rows) ? rows : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load reviewed company pairs.");
    }
  }

  useEffect(() => {
    void loadCandidates();
    void loadReviewedPairs("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadReviewedPairs(reviewSearch), 300);
    return () => window.clearTimeout(timer);
  }, [reviewSearch]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const rows = await supabaseFetch<DirectoryEntry[]>("/rest/v1/rpc/search_company_directory_admin", {
          method: "POST",
          body: JSON.stringify({ p_query: query, p_limit: 40 }),
        });
        setSearchResults(Array.isArray(rows) ? rows : []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Company search failed.");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery, supabaseFetch]);

  const selectedSlugs = useMemo(() => new Set([source?.company_slug, target?.company_slug].filter(Boolean)), [source, target]);

  function selectEntry(entry: DirectoryEntry) {
    if (!source) setSource(entry);
    else if (!target && entry.company_slug !== source.company_slug) setTarget(entry);
    else {
      setEditEntry(entry);
      setEditDraft(draftFromEntry(entry));
    }
  }

  function toggleBulkEntry(entry: DirectoryEntry) {
    setBulkEntries((current) => {
      const next = { ...current };
      if (next[entry.company_slug]) {
        delete next[entry.company_slug];
        if (bulkTargetSlug === entry.company_slug) setBulkTargetSlug("");
      } else {
        next[entry.company_slug] = entry;
      }
      return next;
    });
  }

  async function merge(sourceEntry: DirectoryEntry, targetEntry: DirectoryEntry) {
    if (sourceEntry.company_slug === targetEntry.company_slug) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/admin_merge_company_profiles", {
        method: "POST",
        body: JSON.stringify({
          p_source_slug: sourceEntry.company_slug,
          p_target_slug: targetEntry.company_slug,
          p_classification: classification,
          p_reason: "Platform administrator merge",
        }),
      });
      setMessage(`${sourceEntry.display_name} now resolves to ${targetEntry.display_name}. The merge is reversible.`);
      setSource(null);
      setTarget(null);
      setSearchQuery("");
      setSearchResults([]);
      await loadCandidates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not merge these company identities.");
    } finally {
      setSaving(false);
    }
  }

  async function markDistinct(candidate: DuplicateCandidate, decision: "not_duplicate" | "related_distinct") {
    if (!window.confirm(decision === "not_duplicate" ? "Mark these companies as distinct? You can reopen this decision later." : "Record these companies as related but separate? You can reopen this decision later.")) return;
    setSaving(true);
    setError(null);
    try {
      await supabaseFetch("/rest/v1/rpc/admin_review_company_pair", {
        method: "POST",
        body: JSON.stringify({
          p_left_slug: candidate.left_slug,
          p_right_slug: candidate.right_slug,
          p_decision: decision,
          p_notes: reason.trim() || null,
        }),
      });
      setMessage(decision === "not_duplicate" ? "The pair was marked as distinct." : "The pair was recorded as related but distinct.");
      setReason("");
      await Promise.all([loadCandidates(), loadReviewedPairs()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the pair review.");
    } finally {
      setSaving(false);
    }
  }

  async function unmerge(entry: DirectoryEntry) {
    setSaving(true);
    setError(null);
    try {
      await supabaseFetch("/rest/v1/rpc/admin_unmerge_company_profile", {
        method: "POST",
        body: JSON.stringify({ p_source_slug: entry.company_slug, p_reason: reason.trim() || "Administrative reversal" }),
      });
      setMessage(`${entry.display_name} was restored as a separate directory identity.`);
      setReason("");
      setSearchQuery("");
      setSearchResults([]);
      await loadCandidates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reverse this merge.");
    } finally {
      setSaving(false);
    }
  }

  async function undoPairReview(pair: ReviewedPair) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/admin_undo_company_pair_review", {
        method: "POST",
        body: JSON.stringify({ p_left_slug: pair.left_slug, p_right_slug: pair.right_slug, p_reason: reason.trim() || "Accidental decision reopened by platform administrator" }),
      });
      setSource(asEntry(pair.left_slug, pair.left_name, 0));
      setTarget(asEntry(pair.right_slug, pair.right_name, 0));
      setMessage("The distinct decision was undone. The pair is selected below and can now be merged.");
      await Promise.all([loadCandidates(), loadReviewedPairs()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reopen this company-pair review.");
    } finally {
      setSaving(false);
    }
  }

  async function bulkMerge() {
    const entries = Object.values(bulkEntries);
    const targetEntry = bulkEntries[bulkTargetSlug];
    const sourceSlugs = entries.map((entry) => entry.company_slug).filter((slug) => slug !== bulkTargetSlug);
    if (!targetEntry || sourceSlugs.length === 0) {
      setError("Select at least two companies and choose the canonical company to keep.");
      return;
    }
    if (!window.confirm(`Merge ${sourceSlugs.length} selected ${sourceSlugs.length === 1 ? "company" : "companies"} into ${targetEntry.display_name}? Every merge remains reversible.`)) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await supabaseFetch("/rest/v1/rpc/admin_bulk_merge_company_profiles", {
        method: "POST",
        body: JSON.stringify({
          p_source_slugs: sourceSlugs,
          p_target_slug: bulkTargetSlug,
          p_classification: classification,
        }),
      });
      setMessage(`${sourceSlugs.length} ${sourceSlugs.length === 1 ? "company was" : "companies were"} merged into ${targetEntry.display_name}. The operation is reversible.`);
      setBulkEntries({});
      setBulkTargetSlug("");
      setSearchQuery("");
      setSearchResults([]);
      await loadCandidates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the bulk merge.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editDraft.company_slug || !editDraft.display_name.trim()) return;
    if (!editDraft.whatsapp_same_as_mobile && !editDraft.whatsapp_phone.trim()) {
      setError("Enter the WhatsApp number or mark it as the same as the mobile number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await supabaseFetch("/rest/v1/rpc/admin_upsert_company_directory_override", {
        method: "POST",
        body: JSON.stringify({
          p_company_slug: editDraft.company_slug,
          p_display_name: editDraft.display_name.trim(),
          p_company_type: editDraft.company_type,
          p_description: editDraft.description.trim() || null,
          p_website_url: normalizeUrl(editDraft.website_url),
          p_logo_url: normalizeUrl(editDraft.logo_url),
          p_country: editDraft.country.trim() || null,
          p_city: editDraft.city.trim() || null,
          p_full_address: editDraft.full_address.trim() || null,
          p_contact_email: editDraft.contact_email.trim() || null,
          p_mobile_phone: editDraft.mobile_phone.trim() || null,
          p_whatsapp_same_as_mobile: editDraft.whatsapp_same_as_mobile,
          p_whatsapp_phone: editDraft.whatsapp_same_as_mobile ? null : editDraft.whatsapp_phone.trim() || null,
          p_is_hidden: editDraft.is_hidden,
        }),
      });
      setMessage(`${editDraft.display_name} was updated in the governed directory.`);
      setEditEntry(null);
      setEditDraft(emptyEdit);
      setSearchQuery("");
      setSearchResults([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this company profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="company-directory-integrity" className="mt-10 scroll-mt-28 space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <ArrowRightLeft className="h-4 w-4" /> Company identity governance
            </p>
            <h2 className="mt-2 text-3xl font-bold">Company directory integrity</h2>
            <p className="mt-2 max-w-4xl text-muted-foreground">
              Review suggested duplicates, compare any two companies manually, merge them into a canonical identity, mark them as distinct, reverse a merge, or edit governed profile data. Merges preserve source records and audit history.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadCandidates()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh suggestions
          </Button>
        </div>
      </div>

      {error && <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><Check className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

      <div className="sticky top-20 z-30 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85 md:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search companies by name or identifier" />
          </div>
          <p className="text-xs text-muted-foreground md:max-w-xs">Open a company profile, select it for comparison, or add it to a bulk merge without losing your place.</p>
        </div>
        {searchQuery.trim().length >= 2 && <div className="mt-2 max-h-[min(50vh,24rem)] overflow-y-auto rounded-xl border bg-background shadow-xl">
          {searchResults.map((entry) => <div key={entry.company_slug} className={`flex items-center gap-3 border-b p-3 last:border-b-0 hover:bg-muted ${selectedSlugs.has(entry.company_slug) ? "bg-primary/10" : ""}`}>
            <input aria-label={`Select ${entry.display_name} for bulk merge`} type="checkbox" className="h-4 w-4 shrink-0" checked={Boolean(bulkEntries[entry.company_slug])} onChange={() => toggleBulkEntry(entry)} />
            <a href={`/companies/${encodeURIComponent(entry.canonical_company_slug || entry.company_slug)}`} className="min-w-0 flex-1 text-left hover:text-primary hover:underline"><span className="block truncate font-semibold">{entry.display_name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{entry.company_slug} · {entry.product_count.toLocaleString()} medicines{entry.official_profile_id ? " · official" : ""}</span></a>
            <Button size="sm" variant="outline" onClick={() => selectEntry(entry)}>Compare</Button>
          </div>)}
          {searchResults.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching company records.</p>}
        </div>}
      </div>

      <Card className="border-primary/25">
        <CardHeader><CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" />Bulk company merge</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Select companies from suggestions or search results, then choose the one canonical profile to keep. All selected sources are merged in one transaction and remain individually reversible.</p>
          {Object.values(bulkEntries).length > 0 ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Object.values(bulkEntries).map((entry) => <label key={entry.company_slug} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${bulkTargetSlug === entry.company_slug ? "border-primary bg-primary/5" : ""}`}>
              <input type="radio" name="bulk-canonical-company" className="mt-1" checked={bulkTargetSlug === entry.company_slug} onChange={() => setBulkTargetSlug(entry.company_slug)} />
              <span className="min-w-0"><a href={`/companies/${encodeURIComponent(entry.canonical_company_slug || entry.company_slug)}`} className="block truncate font-semibold hover:text-primary hover:underline" onClick={(event) => event.stopPropagation()}>{entry.display_name}</a><span className="block truncate text-xs text-muted-foreground">{entry.company_slug}</span><span className="mt-1 block text-xs font-medium text-primary">{bulkTargetSlug === entry.company_slug ? "Canonical company to keep" : "Choose as canonical"}</span></span>
              <button type="button" className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={(event) => { event.preventDefault(); toggleBulkEntry(entry); }}>Remove</button>
            </label>)}
          </div> : <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No companies selected yet. Use the checkboxes below or in company search.</div>}
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={saving || Object.keys(bulkEntries).length < 2 || !bulkTargetSlug} onClick={() => void bulkMerge()}><GitMerge className="mr-2 h-4 w-4" />Merge {Math.max(0, Object.keys(bulkEntries).length - 1)} into canonical company</Button>
            {Object.keys(bulkEntries).length > 0 && <Button variant="outline" onClick={() => { setBulkEntries({}); setBulkTargetSlug(""); }}>Clear selection</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Suggested duplicate reviews</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {candidates.map((candidate) => {
            const candidateKey = `${candidate.left_slug}:${candidate.right_slug}`;
            const leftEntry = asEntry(candidate.left_slug, candidate.left_name, candidate.left_products);
            const rightEntry = asEntry(candidate.right_slug, candidate.right_name, candidate.right_products);
            return (
            <div key={candidateKey} className="rounded-xl border p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <div className="flex items-start gap-3"><input aria-label={`Select ${candidate.left_name} for bulk merge`} type="checkbox" className="mt-4 h-4 w-4" checked={Boolean(bulkEntries[candidate.left_slug])} onChange={() => toggleBulkEntry(leftEntry)} /><div className="min-w-0 flex-1"><CandidateSide name={candidate.left_name} slug={candidate.left_slug} products={candidate.left_products} official={candidate.left_official} /></div></div>
                <div className="flex justify-center"><GitMerge className="h-5 w-5 text-muted-foreground" /></div>
                <div className="flex items-start gap-3"><input aria-label={`Select ${candidate.right_name} for bulk merge`} type="checkbox" className="mt-4 h-4 w-4" checked={Boolean(bulkEntries[candidate.right_slug])} onChange={() => toggleBulkEntry(rightEntry)} /><div className="min-w-0 flex-1"><CandidateSide name={candidate.right_name} slug={candidate.right_slug} products={candidate.right_products} official={candidate.right_official} /></div></div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{candidate.match_reason}</Badge>
                <Badge variant="secondary">Score {candidate.score}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={saving} onClick={() => void merge(leftEntry, rightEntry)}>Merge left into right</Button>
                <Button size="sm" variant="secondary" disabled={saving} onClick={() => void merge(rightEntry, leftEntry)}>Merge right into left</Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void markDistinct(candidate, "not_duplicate")}><Split className="mr-2 h-3.5 w-3.5" />Mark distinct</Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => void markDistinct(candidate, "related_distinct")}>Related but separate</Button>
              </div>
            </div>
            );
          })}
          {!loading && candidates.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No unreviewed exact-name duplicate suggestions remain.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" />Reviewed distinct decisions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Search decisions that removed a pair from duplicate suggestions. Undoing a decision returns the pair to review and selects both companies for merging.</p>
          <div className="relative max-w-2xl"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={reviewSearch} onChange={(event) => setReviewSearch(event.target.value)} placeholder="Search reviewed company names or slugs" /></div>
          <div className="space-y-3">
            {reviewedPairs.map((pair) => <div key={`${pair.left_slug}:${pair.right_slug}`} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"><div><div className="font-semibold"><a href={`/companies/${encodeURIComponent(pair.left_slug)}`} className="hover:text-primary hover:underline">{pair.left_name}</a> <span className="text-muted-foreground">↔</span> <a href={`/companies/${encodeURIComponent(pair.right_slug)}`} className="hover:text-primary hover:underline">{pair.right_name}</a></div><div className="mt-1 text-xs text-muted-foreground">{pair.left_slug} · {pair.right_slug}</div><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{humanize(pair.decision)}</Badge>{pair.notes && <span className="text-sm text-muted-foreground">{pair.notes}</span>}</div></div><Button variant="outline" disabled={saving} onClick={() => void undoPairReview(pair)}><RotateCcw className="mr-2 h-4 w-4" />Undo and reconsider</Button></div>)}
            {reviewedPairs.length === 0 && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No reviewed distinct decisions match this search.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Compare, merge, or edit selected companies</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">Use the floating search above to select the source and canonical company. Differently named companies can be consolidated using “Administrative consolidation”; use “Related but separate” when a group relationship should not erase distinct public identities.</p>
            {source && <SelectedEntry label="Source" entry={source} />}
            {target && <SelectedEntry label="Canonical target" entry={target} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Merge classification</Label><select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={classification} onChange={(event) => setClassification(event.target.value)}><option value="duplicate">Duplicate</option><option value="same_legal_entity">Same legal entity</option><option value="legacy_alias">Legacy alias</option><option value="administrative_consolidation">Administrative consolidation</option><option value="other">Other</option></select></div>
              <div><Label>Optional review note</Label><Input className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Used for distinct decisions or reversals; not required to merge" /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!source || !target || saving} onClick={() => source && target && void merge(source, target)}><GitMerge className="mr-2 h-4 w-4" />Merge into canonical target</Button>
              <Button variant="outline" onClick={() => { setSource(null); setTarget(null); }}>Clear comparison</Button>
              {source?.is_alias && <Button variant="outline" disabled={saving} onClick={() => void unmerge(source)}><RotateCcw className="mr-2 h-4 w-4" />Reverse source merge</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PencilLine className="h-5 w-5" />Edit governed company data</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!editEntry ? <div className="rounded-xl border border-dashed p-8 text-center"><Building2 className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Search above, then click a third result—or use the Edit button on a selected record—to open the profile editor.</p>{source && <Button className="mt-4" variant="outline" onClick={() => { setEditEntry(source); setEditDraft(draftFromEntry(source)); }}>Edit source record</Button>}{target && <Button className="ml-2 mt-4" variant="outline" onClick={() => { setEditEntry(target); setEditDraft(draftFromEntry(target)); }}>Edit target record</Button>}</div> : <>
              <div className="rounded-xl bg-muted/40 p-3 text-sm"><strong>{editDraft.company_slug}</strong>{editEntry.is_alias && <span className="ml-2 text-muted-foreground">resolves to {editEntry.canonical_company_slug}</span>}</div>
              <div className="grid gap-4 md:grid-cols-2"><EditField label="Display name" value={editDraft.display_name} onChange={(display_name) => setEditDraft({ ...editDraft, display_name })} /><div><Label>Company type</Label><select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={editDraft.company_type} onChange={(event) => setEditDraft({ ...editDraft, company_type: event.target.value })}>{companyTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></div></div>
              <div><Label>Description</Label><Textarea className="mt-1 min-h-24" value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} /></div>
              <div className="grid gap-4 md:grid-cols-2"><EditField label="Website" value={editDraft.website_url} onChange={(website_url) => setEditDraft({ ...editDraft, website_url })} placeholder="company.com" /><EditField label="Logo URL" value={editDraft.logo_url} onChange={(logo_url) => setEditDraft({ ...editDraft, logo_url })} /></div>
              <div className="grid gap-4 md:grid-cols-2"><EditField label="Country" value={editDraft.country} onChange={(country) => setEditDraft({ ...editDraft, country })} /><EditField label="City" value={editDraft.city} onChange={(city) => setEditDraft({ ...editDraft, city })} /></div>
              <div><Label>Full address</Label><Textarea className="mt-1 min-h-20" value={editDraft.full_address} onChange={(event) => setEditDraft({ ...editDraft, full_address: event.target.value })} /></div>
              <div className="grid gap-4 md:grid-cols-2"><EditField label="Contact email" type="email" value={editDraft.contact_email} onChange={(contact_email) => setEditDraft({ ...editDraft, contact_email })} /><EditField label="Mobile phone" type="tel" value={editDraft.mobile_phone} onChange={(mobile_phone) => setEditDraft({ ...editDraft, mobile_phone })} /></div>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={editDraft.whatsapp_same_as_mobile} onChange={(event) => setEditDraft({ ...editDraft, whatsapp_same_as_mobile: event.target.checked, whatsapp_phone: event.target.checked ? "" : editDraft.whatsapp_phone })} />The mobile number is also the WhatsApp number</label>
              {!editDraft.whatsapp_same_as_mobile && <EditField label="WhatsApp number" type="tel" value={editDraft.whatsapp_phone} onChange={(whatsapp_phone) => setEditDraft({ ...editDraft, whatsapp_phone })} />}
              <label className="flex min-h-11 items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={editDraft.is_hidden} onChange={(event) => setEditDraft({ ...editDraft, is_hidden: event.target.checked })} /><EyeOff className="h-4 w-4" />Hide this identity from the public directory</label>
              <div className="flex flex-wrap gap-2"><Button disabled={saving || !editDraft.display_name.trim()} onClick={() => void saveEdit()}><PencilLine className="mr-2 h-4 w-4" />Save governed data</Button><Button variant="outline" onClick={() => { setEditEntry(null); setEditDraft(emptyEdit); }}>Cancel</Button></div>
            </>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function asEntry(slug: string, name: string, products: number): DirectoryEntry {
  return { company_slug: slug, display_name: name, dataset_name: name, source_name: null, product_count: products, official_profile_id: null, organization_id: null, verification_status: null, is_public: null, company_type: null, website_url: null, country: null, city: null, full_address: null, contact_email: null, mobile_phone: null, whatsapp_same_as_mobile: true, whatsapp_phone: null, canonical_company_slug: slug, is_alias: false, is_hidden: false };
}

function CandidateSide({ name, slug, products, official }: { name: string; slug: string; products: number; official: boolean }) {
  return <div className="rounded-lg bg-muted/40 p-3"><div className="flex flex-wrap items-center gap-2"><a href={`/companies/${encodeURIComponent(slug)}`} className="font-bold hover:text-primary hover:underline">{name}</a>{official && <Badge>Official</Badge>}</div><div className="mt-1 text-xs text-muted-foreground">{slug} · {products.toLocaleString()} medicines</div></div>;
}

function SelectedEntry({ label, entry }: { label: string; entry: DirectoryEntry }) {
  return <div className="rounded-xl border p-3"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><a href={`/companies/${encodeURIComponent(entry.canonical_company_slug || entry.company_slug)}`} className="mt-1 block font-semibold hover:text-primary hover:underline">{entry.display_name}</a><div className="text-xs text-muted-foreground">{entry.company_slug} · {entry.product_count.toLocaleString()} medicines</div></div>;
}

function EditField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <div><Label>{label}</Label><Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}
