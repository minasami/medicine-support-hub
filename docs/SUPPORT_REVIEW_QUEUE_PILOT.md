# Support review queue pilot

Implements issue #139 without growing the platform into a TPA.

## What shipped

- Route: `/reviewer/queue`
- Link from `/reviewer`
- Tables: `support_review_queue`, `support_review_events`
- Decision RPC: `decide_support_review_ticket`
  - reason text required (min 8 characters)
  - approve blocked unless `evidence_ok` is true
  - writes an event row
- Seed: 10 synthetic tickets, including 14-day repeats
- Not a TPA claims system
- Not `medicine_enrichment_import_queue`
- Appwrite stays the catalog cache. The queue of record is Supabase.

## Apply SQL

File:

```
supabase/migrations/20260903_support_review_queue_pilot.sql
```

Connected rehearsal project: `hoxrnwqymvirlhjgcnly` (MSH Medicine Storage Rehearsal).
Live production may be a different Supabase project. Run the same SQL there before the page can load tickets.

## Practice loop (90 days)

1. Open `/reviewer/queue` while signed in.
2. Pick the oldest open ticket.
3. Write one reason sentence: what was in the file, what was missing, rule used.
4. Choose approve / query / decline / wait.
5. Check the event log.
6. Once a week, note median age of open + waiting tickets.
