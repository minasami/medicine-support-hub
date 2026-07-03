# ClickUp Integration

ClickUp complements Medicine Support Hub as an operational execution layer. It must not become a clinical or beneficiary data store.

## Source of truth

Supabase remains authoritative for beneficiaries, support requests, programs, budgets, pilot data, governance records, and impact metrics.

ClickUp is limited to team execution:

- governance actions
- overdue milestones
- deliverable revisions
- launch-readiness gaps
- partnership follow-ups

## Privacy boundary

Never send beneficiary names, diagnoses, prescriptions, identity documents, medical attachments, or detailed clinical notes to ClickUp.

## Synchronization record

The `clickup_sync_records` table tracks:

- source entity type and ID
- organization and program
- task title, priority, and due date
- ClickUp task ID and URL
- synchronization status
- last synchronization time
- last error

## Initial synchronization flow

1. The platform creates a pending synchronization record.
2. A trusted server-side worker creates the ClickUp task.
3. The worker stores the task ID and URL.
4. Failures remain visible through `sync_status` and `last_error`.
5. Every ClickUp task links back to the source platform record.

## Configuration

The server-side worker will require secrets for:

- `CLICKUP_API_TOKEN`
- `CLICKUP_WORKSPACE_ID`
- `CLICKUP_LIST_ID`

Secrets must never be committed to GitHub or exposed to the browser.

## Rollout

Phase 1 is one-way synchronization from Medicine Support Hub to ClickUp. Two-way status and due-date synchronization should only be introduced after audit logging, retry handling, and conflict rules are verified.
