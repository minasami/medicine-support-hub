revoke select on public.marketplace_seller_profiles from anon;
grant select (
  id, seller_slug, display_name, seller_type, description, logo_url,
  country, city, address, contact_email, contact_phone, website_url,
  service_areas, fulfillment_modes, advantages, payment_terms,
  license_authority, license_expiry, verification_status, is_public, verified_at
) on public.marketplace_seller_profiles to anon;

revoke select on public.marketplace_medicine_offers from anon;
grant select (
  id, seller_profile_id, canonical_id, seller_sku, offer_title,
  unit_price_egp, list_price_egp, minimum_order_quantity, packaging,
  stock_status, lead_time_days, minimum_expiry_months, delivery_scope,
  advantages, payment_terms, cold_chain_supported, prescription_handling,
  status, published_at
) on public.marketplace_medicine_offers to anon;
