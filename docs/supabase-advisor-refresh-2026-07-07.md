# Supabase advisor refresh - 2026-07-07

## Security advisor themes

Current security advisors still show:

1. Two signed-in-user callable helper functions need a product and security decision.
2. Leaked password protection is disabled and should be enabled from Supabase Auth settings.

No database permissions were changed in this review.

## Performance advisor themes

Current performance advisors show:

1. One new unindexed foreign-key warning on `pharmacy_branches` for `owner_user_id`.
2. Existing RLS init-plan warnings on pilot workflow tables.
3. Existing multiple-policy warnings on several authenticated policies.
4. Existing unused-index informational warnings.

## Recommended order

1. Enable leaked password protection.
2. Add a covering index for the `pharmacy_branches` owner foreign key if that relationship is queried or joined.
3. Fix RLS init-plan warnings in small, reversible migrations.
4. Consolidate duplicate policies only after role behavior is verified.
5. Do not drop unused indexes yet; collect real production usage first.
