create index if not exists medicine_canonical_products_v1_id_idx
on private.medicine_canonical_products_v1 (
  (((('x'::text || substr(md5(canonical_key), 1, 13)))::bit(52))::bigint)
);
