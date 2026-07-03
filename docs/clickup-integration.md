# ClickUp Integration

ClickUp is the execution layer for internal work. Medicine Support Hub and Supabase remain the source of truth.

## ClickUp lists
- Medicine Support Hub: 901524225777
- Pilot Governance Actions: 901524225805
- Pilot Milestones and Deliverables: 901524225811
- Partnership Follow-ups: 901524225815
- Platform Reliability and Releases: 901524225826

## Initial synchronization
Create ClickUp tasks for governance actions, overdue milestones, deliverables requiring revision, failed launch checks, partnership follow-ups, and production incidents.

## Allowed data
Program name, platform reference, operational title, owner, priority, due date, non-sensitive status, and platform link.

## Prohibited data
Beneficiary identity, diagnoses, prescriptions, national identifiers, clinical notes, identity documents, and medical attachments.

## Supabase
The clickup_sync_records table stores entity references, task IDs and URLs, synchronization state, timestamps, and errors. It stores no clinical payload.

## Runtime configuration
Store the ClickUp token and list IDs as protected deployment secrets. Never commit tokens to GitHub.
