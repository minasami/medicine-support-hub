# TPA Approval Workflows – Egypt Field Map

For KAMs, medical reps, and hospital/chain account teams. This is how private medical insurance usually reaches the patient in Egypt: **insurer designs the benefit, TPA runs eligibility and approvals, provider submits the request, pharmacy or hospital delivers the service.**

Public sources informing this map: Allianz Egypt medical user guide (Nextcare), Nextcare beneficiary FAQs, GlobeMed Egypt i*Care / chronic posting, MetLife Egypt chronic-upload process. Scheme rules always override this generic map.

## 1. Who does what

| Actor | Typical role |
|-------|----------------|
| **Insurer / PHI** | Sells the policy, sets benefits, exclusions, co-pay, annual limits |
| **TPA** | Eligibility, pre-authorization, network, claims adjudication, pharmacy panel |
| **Hospital / clinic / lab** | Treats the patient and submits the approval request on the TPA portal |
| **Pharmacy chain** | Dispenses approved acute or posted chronic medicines; collects co-pay |
| **UHIA** | Separate public pathway. Do not mix UHIA approvals with PHI/TPA cards |

Allianz Health Plus is a clear local example: the member shows the card, the provider contacts **Nextcare Egypt**, Nextcare approves and settles in-network (minus co-pay). Out-of-network is pay-and-reimburse.

## 2. Master workflow

```text
Member presents card / ID
        ↓
Eligibility check (policy active? network? remaining limit?)
        ↓
Is pre-authorization required for this service?
   ├─ No  → provider treats / dispenses → claim / direct billing
   └─ Yes → provider (or member) submits request + clinical papers
                 ↓
           TPA medical / precertification review
                 ↓
        Approve / Query / Partial approve / Decline
                 ↓
        Service delivered → co-pay collected → claim closed
```

Most Egypt network flows are **provider-initiated**: the hospital TPA desk or pharmacy submits, not the KAM and not usually the patient.

## 3. Four separate tracks KAMs must not mix

### A. Outpatient visit (clinic / lab)
1. Card presented.
2. Eligibility on TPA system (Nextcare portal / Lumi, GlobeMed i*Care, or insurer system).
3. Many GP visits and basic labs are auto-adjudicated.
4. Higher-cost imaging, scopes, and some specialty visits need pre-auth.
5. Member pays co-pay only if in-network.

### B. Inpatient / day-case / theatre
1. Almost always needs **pre-authorization before admission**, except true emergency.
2. Hospital TPA desk sends diagnosis, planned procedure, and cost estimate.
3. TPA precertification officer (often a pharmacist or physician) checks medical necessity vs policy.
4. Approval letter / electronic approval is sent back to the hospital.
5. Concurrent review may continue during stay.
6. Final claim is reconciled after discharge.

Allianz/Nextcare guidance in Egypt: inpatient, operations, and day-case need Nextcare approval first; the hospital contacts Nextcare.

### C. Acute pharmacy claim
1. Prescription + card at a **network pharmacy**.
2. Pharmacy checks eligibility and benefit (acute vs chronic, formulary, generic rule).
3. Some SKUs auto-pass; others need online or call-center approval.
4. Common blocks: non-network pharmacy, excluded class, duration cap, brand vs generic rule, missing diagnosis.
5. Co-pay collected at the counter; TPA pays the chain later.

### D. Chronic medication posting
This is the track that most affects hospital-line and specialty products.

Typical Egypt pattern (GlobeMed chronic posting; MetLife chronic upload is similar in logic):
1. Specialist prescription + diagnosis + supporting labs/imaging.
2. Request is **posted** on the TPA system for a defined period (often 1–3 or 3–6 months).
3. Once posted, the member can collect monthly at a designated pharmacy or the full pharmacy panel **without a new pre-auth each time**.
4. Renewal needs an updated prescription and sometimes new investigations.
5. If the product is not on the posted list, the pharmacy will reject even if the hospital already uses it.

GlobeMed Egypt publicly describes monthly chronic dispensing against the insurance card after the medicine is posted. MetLife Egypt collects chronic requests through doctor-on-site / HR and medical review before posting.

## 4. What the TPA actually checks

| Check | Why the product can fail |
|-------|---------------------------|
| Eligibility | Lapsed policy, waiting period, dependent not covered |
| Network | Hospital or pharmacy not on that scheme’s panel |
| Benefit table | Outpatient medicines excluded, or only generics covered |
| Medical necessity | Indication not accepted; missing specialist letter |
| Formulary / protocol | Product not on TPA or insurer list for that diagnosis |
| Duration / quantity | Days of supply exceed the rule |
| Cost / ceiling | High-cost item needs extra medical or financial approval |
| Exclusion | Cosmetic, experimental, or policy-specific exclusion |

Nextcare Egypt employs pharmacist precertification officers who assess treatment plans against policy conditions. That is the human behind many “system declined” answers the field hears.

## 5. Typical outcomes

- **Approved** — service or SKU can proceed; co-pay may still apply
- **Query** — more papers (labs, specialist stamp, duration, diagnosis code)
- **Partial** — cheaper alternative, shorter duration, or generic only
- **Declined** — exclusion or not medically necessary under that policy
- **Reimburse later** — out-of-network or member paid cash

Turnaround is scheme-specific. In-network electronic requests can be minutes; complex inpatient or high-cost specialty cases take longer and may escalate from TPA to insurer medical.

## 6. Egypt-specific system patterns

| Model | How approvals usually move |
|-------|----------------------------|
| **Nextcare** | Provider contacts Nextcare; card + network = direct settlement; app/call center for member; inpatient needs pre-auth |
| **GlobeMed i*Care** | Provider checks eligibility and prior auth online; rules engine can auto-approve a large share; chronic medicines are posted then dispensed monthly |
| **Insurer in-house** (some MetLife / others) | Chronic files uploaded in batches via doctor-on-site or HR; medical review before posting |
| **UHIA** | Public eligibility and claims. Separate from PHI cards. Do not brief hospital staff as if it were Nextcare |

Always ask: *Which TPA runs this scheme this year?* Allianz ↔ Nextcare is a known pair; other insurers change TPA or keep claims in-house.

## 7. What a KAM should do with this map

**Before the visit**
- Know whether the account is a provider (hospital/chain) or a payer (insurer/TPA).
- Know which track your product lives on: inpatient, acute retail, or chronic post.
- Prepare the papers TPAs actually ask for: indication, specialist, duration, comparator, and why generic/alternative is not suitable *if that is clinically true*.

**In the hospital**
- Find the TPA desk, not only the chief pharmacist.
- Ask which portals they use (Nextcare / i*Care / insurer).
- Ask what usually gets queried for your class.

**At the chain**
- Ask whether the SKU is on the **pharmacy panel** for the main TPAs they bill.
- Ask whether chronic posting is centralized or branch-level.

**At the TPA / insurer**
- Discuss protocol and medical-necessity language, not only price.
- Separate *network listing* from *chronic posting* from *inpatient pre-auth*. Winning one does not win the others.

**Never put in shared field notes**
- Patient identifiers
- Confidential discount grids
- Informal “we can get it approved” promises

## 8. One-page field checklist

- [ ] Payer name and current TPA confirmed
- [ ] In-network vs reimbursement path known
- [ ] Product track: OP / IP / acute Rx / chronic post
- [ ] Papers typically required for this class listed
- [ ] Hospital TPA desk contact role mapped (no personal mobile required in the seed file)
- [ ] Chain panel status asked
- [ ] Query reasons from last month captured as a field note
- [ ] Next action owner agreed (medical, KAM, or account manager)
