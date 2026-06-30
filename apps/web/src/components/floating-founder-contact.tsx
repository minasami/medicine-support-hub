import { FormEvent, useState } from "react";
import { ExternalLink, Mail, MessageCircle, Send, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialForm = {
  contact_name: "",
  email: "",
  organization_name: "",
  organization_type: "ngo",
  country: "",
  beneficiaries_estimate: "",
  message: "",
};

export function FloatingFounderContact() {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitLead(event: FormEvent) {
    event.preventDefault();
    if (!form.contact_name.trim() || !form.email.trim()) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) throw new Error("Contact form is temporarily unavailable.");
      const response = await fetch(`${url}/rest/v1/partnership_leads`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          contact_name: form.contact_name.trim(),
          email: form.email.trim(),
          organization_name: form.organization_name.trim() || null,
          organization_type: form.organization_type || null,
          country: form.country.trim() || null,
          beneficiaries_estimate: form.beneficiaries_estimate ? Number(form.beneficiaries_estimate) : null,
          message: form.message.trim() || null,
          source_path: window.location.pathname,
        }),
      });
      if (!response.ok) throw new Error("Could not send your request. Please email me directly.");
      setForm(initialForm);
      setMessage("Thank you. I’ll get back to you soon.");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your request.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3 font-sans">
      {open && (
        <div className="w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <div className="bg-[#0B1F33] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-300"><UserRound className="h-4 w-4" />Talk to the Founder</div>
                <div className="mt-2 text-lg font-bold">Mina Samy Tawfik Saad</div>
                <div className="mt-1 text-sm text-slate-300">Partnerships • NGOs • Healthcare • Pilots</div>
              </div>
              <button aria-label="Close contact card" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <a href="mailto:jesussavedmina@gmail.com" className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50">
              <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50"><Mail className="h-4 w-4 text-[#0EA5E9]" /></span><span><span className="block text-sm font-semibold text-[#0B1F33]">Email Mina</span><span className="block text-xs text-slate-500">jesussavedmina@gmail.com</span></span></span>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </a>

            <a href="https://minasami.github.io/" target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-emerald-300 hover:bg-emerald-50">
              <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"><ExternalLink className="h-4 w-4 text-[#10B981]" /></span><span><span className="block text-sm font-semibold text-[#0B1F33]">Visit my website</span><span className="block text-xs text-slate-500">minasami.github.io</span></span></span>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </a>

            {!showForm ? (
              <Button className="w-full bg-[#0EA5E9] hover:bg-sky-600" onClick={() => { setShowForm(true); setMessage(null); setError(null); }}><MessageCircle className="mr-2 h-4 w-4" />Request a demo or partnership call</Button>
            ) : (
              <form onSubmit={submitLead} className="space-y-3 rounded-xl bg-[#F5F9FC] p-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><Label>Name</Label><Input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} required /></div>
                  <div className="col-span-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
                  <div className="col-span-2"><Label>Organization</Label><Input value={form.organization_name} onChange={e => setForm({ ...form, organization_name: e.target.value })} /></div>
                  <div><Label>Type</Label><select className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={form.organization_type} onChange={e => setForm({ ...form, organization_type: e.target.value })}>{["ngo","foundation","pharma","hospital","government","donor","pharmacy","supplier","other"].map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></div>
                  <div><Label>Country</Label><Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Estimated beneficiaries</Label><Input type="number" min="0" value={form.beneficiaries_estimate} onChange={e => setForm({ ...form, beneficiaries_estimate: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Message</Label><Textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="Tell me about your organization or pilot idea." /></div>
                </div>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <div className="flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button><Button type="submit" className="flex-1 bg-[#10B981] hover:bg-emerald-600" disabled={saving || !form.contact_name.trim() || !form.email.trim()}><Send className="mr-2 h-4 w-4" />{saving ? "Sending..." : "Send"}</Button></div>
              </form>
            )}

            {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
          </div>
        </div>
      )}

      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full bg-[#0B1F33] px-4 py-3 font-semibold text-white shadow-xl shadow-slate-900/25 transition hover:-translate-y-0.5 hover:bg-slate-800" aria-expanded={open} aria-label="Contact Mina Samy Tawfik Saad">
        <MessageCircle className="h-5 w-5 text-[#10B981]" />
        <span className="hidden sm:inline">Talk to the Founder</span>
      </button>
    </div>
  );
}
