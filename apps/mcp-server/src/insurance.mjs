/**
 * Read-only Egypt insurance HINTS — not eligibility, approval, or claims.
 * No member IDs. No live TPA calls.
 */

export const INSURANCE_DISCLAIMER_EN =
  "Insurance hints only. Not eligibility, pre-authorization, a claim decision, or a guarantee of payment. Confirm with the insurer or TPA and the member's policy.";
export const INSURANCE_DISCLAIMER_AR =
  "هذه إشارات تأمين فقط — ليست أهلية ولا موافقة مسبقة ولا قرار مطالبة ولا ضمان دفع. راجع الشركة أو شركة الإدارة ووثيقة العضو.";

export const PAYERS = [
  {
    id: "self_pay",
    name_en: "Self-pay / uninsured",
    name_ar: "دفع ذاتي / بدون تأمين",
    type: "self_pay",
    copay_outpatient_meds: 1,
    typical_annual_meds_cap_egp: null,
    notes_en: "Patient pays catalog price at the pharmacy.",
  },
  {
    id: "uhia",
    name_en: "UHIA (Universal Health Insurance)",
    name_ar: "الهيئة العامة للتأمين الصحي",
    type: "public",
    copay_outpatient_meds: 0.25,
    typical_annual_meds_cap_egp: null,
    notes_en: "Public benefit package and formulary. Coverage depends on enrollment stage and contracted facilities — not a private TPA portal.",
  },
  {
    id: "private_medical",
    name_en: "Private medical insurance (generic Egypt template)",
    name_ar: "تأمين طبي خاص (قالب مصري عام)",
    type: "private",
    copay_outpatient_meds: 0.25,
    typical_annual_meds_cap_egp: 10000,
    notes_en: "Many individual plans cap outpatient medicines and apply 20–25% copay. Chronic programs and prior-auth lists vary by insurer and TPA.",
  },
  {
    id: "employer_tpa",
    name_en: "Employer scheme via TPA",
    name_ar: "نظام شركة عبر شركة إدارة",
    type: "tpa",
    copay_outpatient_meds: 0.2,
    typical_annual_meds_cap_egp: 15000,
    notes_en: "TPA administers eligibility and approvals for the insurer or self-funded employer. FRA-licensed TPAs do not carry insurance risk.",
  },
];

const INN_HINTS = [
  { match: /pantoprazole|omeprazole|esomeprazole|بانتوبرازول/i, status: "likely_outpatient", prior_auth_typical: false, note: "Common PPI; often outpatient with copay." },
  { match: /amoxicillin|azithromycin|ceftriaxone|أموكسيسيلين/i, status: "likely_outpatient", prior_auth_typical: false, note: "Acute antibiotic; duration limits are common." },
  { match: /insulin|metformin|gliclazide|sitagliptin|إنسولين|متفورمين/i, status: "chronic_program", prior_auth_typical: true, note: "Diabetes agents often sit on a chronic program after registration." },
  { match: /clopidogrel|warfarin|enoxaparin|atorvastatin|rosuvastatin/i, status: "chronic_program", prior_auth_typical: true, note: "Cardio prevention; chronic file or duration cap is typical." },
  { match: /adalimumab|ustekinumab|trastuzumab|rituximab|pembrolizumab/i, status: "prior_auth_typical", prior_auth_typical: true, note: "High-cost specialty — pre-auth and designated center almost always required." },
  { match: /sildenafil|tadalafil|orlistat/i, status: "likely_excluded", prior_auth_typical: false, note: "Lifestyle / cosmetic-adjacent items are often excluded." },
  { match: /paracetamol|ibuprofen|diclofenac|باراسيتامول|بروفين/i, status: "likely_outpatient", prior_auth_typical: false, note: "Simple analgesic; OTC packs may be excluded even if the molecule is covered as Rx." },
];

function payerById(id) {
  const key = String(id || "private_medical").toLowerCase();
  return PAYERS.find((p) => p.id === key) || PAYERS.find((p) => p.id === "private_medical");
}

function hintForText(text) {
  const blob = String(text || "");
  for (const row of INN_HINTS) {
    if (row.match.test(blob)) return row;
  }
  return {
    status: "unknown",
    prior_auth_typical: false,
    note: "No local hint for this name. Treat as unknown until the TPA answers.",
  };
}

export function listPayers() {
  return {
    not_an_approval: true,
    live_eligibility: false,
    payers: PAYERS,
    disclaimer_en: INSURANCE_DISCLAIMER_EN,
    disclaimer_ar: INSURANCE_DISCLAIMER_AR,
  };
}

export function explainBenefitTerms(payerId = "private_medical") {
  const payer = payerById(payerId);
  return {
    not_an_approval: true,
    payer,
    typical_terms: {
      outpatient_medicine_copay_share: payer.copay_outpatient_meds,
      typical_annual_meds_cap_egp: payer.typical_annual_meds_cap_egp,
      prior_auth: "High-cost, oncology, biologics, and many chronic first fills.",
      exclusions_typical: ["OTC without Rx", "cosmetic", "fertility (plan-specific)", "unlicensed indication"],
    },
    disclaimer_en: INSURANCE_DISCLAIMER_EN,
    disclaimer_ar: INSURANCE_DISCLAIMER_AR,
  };
}

export async function estimatePatientShare({ query, canonical_id, quantity = 1, payer_id = "private_medical" }, lookup) {
  const payer = payerById(payer_id);
  let product = null;
  if (typeof lookup === "function") {
    product = await lookup({ query, canonical_id });
  }
  const unit = product?.current_price_egp ?? null;
  const qty = Math.max(1, Number(quantity) || 1);
  const catalog = unit == null ? null : Number((unit * qty).toFixed(2));
  const patient =
    catalog == null ? null : Number((catalog * payer.copay_outpatient_meds).toFixed(2));
  const scheme =
    catalog == null ? null : Number((catalog - patient).toFixed(2));
  return {
    not_an_approval: true,
    payer_id: payer.id,
    product: product
      ? { canonical_id: product.canonical_id, name_en: product.name_en, name_ar: product.name_ar, unit_egp: unit }
      : null,
    quantity: qty,
    catalog_total_egp: catalog,
    assumed_patient_share_egp: patient,
    assumed_scheme_share_egp: scheme,
    assumed_patient_share_pct: payer.copay_outpatient_meds,
    disclaimer_en: INSURANCE_DISCLAIMER_EN,
    disclaimer_ar: INSURANCE_DISCLAIMER_AR,
  };
}

export function checkFormularyHint({ query, scientific_name, category } = {}) {
  const hint = hintForText([query, scientific_name, category].filter(Boolean).join(" "));
  return {
    not_an_approval: true,
    query: query || scientific_name || null,
    coverage_status: hint.status,
    prior_auth_typical: hint.prior_auth_typical,
    note_en: hint.note,
    disclaimer_en: INSURANCE_DISCLAIMER_EN,
    disclaimer_ar: INSURANCE_DISCLAIMER_AR,
  };
}

export function draftPreauthChecklist({ query, payer_id = "private_medical" } = {}) {
  const hint = hintForText(query);
  return {
    not_an_approval: true,
    payer_id,
    query: query || null,
    coverage_status: hint.status,
    checklist: [
      "Valid member card / national ID + policy or employer certificate",
      "Prescription with diagnosis and duration",
      "Brand, strength, pack size, and scientific name",
      "Treating physician stamp and license number",
      "For chronic: previous approval or chronic-file number if any",
      "For specialty: indication guideline note and designated-center request",
    ],
    submit_to: "Insurer or FRA-licensed TPA — not Medicine Support Hub",
    disclaimer_en: INSURANCE_DISCLAIMER_EN,
    disclaimer_ar: INSURANCE_DISCLAIMER_AR,
  };
}
