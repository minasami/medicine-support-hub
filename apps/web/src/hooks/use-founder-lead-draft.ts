import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearFounderDraft,
  createDebouncedDraftSaver,
  getFounderDraftMeta,
  isMeaningfulDraft,
  loadFounderDraft,
  subscribeFounderDraft,
  type FounderLeadDraftFields,
} from "@/lib/founder-lead-draft";

const empty = (): FounderLeadDraftFields => ({
  contact_name: "",
  email: "",
  phone: "",
  organization_name: "",
  organization_type: "ngo",
  lead_type: "partnership",
  country: "",
  beneficiaries_estimate: "",
  message: "",
});

/**
 * Form state + debounced draft autosave for the founder contact panel.
 */
export function useFounderLeadDraft() {
  const [form, setForm] = useState<FounderLeadDraftFields>(empty);
  const [restored, setRestored] = useState(false);
  const [draftHint, setDraftHint] = useState<string | null>(null);
  const saverRef = useRef(createDebouncedDraftSaver());
  const skipNextSave = useRef(false);

  // Hydrate from storage once
  useEffect(() => {
    const draft = loadFounderDraft();
    if (draft) {
      skipNextSave.current = true;
      setForm(draft);
      const meta = getFounderDraftMeta();
      if (meta.updatedAt) {
        setDraftHint(
          `Draft restored · ${new Date(meta.updatedAt).toLocaleString()}`,
        );
      } else {
        setDraftHint("Draft restored");
      }
    }
    setRestored(true);
  }, []);

  // Debounced autosave whenever form changes after hydration
  useEffect(() => {
    if (!restored) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saverRef.current.save(form);
    if (isMeaningfulDraft(form)) {
      setDraftHint("Draft saving…");
      const t = window.setTimeout(() => setDraftHint("Draft saved"), 450);
      return () => window.clearTimeout(t);
    }
    setDraftHint(null);
  }, [form, restored]);

  // Flush on page hide / unload
  useEffect(() => {
    const flush = () => saverRef.current.flush(form);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      saverRef.current.flush(form);
      saverRef.current.cancel();
    };
  }, [form]);

  // Cross-tab: another tab updated/cleared the draft
  useEffect(() => {
    return subscribeFounderDraft((fields) => {
      skipNextSave.current = true;
      if (fields) {
        setForm(fields);
        setDraftHint("Draft updated in another tab");
      } else {
        setForm(empty());
        setDraftHint(null);
      }
    });
  }, []);

  const patchForm = useCallback((patch: Partial<FounderLeadDraftFields>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetForm = useCallback(() => {
    saverRef.current.cancel();
    clearFounderDraft();
    skipNextSave.current = true;
    setForm(empty());
    setDraftHint(null);
  }, []);

  const flushNow = useCallback(() => {
    saverRef.current.flush(form);
  }, [form]);

  return {
    form,
    setForm,
    patchForm,
    resetForm,
    flushNow,
    restored,
    draftHint,
    hasDraft: isMeaningfulDraft(form),
  };
}
