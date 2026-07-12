# Training and Adoption Platform

## Objective

Every stakeholder should be able to learn the exact workflow they are allowed to perform, understand the safety boundaries, and prove readiness before receiving production access.

The learning platform uses:

- `learning_courses`
- `learning_lessons`
- `learning_enrollments`
- `learning_catalog_v1`

Public course content is indexable and reusable by users, institutions, search engines, and AI assistants. Individual enrollment and progress remain private.

## Initial learning tracks

1. Patient healthcare journey
2. Physician connected-care workflow
3. Pharmacy clinical fulfillment
4. Laboratory and radiology workflow
5. Insurance authorization workflow
6. Institution platform onboarding
7. Clinical platform governance

## Training design principles

- role-specific rather than generic
- workflow-based rather than feature-based
- short lessons with clear outcomes
- bilingual English and Arabic
- accessible on mobile and desktop
- safety warnings embedded at the point of action
- practical checklists and scenario exercises
- versioned content tied to platform releases
- private learner progress
- institution-visible completion only with an explicit organizational training relationship

## Required learning journey

### Patient

- create or sign in to account
- claim invited record
- review demographics
- understand access requests
- grant, deny, or revoke access
- follow encounter, prescription, order, result, authorization, and dispensing status
- report an error safely

### Physician

- choose correct organization
- search accessible patients by name
- perform exact identity lookup only when enabled and justified
- create invited patient with consent basis
- start and complete encounter
- create structured prescription
- route laboratory, radiology, consultation, and pharmacy work
- request insurance authorization
- review returned results and update care plan
- amend rather than overwrite finalized information

### Pharmacy

- verify branch and patient/order context
- receive routed prescription items
- distinguish clinical order from marketplace offer
- check medicine identity, quantity, and prescription handling
- record partial, complete, unavailable, or cancelled fulfillment
- connect batch and expiry evidence where supported
- never silently change dose or medicine

### Laboratory and radiology

- accept only assigned service orders
- review clinical question and priority
- schedule and perform service
- distinguish preliminary and final result
- attach structured result and protected report
- correct through amended status and provenance
- use DICOM-compatible imaging systems for diagnostic images

### Payer

- verify coverage
- review linked prescription or service order
- request missing information
- record approved, partially approved, or denied decision
- include reason, amount, expiry, and reviewer attribution
- never let an AI system make an unreviewed denial

### Institution administrator

- verify institution profile
- configure organization membership
- assign least-privilege roles
- establish patient-consent procedures
- enroll users in required tracks
- test a complete journey in a controlled environment
- review incident, privacy, downtime, and escalation procedures
- approve launch only after evidence is complete

### Platform administrator

- review identity-search audit
- review access grants and revocations
- monitor tenant isolation
- manage terminology and interoperability versions
- review security advisories and dependency risk
- verify backups and restoration
- approve releases against the clinical readiness gate

## Institutional onboarding sequence

```text
Organization verification
→ data-processing and operating agreements
→ workspace configuration
→ user invitation and role assignment
→ required learning tracks
→ sandbox scenarios
→ access-control validation
→ supervised pilot
→ readiness sign-off
→ production access
```

## Completion and certification direction

The initial platform records lesson completion and progress percentage. Future controlled additions may include:

- quiz and scenario assessments
- course prerequisites
- release-version re-certification
- institution-assigned due dates
- certificates with verification codes
- supervisor sign-off
- training audit export

A course completion certificate should state that the user completed platform training; it must not be presented as a professional medical license or regulatory credential.

## Content governance

Every clinical or operational course needs:

- content owner
- clinical or subject-matter reviewer
- version
- review date
- linked platform release
- learning outcomes
- known limitations
- retirement or replacement process

## SEO, GEO, and AI discoverability

Public learning content should use:

- one canonical `/learn` hub
- descriptive course headings
- `Course`, `LearningResource`, `ItemList`, and breadcrumb structured data where appropriate
- stable course slugs
- public summaries in `llms.txt` and `llms-full.txt`
- explicit audience, outcomes, duration, language, and version
- links to source documentation and relevant product workflows

Clinical records, learner progress, patient names, and organization-private training assignments must never appear in public structured data, sitemaps, AI context files, or search indexes.

## Adoption metrics

Track only privacy-safe operational metrics:

- enrollments by role and institution
- completion percentage
- median completion time
- overdue required training
- workflow error rate before and after training
- support requests by lesson topic
- failed sandbox scenarios
- re-certification status

Do not publish identifiable learner performance without a valid organizational and privacy basis.