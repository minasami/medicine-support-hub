import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, PlusCircle, RefreshCw, Store } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv } from "@/lib/csv-export";
import { usePatientAuth } from "@/lib/patient-auth";

type Branch = { id: string; branch_name: string; city: string | null; currency: string; owner_user_id: string };
type Entry = { id: string; entry_date: string; entry_type: "sale" | "expense"; category: string; amount: string | number; created_at: string };
type Summary = { total_sales: string | number; total_expenses: string | number; net_profit: string | number };

function normalize(value: string | null | undefined) { return (value ?? "").trim().toLowerCase(); }

export default function PharmacyFinance() {
  const { isAuthenticated, session, supabaseFetch } = usePatientAuth();
  const userId = session?.user?.id;
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [branchName, setBranchName] = useState("");
  const [city, setCity] = useState("");
  const [kind, setKind] = useState<"sale" | "expense">("sale");
  const [category, setCategory] = useState("Daily sales");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() { setLoading(true); setError(null); try { if (!isAuthenticated || !userId) throw new Error("Sign in first."); const rows = await supabaseFetch<Branch[]>("/rest/v1/pharmacy_branches?select=id,branch_name,city,currency,owner_user_id&is_active=eq.true&order=created_at.asc"); setBranches(rows); const active = branchId || rows[0]?.id || ""; setBranchId(active); if (!active) { setEntries([]); setSummary(null); return; } const [entryRows, summaryRows] = await Promise.all([supabaseFetch<Entry[]>(`/rest/v1/pharmacy_finance_entries?select=id,entry_date,entry_type,category,amount,created_at&branch_id=eq.${active}&entry_date=gte.${fromDate}&entry_date=lte.${toDate}&order=entry_date.desc,created_at.desc&limit=200`), supabaseFetch<Summary[]>(`/rest/v1/pharmacy_branch_finance_summary?select=total_sales,total_expenses,net_profit&branch_id=eq.${active}&limit=1`)]); setEntries(entryRows); setSummary(summaryRows[0] ?? null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load finance workspace."); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [isAuthenticated, userId, branchId]);

  async function createBranch() { if (!userId || !branchName.trim()) return; setSaving(true); setError(null); setMessage(null); try { const name = branchName.trim(); const cityValue = city.trim(); const existing = branches.find((branch) => normalize(branch.branch_name) === normalize(name) && normalize(branch.city) === normalize(cityValue)); if (existing) { setBranchId(existing.id); setMessage("Branch already exists. I selected it instead of creating a duplicate."); return; } const created = await supabaseFetch<Branch[]>("/rest/v1/pharmacy_branches?select=id,branch_name,city,currency,owner_user_id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_user_id: userId, branch_name: name, city: cityValue || null }) }); const branch = created[0]; await supabaseFetch("/rest/v1/pharmacy_branch_members", { method: "POST", body: JSON.stringify({ branch_id: branch.id, user_id: userId, member_role: "owner" }) }); setBranchName(""); setCity(""); setBranchId(branch.id); setMessage("Branch created."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create branch."); } finally { setSaving(false); } }
  async function addEntry() { if (!branchId || !amount) return; setSaving(true); setError(null); setMessage(null); try { await supabaseFetch("/rest/v1/pharmacy_finance_entries", { method: "POST", body: JSON.stringify({ branch_id: branchId, entry_type: kind, category, amount: Number(amount), entry_date: entryDate, created_by: userId }) }); setAmount(""); setMessage("Entry added. Profit recalculated."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not add entry."); } finally { setSaving(false); } }

  const totals = useMemo(() => ({ sales: Number(summary?.total_sales ?? 0), expenses: Number(summary?.total_expenses ?? 0), profit: Number(summary?.net_profit ?? 0) }), [summary]);
  const periodTotals = useMemo(() => entries.reduce((acc, entry) => { const entryAmount = Number(entry.amount); if (entry.entry_type === "sale") acc.sales += entryAmount; else acc.expenses += entryAmount; acc.profit = acc.sales - acc.expenses; return acc; }, { sales: 0, expenses: 0, profit: 0 }), [entries]);
  const activeBranch = branches.find(branch => branch.id === branchId);
  function exportEntries() { const generatedAt = new Date().toISOString(); downloadCsv(`pharmacy-finance-${activeBranch?.branch_name ?? "branch"}-${fromDate}-${toDate}.csv`, [{ key: "branch", header: "Branch" }, { key: "city", header: "City" }, { key: "from_date", header: "From date" }, { key: "to_date", header: "To date" }, { key: "generated_at", header: "Generated at" }, { key: "created_at", header: "System created at" }, { key: "entry_date", header: "Entry date" }, { key: "entry_type", header: "Type" }, { key: "category", header: "Category" }, { key: "amount", header: "Amount" }, { key: "period_sales", header: "Period sales" }, { key: "period_expenses", header: "Period expenses" }, { key: "period_profit", header: "Period profit" }], entries.map(entry => ({ branch: activeBranch?.branch_name ?? "", city: activeBranch?.city ?? "", from_date: fromDate, to_date: toDate, generated_at: generatedAt, created_at: entry.created_at, entry_date: entry.entry_date, entry_type: entry.entry_type, category: entry.category, amount: Number(entry.amount), period_sales: periodTotals.sales, period_expenses: periodTotals.expenses, period_profit: periodTotals.profit }))); }

  return <div className="container mx-auto max-w-5xl px-4 py-8">
    <div className="mb-6 flex items-start justify-between gap-3">
      <div><div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pharmacy finance</div><h1 className="mt-2 flex items-center gap-2 text-3xl font-bold"><Store className="h-7 w-7" />Branch profit tracker</h1><p className="text-muted-foreground">Create a branch, record sales and expenses, and calculate profit automatically.</p></div>
      <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert className="mb-4"><AlertDescription>{message}</AlertDescription></Alert>}
    <div className="grid gap-6 md:grid-cols-2">
      <Card><CardHeader><CardTitle>Create branch</CardTitle></CardHeader><CardContent className="space-y-3"><Label>Branch name</Label><Input value={branchName} onChange={event => setBranchName(event.target.value)} placeholder="Main branch" /><Label>City</Label><Input value={city} onChange={event => setCity(event.target.value)} placeholder="Luxor" /><Button onClick={() => void createBranch()} disabled={saving || !branchName.trim()}><PlusCircle className="mr-2 h-4 w-4" />Create branch</Button></CardContent></Card>
      <Card><CardHeader><CardTitle>Current branch</CardTitle></CardHeader><CardContent><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={branchId} onChange={event => setBranchId(event.target.value)}>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.branch_name}{branch.city ? ` - ${branch.city}` : ""}</option>)}</select>{!branches.length && <p className="mt-3 text-sm text-muted-foreground">No branches yet.</p>}</CardContent></Card>
    </div>
    <div className="my-6 grid gap-3 sm:grid-cols-3"><Metric label="All sales" value={totals.sales} /><Metric label="All expenses" value={totals.expenses} /><Metric label="All profit" value={totals.profit} /></div>
    <Card className="mb-6"><CardHeader><CardTitle>Report period</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]"><Input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} /><Input type="date" value={toDate} onChange={event => setToDate(event.target.value)} /><Button variant="outline" onClick={() => void load()}>Apply</Button><Button variant="outline" onClick={exportEntries} disabled={!entries.length}><Download className="mr-2 h-4 w-4" />Export CSV</Button></CardContent></Card>
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><Metric label="Period sales" value={periodTotals.sales} /><Metric label="Period expenses" value={periodTotals.expenses} /><Metric label="Period profit" value={periodTotals.profit} /></div>
    <Card className="mb-6"><CardHeader><CardTitle>Add entry</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-5"><select className="h-10 rounded-md border px-3 text-sm" value={kind} onChange={event => setKind(event.target.value as "sale" | "expense")}><option value="sale">Sale</option><option value="expense">Expense</option></select><Input type="date" value={entryDate} onChange={event => setEntryDate(event.target.value)} /><Input value={category} onChange={event => setCategory(event.target.value)} placeholder="Category" /><Input type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="Amount" /><Button onClick={() => void addEntry()} disabled={saving || !branchId || !amount}>Add</Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Latest entries</CardTitle></CardHeader><CardContent className="space-y-2">{entries.map(entry => <div key={entry.id} className="flex justify-between rounded-lg border p-3 text-sm"><div><Badge variant={entry.entry_type === "sale" ? "default" : "outline"}>{entry.entry_type}</Badge><span className="ml-2">{entry.category}</span><div className="text-xs text-muted-foreground">{entry.entry_date}</div></div><strong>{Number(entry.amount).toLocaleString()}</strong></div>)}{!entries.length && <p className="text-sm text-muted-foreground">No entries in this period.</p>}</CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-2xl font-bold">{value.toLocaleString()}</div></CardContent></Card>; }
