# Connected Clinical Journey Architecture

## Purpose

Medicine Support Hub is evolving from medicine intelligence and assistance workflows into a connected healthcare journey platform. This document defines the first safe clinical foundation without claiming that the platform is already a certified EMR/EHR.

The target journey is:

```text
Patient identity and consent
→ physician encounter
→ structured prescription and/or service order
→ insurance eligibility or prior authorization
→ laboratory, radiology, consultation, or pharmacy fulfillment
→ result, dispensing, or decision
→ longitudinal patient timeline
→ follow-up encounter and care plan
```

## Current-state audit

The production platform is already strong in:

- canonical medicine intelligence, prices, sources, and product pages
- medicine-support requests and review
- pharmacy branches, inventory, purchases, sales, finance, and fulfillment
- NGO and institutional program workflows
- verified company profiles and product contributions
- verified B2B medicine marketplace
- universal search, knowledge graph, SEO, and public data attribution

Before this release, the platform did not contain first-class resources for:

- longitudinal clinical patients
- patient-care-team access grants
- encounters
- structured prescriptions and prescription items
- laboratory or radiology orders
- diagnostic results and reports
- insurance coverages or prior authorizations
- a unified clinical journey timeline
- generalized role-based training and progress

The legacy `medicine_requests` workflow remains valuable for medicine assistance and fulfillment, but it must not be treated as an electronic health record. It stores requested medicines as JSON and uses an uploaded prescription URL rather than structured clinical resources.

## Clinical domains introduced

### Clinical patient

`clinical_patients` is the longitudinal patient identity anchor. A patient may be linked to a Supabase Auth account through `user_id`, or may begin as an invited record created by an authorized care organization.

Raw government identifiers must never be stored. The schema reserves only:

- identity type
- keyed identity match value
- last four characters for human confirmation

Exact identifier matching remains feature-gated until a server-side managed secret or vault-backed service is approved.

### Patient access and consent

`clinical_patient_access` separates the existence of a patient from permission to open the clinical record.

Access records include:

- organization
- optional individual practitioner
- access level
- explicit scopes
- requested, granted, denied, revoked, or expired state
- consent basis and reason
- grantor and expiration

A physician-created patient receives a one-time account claim invitation. The patient can later link their own account and control requested access.

### Encounter

`clinical_encounters` records the care interaction and keeps it separate from medicine-support requests. It supports outpatient, telehealth, emergency, inpatient, home visit, and pharmacy consultation contexts.

### Prescription

`clinical_prescriptions` stores the prescriber, status, authored date, indication, instructions, substitution policy, and insurance requirement.

`clinical_prescription_items` stores each medicine separately with:

- canonical medicine ID when available
- medicine name, strength, and dosage form
- route, dose, frequency, duration, and quantity
- indication and instructions
- selected pharmacy branch
- dispensing state

A pharmacy updates fulfillment state; it does not silently rewrite the prescriber order.

### Service order

`clinical_service_orders` routes work from the physician to another stakeholder. Initial service types are:

- laboratory
- radiology
- pharmacy
- consultation
- procedure
- home care

Each order can identify the destination organization, priority, code system, service code, clinical question, instructions, insurance requirement, and operational status.

### Result

`clinical_results` returns the outcome of a service order. It supports laboratory results, radiology reports, imaging studies, procedure reports, clinical notes, and other result types.

Structured values belong in `structured_data`. Reports may also link to a protected document or external imaging system. Binary medical images should remain in a DICOM-compatible imaging system rather than being embedded directly in ordinary database rows.

### Insurance

`insurance_coverages` connects the patient to a payer organization and plan. Member identifiers require the same privacy treatment as patient identity numbers.

`insurance_authorizations` connects a coverage record to at least one encounter, prescription, or service order and records the submitted, information-requested, approved, partially approved, denied, cancelled, or expired state.

### Journey timeline

`clinical_journey_events` is an append-only operational timeline. It records important state changes across encounters, prescriptions, medicine items, service orders, results, coverages, and authorizations.

The timeline is not a replacement for the source resource. It is a navigational and audit layer that makes the full healthcare journey understandable.

## Patient matching rules

### Name search

Name search is permitted only within patients already accessible to the clinician's organization. It must not behave as a global public people directory.

### Exact identity search

Exact identity search must:

1. require an authenticated, active clinician in an organization;
2. normalize the supplied identifier in server-side code;
3. derive a keyed match value using a managed secret;
4. store and compare only the match value;
5. return a minimal identity confirmation;
6. record the search in a private audit log;
7. require an access request if no active care relationship exists.

A normal database digest without a secret is not acceptable because many national identifier spaces can be enumerated.

## Physician workflow

The physician experience should offer two entry paths:

### Existing patient

```text
Choose organization
→ search accessible patients by name
or perform audited exact identity match
→ open patient timeline
→ start encounter
```

### New patient

```text
Choose organization
→ create invited patient record
→ record consent basis
→ receive one-time claim code
→ give code to patient through an approved channel
→ start encounter
```

The encounter then branches into any combination of:

- prescription
- laboratory order
- radiology order
- consultation or procedure referral
- pharmacy routing
- insurance authorization
- follow-up plan

## Stakeholder queues

### Laboratory and radiology organizations

Members see only service orders assigned to their organization. They can accept, schedule, perform, and complete the order, then issue a preliminary or final result.

### Pharmacy

Branch members see only prescription items routed to their branch. They can document not started, sent, partial, dispensed, not dispensed, or cancelled outcomes.

### Payer

Members of the payer organization see only coverage and authorization records routed to the payer. They can request information and record an attributable decision.

### Patient

The patient sees their own timeline, prescriptions, orders, results, authorizations, and pending access requests. They can grant, deny, or revoke access within the supported consent model.

## Interoperability direction

The local model maps conceptually to HL7 FHIR R5 resources:

| Local resource | FHIR direction |
|---|---|
| clinical_patients | Patient |
| profiles and organization members | Practitioner / PractitionerRole |
| organizations | Organization |
| clinical_patient_access | Consent / CareTeam / Provenance |
| clinical_encounters | Encounter |
| clinical_prescriptions | MedicationRequest |
| clinical_prescription_items | MedicationRequest dosage and dispense request |
| clinical_service_orders | ServiceRequest |
| clinical_results | DiagnosticReport / Observation |
| external imaging references | ImagingStudy |
| insurance_coverages | Coverage |
| insurance_authorizations | Claim / CoverageEligibilityRequest / Task |
| clinical_journey_events | AuditEvent / Provenance / Task history |

This is a mapping direction, not a claim of FHIR conformance. A conformant API needs versioned profiles, terminology bindings, validation, capability statements, consent enforcement, and interoperability testing.

Medical imaging exchange should use DICOMweb patterns:

- QIDO-RS for search
- WADO-RS for retrieval
- STOW-RS for storage
- UPS-RS for worklist state

## Security model

Clinical resources are private by default.

Required controls:

- no anonymous grants on clinical tables
- row-level security on every exposed table
- explicit organization and patient access relationships
- private-schema authorization helpers
- append-only audit events
- no hard deletion of signed clinical records through ordinary user workflows
- no raw national or insurance member IDs
- no clinical pages in sitemaps
- `noindex`, `noarchive`, and private cache headers on all clinical routes
- service-role keys never shipped to the browser
- independent authorization tests for patient, clinician, pharmacy, diagnostic provider, payer, and platform administrator

## Relationship to existing modules

The new clinical journey should connect rather than replace:

- canonical medicines provide medicine identity and evidence
- marketplace offers support institutional procurement, not patient clinical dispensing by default
- pharmacy inventory supplies batch and availability evidence
- medicine-support requests can be created from an eligible prescription or service order
- NGO programs can sponsor approved clinical services without receiving unrestricted medical records
- company profiles and education resources can enrich public knowledge but cannot edit patient records
- universal search indexes public resources only; clinical search remains private and scoped

## Release position

This foundation is not sufficient to market the platform as a fully compliant or flawless EMR/EHR. The accurate release position is:

> A connected healthcare journey and medicine-support platform with an emerging longitudinal clinical record foundation.

A full EMR/EHR claim requires the release gates in `docs/clinical-release-readiness.md`.