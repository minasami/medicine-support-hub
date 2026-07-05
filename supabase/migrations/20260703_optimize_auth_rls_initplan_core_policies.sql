alter policy profiles_own_read on public.profiles using (id = (select auth.uid()));
alter policy profiles_own_insert on public.profiles with check (id = (select auth.uid()));
alter policy profiles_own_update on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy profiles_admin_read_by_owner on public.profiles using ((select auth.uid()) = '86e55fe9-c9da-40c8-84b1-de5966aa6915'::uuid);
alter policy profiles_admin_update_by_owner on public.profiles using ((select auth.uid()) = '86e55fe9-c9da-40c8-84b1-de5966aa6915'::uuid) with check ((select auth.uid()) = '86e55fe9-c9da-40c8-84b1-de5966aa6915'::uuid);

alter policy patient_requests_own_read on public.medicine_requests using (patient_user_id = (select auth.uid()));
alter policy patient_requests_own_insert on public.medicine_requests with check (
  patient_user_id = (select auth.uid())
  and status = 'pending'::text
  and urgency = any (array['normal'::text, 'critical'::text])
  and char_length(requester_name) between 2 and 150
  and char_length(requester_phone) between 5 and 40
  and jsonb_typeof(medicines) = 'array'::text
  and jsonb_array_length(medicines) between 1 and 20
  and reviewer_notes is null
  and pharmacy_notes is null
  and batch_serial is null
  and bin_location is null
  and package_qr is null
  and coordinator_notes is null
);
alter policy reviewer_requests_read on public.medicine_requests using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role = any (array['admin'::text, 'platform_admin'::text, 'super_admin'::text, 'reviewer'::text])
  )
);
alter policy reviewer_requests_update on public.medicine_requests using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role = any (array['admin'::text, 'platform_admin'::text, 'super_admin'::text, 'reviewer'::text])
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active = true
      and p.role = any (array['admin'::text, 'platform_admin'::text, 'super_admin'::text, 'reviewer'::text])
  )
);

alter policy organizations_admin_all on public.organizations using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true and p.role = 'admin'::text
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true and p.role = 'admin'::text
  )
);
alter policy organization_members_admin_all on public.organization_members using (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true and p.role = 'admin'::text
  )
) with check (
  exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true and p.role = 'admin'::text
  )
);
