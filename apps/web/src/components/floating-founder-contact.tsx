import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ExternalLink,
  Linkedin,
  Mail,
  MessageCircle,
  Send,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFounderLeadDraft } from "@/hooks/use-founder-lead-draft";
import {
  buildWhatsAppUrl,
  FOUNDER_EMAIL_PLAIN,
  FOUNDER_LINKEDIN,
  FOUNDER_WHATSAPP_PLAIN,
  priorityForLeadType,
  submitFounderLead,
  type FounderLeadPayload,
} from "@/lib/founder-lead-submit";

const INTENT_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "partnership", label: "Partnership" },
  { id: "demo", label: "Demo" },
  { id: "pilot", label: "Pilot" },
  { id: "data_contribution", label: "Product data" },
  { id: "support", label: "Support" },
  { id: "marketplace", label: "Marketplace" },
  { id: "institutional", label: "Institutional" },
  { id: "other", label: "Other" },
];

const ORGANIZATION_TYPES = [
  "ngo",
  "foundation",
  "pharma",
  "hospital",
  "government",
  "donor",
  "pharmacy",
  "supplier",
  "laboratory",
  "insurance_company",
  "other",
];

export function FloatingFounderContact() {
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackLinks, setFallbackLinks] = useState<{
    wa: string;
    mail: string;
  } | null>(null);

  const {
    form,
    patchForm,
    resetForm,
    flushNow,
    draftHint,
    hasDraft,
  } = useFounderLeadDraft();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // If a draft exists, open form panel so the user sees restored fields
  useEffect(() => {
    if (hasDraft && open) setShowForm(true);
  }, [hasDraft, open]);

  const payload: FounderLeadPayload = useMemo(
    () => ({
      contact_name: form.contact_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      organization_name: form.organization_name.trim() || null,
      organization_type: form.organization_type || null,
      lead_type: form.lead_type,
      country: form.country.trim() || null,
      beneficiaries_estimate: form.beneficiaries_estimate
        ? Number(form.beneficiaries_estimate)
        : null,
      message: form.message.trim() || null,
      source_path:
        typeof window !== "undefined" ? window.location.pathname : null,
      priority: priorityForLeadType(form.lead_type),
    }),
    [form],
  );

  const canSubmit =
    form.contact_name.trim().length > 1 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  async function submitLead(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || saving) return;
    flushNow();
    setSaving(true);
    setMessage(null);
    setError(null);
    setFallbackLinks(null);

    const result = await submitFounderLead(payload);
    setSaving(false);

    if (result.ok) {
      resetForm();
      setShowForm(false);
      setShowMore(false);
      setMessage(
        "Thank you. Your request reached the founder CRM — Mina will follow up.",
      );
      return;
    }

    setError(result.error);
    setFallbackLinks({ wa: result.fallbackWhatsApp, mail: result.fallbackMailto });
  }

  function openQuickWhatsApp() {
    const url = form.contact_name
      ? buildWhatsAppUrl(payload)
      : FOUNDER_WHATSAPP_PLAIN;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[60] flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="Talk to the Founder"
          className="w-[calc(100vw-2.5rem)] max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
        >
          <div className="bg-[#0B1F33] p-5 text-white">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
                  <UserRound className="h-4 w-4" />
                  Talk to the Founder
                </div>
                <div className="mt-2 text-lg font-bold">Mina Samy Tawfik Saad</div>
                <div className="mt-1 text-sm text-slate-300">
                  Partnerships · Product data · Pilots · Collaboration
                </div>
              </div>
              <button
                type="button"
                aria-label="Close contact card"
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
                onClick={() => {
                  flushNow();
                  setOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[min(70vh,560px)] space-y-3 overflow-y-auto p-4">
            <div className="space-y-2">
              <ContactLink
                href={FOUNDER_WHATSAPP_PLAIN}
                label="WhatsApp"
                detail="Fastest for partnerships"
                icon={MessageCircle}
              />
              <ContactLink
                href={`mailto:${FOUNDER_EMAIL_PLAIN}`}
                label="Email"
                detail={FOUNDER_EMAIL_PLAIN}
                icon={Mail}
              />
              <ContactLink
                href={FOUNDER_LINKEDIN}
                label="LinkedIn"
                detail="Professional profile"
                icon={Linkedin}
              />
            </div>

            {draftHint && (
              <p className="text-[11px] text-slate-500" aria-live="polite">
                {draftHint}
                {hasDraft && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-slate-800"
                      onClick={() => resetForm()}
                    >
                      Discard draft
                    </button>
                  </>
                )}
              </p>
            )}

            {!showForm ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  Or leave a structured request — pick an intent:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {INTENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        patchForm({ lead_type: opt.id });
                        setShowForm(true);
                        setMessage(null);
                        setError(null);
                      }}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={openQuickWhatsApp}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Message on WhatsApp now
                </Button>
              </div>
            ) : (
              <form className="space-y-3" onSubmit={submitLead}>
                <div className="flex flex-wrap gap-1.5">
                  {INTENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => patchForm({ lead_type: opt.id })}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                        form.lead_type === opt.id
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3">
                  <div>
                    <Label htmlFor="ff-name">Your name *</Label>
                    <Input
                      id="ff-name"
                      autoComplete="name"
                      value={form.contact_name}
                      onChange={(e) =>
                        patchForm({ contact_name: e.target.value })
                      }
                      onBlur={() => flushNow()}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ff-email">Email *</Label>
                    <Input
                      id="ff-email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => patchForm({ email: e.target.value })}
                      onBlur={() => flushNow()}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="ff-msg">Message</Label>
                    <Textarea
                      id="ff-msg"
                      rows={3}
                      value={form.message}
                      onChange={(e) => patchForm({ message: e.target.value })}
                      onBlur={() => flushNow()}
                      placeholder="What should Mina know? (need, org, product data, pilot…)"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                  onClick={() => setShowMore((v) => !v)}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition ${
                      showMore ? "rotate-180" : ""
                    }`}
                  />
                  {showMore
                    ? "Hide optional fields"
                    : "Organization & phone (optional)"}
                </button>

                {showMore && (
                  <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <div>
                      <Label>Phone</Label>
                      <Input
                        type="tel"
                        autoComplete="tel"
                        value={form.phone}
                        onChange={(e) => patchForm({ phone: e.target.value })}
                        onBlur={() => flushNow()}
                      />
                    </div>
                    <div>
                      <Label>Organization</Label>
                      <Input
                        value={form.organization_name}
                        onChange={(e) =>
                          patchForm({ organization_name: e.target.value })
                        }
                        onBlur={() => flushNow()}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Org type</Label>
                        <select
                          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                          value={form.organization_type}
                          onChange={(e) =>
                            patchForm({ organization_type: e.target.value })
                          }
                        >
                          {ORGANIZATION_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Country</Label>
                        <Input
                          value={form.country}
                          onChange={(e) =>
                            patchForm({ country: e.target.value })
                          }
                          onBlur={() => flushNow()}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Estimated beneficiaries</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.beneficiaries_estimate}
                        onChange={(e) =>
                          patchForm({
                            beneficiaries_estimate: e.target.value,
                          })
                        }
                        onBlur={() => flushNow()}
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                    <p>{error}</p>
                    {fallbackLinks && (
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="font-semibold text-emerald-700 underline"
                          href={fallbackLinks.wa}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open WhatsApp
                        </a>
                        <a
                          className="font-semibold text-sky-700 underline"
                          href={fallbackLinks.mail}
                        >
                          Open email
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      flushNow();
                      setShowForm(false);
                      setError(null);
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#10B981] hover:bg-emerald-600"
                    disabled={saving || !canSubmit}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {saving ? "Sending…" : "Send"}
                  </Button>
                </div>

                <button
                  type="button"
                  className="w-full text-center text-xs text-slate-500 underline-offset-2 hover:underline"
                  onClick={() => {
                    flushNow();
                    window.open(
                      buildWhatsAppUrl(payload),
                      "_blank",
                      "noopener,noreferrer",
                    );
                  }}
                >
                  Prefer WhatsApp with this message prefilled
                </button>
              </form>
            )}

            {message && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {message}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setMessage(null);
        }}
        className="flex items-center gap-2 rounded-full bg-[#0B1F33] px-4 py-3 font-semibold text-white shadow-xl shadow-slate-900/25 transition hover:-translate-y-0.5 hover:bg-slate-800"
        aria-expanded={open}
        aria-label="Talk to the Founder — contact Mina Samy Tawfik Saad"
      >
        <MessageCircle className="h-5 w-5 text-[#10B981]" />
        <span className="hidden sm:inline">Talk to the Founder</span>
      </button>
    </div>
  );
}

function ContactLink({
  href,
  label,
  detail,
  icon: Icon,
}: {
  href: string;
  label: string;
  detail: string;
  icon: typeof Mail;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-sky-300 hover:bg-sky-50"
    >
      <span className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50">
          <Icon className="h-4 w-4 text-[#0EA5E9]" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[#0B1F33]">
            {label}
          </span>
          <span className="block text-xs text-slate-500">{detail}</span>
        </span>
      </span>
      <ExternalLink className="h-4 w-4 text-slate-400" />
    </a>
  );
}
