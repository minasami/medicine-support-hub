grant usage on schema private to authenticated, service_role;
grant execute on function private.review_industry_company_claim(uuid, text, text) to authenticated, service_role;
grant execute on function private.review_industry_company_contribution(uuid, text, text) to authenticated, service_role;
