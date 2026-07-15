import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Building2, Check, EyeOff, GitMerge, PencilLine, RefreshCw, RotateCcw, Search, ShieldAlert, Split } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DirectoryEntry[]>([]);
  const [source, setSource] = useState<DirectoryEntry | null>(null);
  const [target, setTarget] = useState<DirectoryEntry | null>(null);
  const [editEntry, setEditEntry] = useState<DirectoryEntry | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(emptyEdit);
  const [classification, setClassification] = useState("duplicate");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCandidates() {
    setLoading(true);
    setError(null);
    try {
      const rows = await supabaseFetch<DuplicateCandidate[]>("/rest/v1/rpc/list_company_duplicate_candidates", {
        method: "POST",
        body: JSON.stringify({ p_limit: 100 }),
      });
      setCandidates(Array.isArray(rows) ? rows : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load duplicate suggestions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCandidates();
  }, []);

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

  async function merge(sourceEntry: DirectoryEntry, targetEntry: DirectoryEntry) {
    if (sourceEntry.company_slug === targetEntry.company_slug) return;
    if (reason.trim().length < 3) {
      setError("Document why these records should be consolidated before merging.");
      return;
    }
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
          p_reason: reason.trim(),
        }),
      });
      setMessage(`${sourceEntry.display_name} now resolves to ${targetEntry.display_name}. The merge is reversible.`);
      setSource(null);
      setTarget(null);
      setReason("");
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
      await loadCandidates();
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

      <Card>
        <CardHeader><CardTitle>Suggested duplicate reviews</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {candidates.map((candidate) => (
            <div key={`${candidate.left_slug}:${candidate.right_slug}`} className="rounded-xl border p-4">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                <CandidateSide name={candidate.left_name} slug={candidate.left_slug} products={candidate.left_products} official={candidate.left_official} />
                <div className="flex justify-center"><GitMerge className="h-5 w-5 text-muted-foreground" /></div>
                <CandidateSide name={candidate.right_name} slug={candidate.right_slug} products={candidate.right_products} official={candidate.right_official} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{candidate.match_reason}</Badge>
                <Badge variant="secondary">Score {candidate.score}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={saving || reason.trim().length < 3} onClick={() => void merge(asEntry(candidate.left_slug, candidate.left_name, candidate.left_products), asEntry(candidate.right_slug, candidate.right_name, candidate.right_products))}>Merge left into right</Button>
                <Button size="sm" variant="secondary" disabled={saving || reason.trim().length < 3} onClick={() => void merge(asEntry(candidate.right_slug, candidate.right_name, candidate.right_products), asEntry(candidate.left_slug, candidate.left_name, candidate.left_products))}>Merge right into left</Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={() => void markDistinct(candidate, "not_duplicate")}><Split className="mr-2 h-3.5 w-3.5" />Mark distinct</Button>
                <Button size="sm" variant="ghost" disabled={saving} onClick={() => void markDistinct(candidate, "related_distinct")}>Related but separate</Button>
              </div>
            </div>
          ))}
          {!loading && candidates.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No unreviewed exact-name duplicate suggestions remain.</p>}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Search, compare, merge, or edit</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search company name or slug" />
            </div>
            <div className="max-h-80 overflow-y-auto rounded-xl border">
              {searchResults.map((entry) => (
                <button key={entry.company_slug} type="button" onClick={() => selectEntry(entry)} className={`flex w-full items-start justify-between gap-3 border-b p-3 text-left last:border-b-0 hover:bg-muted ${selectedSlugs.has(entry.company_slug) ? "bg-primary/10" : ""}`}>
                  <span><span className="font-semibold">{entry.display_name}</span><span className="mt-1 block text-xs text-muted-foreground">{entry.company_slug} · {entry.product_count.toLocaleString()} medicines{entry.official_profile_id ? " · official" : ""}</span></span>
                  {entry.is_alias ? <Badge variant="outline">→ {entry.canonical_company_slug}</Badge> : <Badge variant="secondary">Select</Badge>}
                </button>
              ))}
              {searchQuery.trim().length >= 2 && searchResults.length === 0 && <p className="p-4 text-sm text-muted-foreground">No matching company records.</p>}
            </div>
            <p className="text-xs text-muted-foreground">First click chooses the merge source, second click chooses the canonical target. Clicking another result opens it for editing.</p>
            {source && <SelectedEntry label="Source" entry={source} />}
            {target && <SelectedEntry label="Canonical target" entry={target} />}
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Merge classification</Label><select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={classification} onChange={(event) => setClassification(event.target.value)}><option value="duplicate">Duplicate</option><option value="same_legal_entity">Same legal entity</option><option value="legacy_alias">Legacy alias</option><option value="administrative_consolidation">Administrative consolidation</option><option value="other">Other</option></select></div>
              <div><Label>Review note or reason</Label><Input className="mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for merge; optional for distinct review" /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!source || !target || saving || reason.trim().length < 3} onClick={() => source && target && void merge(source, target)}><GitMerge className="mr-2 h-4 w-4" />Merge into canonical target</Button>
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
  return <div className="rounded-lg bg-muted/40 p-3"><div className="flex flex-wrap items-center gap-2"><strong>{name}</strong>{official && <Badge>Official</Badge>}</div><div className="mt-1 text-xs text-muted-foreground">{slug} · {products.toLocaleString()} medicines</div></div>;
}

function SelectedEntry({ label, entry }: { label: string; entry: DirectoryEntry }) {
  return <div className="rounded-xl border p-3"><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{entry.display_name}</div><div className="text-xs text-muted-foreground">{entry.company_slug} · {entry.product_count.toLocaleString()} medicines</div></div>;
}

function EditField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <div><Label>{label}</Label><Input className="mt-1" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></div>;
}
