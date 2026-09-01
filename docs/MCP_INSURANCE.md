# MCP insurance hints (Phase 2)

Read-only local rules plus an optional partner adapter.

Local tools:

- `list_payers`
- `explain_benefit_terms`
- `estimate_patient_share`
- `check_formulary_hint`
- `draft_preauth_checklist`

Partner skeleton (off until `TPA_BASE_URL` + `TPA_API_KEY`):

- `partner_status`
- `partner_coverage_probe` — product name / INN / canonical_id only

Refuses `national_id`, `policy_number`, `member_id`, `card_number`.
Every result sets `not_an_approval: true`.
