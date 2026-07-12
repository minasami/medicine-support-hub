# Connected Healthcare Journey — Release Map

## Purpose

This document is the operational map for connecting Medicine Support Hub from patient entry through medicine discovery, physician workflows, diagnostics, payer authorization, pharmacy fulfillment, support delivery, training, and governance.

The canonical public status page is `/journey`. It intentionally distinguishes live operational capabilities from planned or security-gated clinical capabilities.

## Live capabilities

- Patient accounts and profiles
- Canonical medicine discovery and source-backed price history
- Verified company participation and reviewed marketplace discovery
- Medicine-support requests, review, fulfillment, delivery, and tracking
- Pharmacy inventory, purchasing, sales, finance, reporting, and staff workflows
- Seven bilingual role-based learning tracks
- Platform control center, audited settings, review queues, OCR, governed web ingestion, and search-index refresh

## Security-gated clinical capabilities

The following capabilities must not be presented as production-ready until they pass independent security and clinical-governance review:

- Clinician-scoped patient discovery and invitation
- Exact national-identity matching
- Structured encounters
- Electronic prescriptions and prescription signing
- Laboratory and radiology orders and results
- Insurance eligibility and prior authorization
- Longitudinal patient timelines
- Care-team access, consent, break-glass access, and immutable audit history

## Patient identity rules

1. Name search is limited to records already accessible to the clinician or institution.
2. Exact national-ID matching must happen only in an authenticated server-side function.
3. Raw national IDs must not be stored in public tables, URLs, browser logs, analytics, AI files, or ordinary search indexes.
4. Matching must use a keyed non-reversible value backed by a managed secret.
5. Every identity match must be organization-scoped, purpose-limited, and audited.
6. Matching alone does not grant access; consent or an approved access workflow remains required.

## Clinical release gates

A clinical release requires documented evidence for:

- clinical governance and accountable medical leadership
- role, organization, and tenant isolation
- patient consent and revocation
- identity verification and secret management
- strong authentication and session controls
- prescription integrity and signing
- diagnostic-result provenance
- payer decision governance and appeals
- backup, recovery, retention, and legal hold
- independent security testing
- accessibility and usability testing
- incident response and breach procedures
- terminology, FHIR, and DICOMweb validation
- training completion for each controlled role

## Interoperability direction

Conceptual mappings:

- patient → FHIR Patient
- clinician → Practitioner and PractitionerRole
- institution → Organization
- consent/access → Consent, CareTeam, and Provenance
- visit → Encounter
- prescription → MedicationRequest
- diagnostic order → ServiceRequest
- laboratory result → Observation and DiagnosticReport
- radiology study → ImagingStudy and DiagnosticReport
- insurance → Coverage, CoverageEligibilityRequest, Claim, Task
- journey history → AuditEvent, Provenance, and Task history

Imaging integration should use DICOMweb capabilities appropriate to the selected PACS and workflow.

## Automation and data gathering

The platform uses a governed ingestion model:

- administrators approve HTTPS domains and bounded paths
- jobs have page limits and refresh intervals
- provider credentials stay in server-side environment variables
- extracted content enters private review queues
- source URL, timestamps, hashes, and provider provenance are retained
- no crawled content publishes directly
- clinical claims, product identity, prices, and images require human review

The existing managed Firecrawl integration should remain a separate provider boundary. Vendoring the entire upstream crawler into the application repository is not recommended because it adds a large independent service, operational dependencies, security patching obligations, and AGPL compliance responsibilities. A self-hosted deployment can be operated as a separately versioned service when required.

## Training model

The learning center contains role-based tracks for:

- patients
- physicians
- pharmacies
- laboratory and radiology providers
- insurance reviewers and payers
- institutional administrators
- platform governance

Training completion is onboarding evidence, not a professional license or clinical credential.

## Release statement

Medicine Support Hub is currently strong in medicine intelligence, medicine-support operations, pharmacy operations, marketplace participation, learning, and governed evidence ingestion. It must not be described as a certified or flawless EMR/EHR until the clinical release gates above are independently validated.
