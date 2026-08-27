# KAM & Medical Rep Field Intelligence Platform

Design note for making Medicine Support Hub useful as a professional knowledge-sharing platform for Key Account Managers, sales, and marketing teams.

Related toolkit: `docs/hospital-channel-toolkit/`

## Purpose

Give field teams:
- reliable seeded knowledge (hospitals, groups, official sources, market access context)
- a simple way to share newly found accounts and field observations
- clear trust labels so unverified notes are never confused with official data
- practical tools (checklists, talking points, HTA primers)

## Knowledge layers

1. **Verified core data** — official or curated sources (EDA, UPA, UHIA, hospital lists, toolkit content)
2. **Field intelligence** — user-contributed, time-stamped, reviewable (contacts, decision structure, formulary observations)
3. **Knowledge tools** — Hospital Channel Toolkit, account planning checklist, talking-point templates

## Verification pipeline (summary)

```text
Ingestion → Normalisation → Deterministic checks → AI claim check (if needed) → Route by status → Human review if needed → Publish with provenance
```

### Statuses

| Status | Meaning |
|--------|---------|
| Verified | Passed checks against trusted sources or human review |
| Field-reported | User contribution; basic checks passed |
| Needs review | Low confidence, conflict, or high-stakes claim |
| Rejected | Failed hard rules or clear contradiction |

High-stakes topics (formulary of competitors, pricing-sensitive notes, clinical claims) default to review more often.

### Provenance fields

- source URL(s) or “field observation”
- contributor
- verification method and date
- confidence
- last reviewed at

## Contributor reputation (summary)

Quality-weighted score, not volume chasing.

Tiers: New → Contributor → Trusted → Expert → Authority

- Earn more points when a note is verified
- Lose points for rejected or later-incorrect entries
- Reputation is a routing signal, never an override of evidence
- Show tier badges; keep raw scores mostly private

## Nudges (professional, not game-like)

- One-tap Quick Note with smart defaults
- Primary action on account pages: “Suggest update”
- Visible last-updated date and one-tap “Still correct / Flag / Update”
- Clear Verified vs Field-reported badges
- Team-level social proof, not individual public leaderboards
- Checklist progress before known visits
- Immediate confirmation after submit

## Safety and compliance

- No patient-identifiable data
- No confidential commercial pricing in shared field notes
- No off-label promotional content
- Distinguish platform onboarding knowledge from professional licences or regulatory certification

## Suggested product surfaces

- Learning Center track: Hospital Channel & Market Access (from the toolkit)
- Internal / professional workspace: account profiles + field notes
- Contextual toolkit cards on major hospital-group pages

## Rollout order

1. Publish toolkit docs (done)
2. Seed trusted hospital / group profiles from public sources
3. Simple contribution form + statuses + provenance
4. Human review queue
5. Reputation + light privileges for Trusted contributors
6. Optional AI claim verification against an official-source allow-list
