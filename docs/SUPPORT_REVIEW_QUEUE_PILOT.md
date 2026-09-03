# Support review queue pilot

Closes the implementation half of issue #139.

- Route: `/reviewer/queue`
- Tables: `support_review_queue`, `support_review_events`
- Decision RPC: `decide_support_review_ticket`
- Seed: 10 synthetic tickets (repeats included)
- Not a TPA, not `medicine_enrichment_import_queue`

Apply the migration on the live Supabase project before the page can load tickets:

```
supabase/migrations/20260903_support_review_queue_pilot.sql
```

The connected rehearsal project (`hoxrnwqymvirlhjgcnly`) was inactive when this shipped. Run the SQL on production when that project is the live one.
