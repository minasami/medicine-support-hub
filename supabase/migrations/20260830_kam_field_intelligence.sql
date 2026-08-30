-- Hospital-channel field intelligence: account shells, notes, provenance.
-- Seed profiles stay conservative and public. Field notes are attributable.

create table if not exists public.hospital_accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text,
  account_type text not null check (account_type in (
    'private_hospital_group','private_hospital','specialist_foundation',
    'public_academic_category','public_category','other'
  )),
  geography text[] not null default '{}',
  example_sites text[] not null default '{}',
  kam_relevance text,
  sources text[] not null default '{}',
  status text not null default 'verified' check (status in ('verified','field-reported','needs-review','rejected')),
  last_reviewed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_field_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.hospital_accounts(id) on delete cascade,
  contributor_id uuid references auth.users(id) on delete set null,
  note_type text not null default 'field_observation' check (note_type in (
    'field_observation','suggest_update','flag_outdated'
  )),
  body text not null check (char_length(body) between 8 and 2000),
  decision_layer text check (decision_layer in ('group','hospital','specialty','operational','unknown')),
  role_mentioned text,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  source_url text,
  observed_on date not null default current_date,
  status text not null default 'needs-review' check (status in ('verified','field-reported','needs-review','rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hospital_field_notes_account_idx on public.hospital_field_notes(account_id, created_at desc);
create index if not exists hospital_field_notes_status_idx on public.hospital_field_notes(status, created_at desc);

alter table public.hospital_accounts enable row level security;
alter table public.hospital_field_notes enable row level security;
revoke all on public.hospital_accounts, public.hospital_field_notes from anon, authenticated;
grant select on public.hospital_accounts to anon, authenticated;
grant select on public.hospital_field_notes to authenticated;
grant insert on public.hospital_field_notes to authenticated;
grant all on public.hospital_accounts, public.hospital_field_notes to service_role;

drop policy if exists hospital_accounts_public_read on public.hospital_accounts;
create policy hospital_accounts_public_read on public.hospital_accounts
  for select to anon, authenticated
  using (status in ('verified','field-reported'));

drop policy if exists hospital_field_notes_read_published on public.hospital_field_notes;
create policy hospital_field_notes_read_published on public.hospital_field_notes
  for select to authenticated
  using (status in ('verified','field-reported') or contributor_id = (select auth.uid()));

drop policy if exists hospital_field_notes_insert_own on public.hospital_field_notes;
create policy hospital_field_notes_insert_own on public.hospital_field_notes
  for insert to authenticated
  with check (contributor_id = (select auth.uid()));

insert into public.hospital_accounts(slug,name_en,name_ar,account_type,geography,example_sites,kam_relevance,sources,status,last_reviewed_at)
values
('cleopatra-hospitals-group','Cleopatra Hospitals Group','مجموعة مستشفيات كليوباترا','private_hospital_group',array['Cairo','Giza','Suez'],array['Cleopatra Hospital Heliopolis','Cairo Specialized Hospital','Nile Badrawi Hospital','Al Shorouk Hospital','El Katib Hospital','Cleopatra October','Cleopatra El Tagamoa'],'Largest listed private hospital group; plan both group and site layers.',array['https://www.cleopatrahospitals.com/en'],'verified','2026-08-30'),
('alameda-healthcare','Alameda Healthcare','ألاميدا للرعاية الصحية','private_hospital_group',array['Cairo','Giza'],array['Dar Al Fouad 6th of October','Dar Al Fouad Nasr City','As-Salam International Hospital'],'Strategic private accounts with group-level decisions.','{}','verified','2026-08-30'),
('saudi-german-hospitals-egypt','Saudi German Hospitals Egypt','السعودي الألماني مصر','private_hospital_group',array['Cairo'],array['Saudi German Hospital Cairo'],'International-brand private channel; protocol and quality documentation often requested.','{}','verified','2026-08-30'),
('andalusia-group-egypt','Andalusia / Andaluseya Group','مجموعة الأندلسية','private_hospital_group',array['Cairo','Alexandria'],'{}','Multi-city private group; confirm current sites before planning visits.','{}','field-reported','2026-08-30'),
('magdi-yacoub-heart-foundation','Magdi Yacoub Heart Foundation','مؤسسة مجدي يعقوب للقلب','specialist_foundation',array['Aswan','Cairo'],array['Magdi Yacoub Heart Centre Aswan'],'Specialist cardiac protocols and high clinical standards.','{}','verified','2026-08-30'),
('university-hospitals-egypt','University Hospitals (category)','المستشفيات الجامعية','public_academic_category',array['National'],'{}','Protocol and committee driven; digitization and UHI linkage increasing.','{}','verified','2026-08-30'),
('mohp-public-hospitals-egypt','MoHP / public hospitals (category)','مستشفيات وزارة الصحة','public_category',array['National'],'{}','UPA procurement is the main public volume lever; site adoption still matters.','{}','verified','2026-08-30')
on conflict (slug) do update set
  name_en=excluded.name_en,
  name_ar=excluded.name_ar,
  account_type=excluded.account_type,
  geography=excluded.geography,
  example_sites=excluded.example_sites,
  kam_relevance=excluded.kam_relevance,
  sources=excluded.sources,
  status=excluded.status,
  last_reviewed_at=excluded.last_reviewed_at;
