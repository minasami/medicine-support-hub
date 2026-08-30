-- Unified KAM key accounts: pharmacy chains, insurers, TPAs, public payers.
-- Complements hospital_accounts. Field notes are attributable and public-safe.

create table if not exists public.kam_key_accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null,
  name_ar text,
  account_type text not null check (account_type in (
    'pharmacy_chain','insurer','tpa','phi_program','public_payer','other'
  )),
  geography text[] not null default '{}',
  public_hotline text,
  website text,
  related_slugs text[] not null default '{}',
  kam_relevance text,
  sources text[] not null default '{}',
  status text not null default 'verified' check (status in ('verified','field-reported','needs-review','rejected')),
  last_reviewed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kam_field_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.kam_key_accounts(id) on delete cascade,
  contributor_id uuid references auth.users(id) on delete set null,
  note_type text not null default 'field_observation' check (note_type in (
    'field_observation','suggest_update','flag_outdated'
  )),
  body text not null check (char_length(body) between 8 and 2000),
  decision_layer text check (decision_layer in (
    'group','hq','region','branch','medical','commercial','network','claims','unknown'
  )),
  role_mentioned text,
  confidence text not null default 'medium' check (confidence in ('low','medium','high')),
  source_url text,
  observed_on date not null default current_date,
  status text not null default 'needs-review' check (status in ('verified','field-reported','needs-review','rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kam_key_accounts_type_idx on public.kam_key_accounts(account_type, status);
create index if not exists kam_field_notes_account_idx on public.kam_field_notes(account_id, created_at desc);

alter table public.kam_key_accounts enable row level security;
alter table public.kam_field_notes enable row level security;
revoke all on public.kam_key_accounts, public.kam_field_notes from anon, authenticated;
grant select on public.kam_key_accounts to anon, authenticated;
grant select, insert on public.kam_field_notes to authenticated;
grant all on public.kam_key_accounts, public.kam_field_notes to service_role;

drop policy if exists kam_key_accounts_public_read on public.kam_key_accounts;
create policy kam_key_accounts_public_read on public.kam_key_accounts
  for select to anon, authenticated
  using (status in ('verified','field-reported'));

drop policy if exists kam_field_notes_read_published on public.kam_field_notes;
create policy kam_field_notes_read_published on public.kam_field_notes
  for select to authenticated
  using (status in ('verified','field-reported') or contributor_id = (select auth.uid()));

drop policy if exists kam_field_notes_insert_own on public.kam_field_notes;
create policy kam_field_notes_insert_own on public.kam_field_notes
  for insert to authenticated
  with check (contributor_id = (select auth.uid()));

insert into public.kam_key_accounts(
  slug,name_en,name_ar,account_type,geography,public_hotline,website,related_slugs,kam_relevance,status,last_reviewed_at
) values
('el-ezaby-pharmacies','El Ezaby Pharmacies','صيدليات العزبي','pharmacy_chain',array['National'],'19600','https://elezabypharmacy.com/','{}','Largest national retail chain; central listing and availability drive cash and many insured collections.','verified','2026-08-30'),
('seif-pharmacies','Seif Pharmacies','صيدليات سيف','pharmacy_chain',array['National'],'19199',null,'{}','Major chain with strong Greater Cairo presence and digital ordering.','verified','2026-08-30'),
('misr-pharmacies','Misr Pharmacies','صيدليات مصر','pharmacy_chain',array['National'],'19110',null,'{}','National chain; useful for both retail listing and insured-patient collection.','verified','2026-08-30'),
('roshdy-pharmacies','Roshdy Pharmacies','صيدليات رشدي','pharmacy_chain',array['National'],'19661',null,'{}','Visible chain brand; confirm current central vs franchise decision model before planning.','verified','2026-08-30'),
('orange-pharmacies','Orange Pharmacies','صيدليات أورانج','pharmacy_chain',array['National'],'19001',null,'{}','Chain listing for retail availability in selected governorates.','verified','2026-08-30'),
('ali-and-ali-pharmacies','Ali and Ali Pharmacies','صيدليات علي وعلي','pharmacy_chain',array['National'],'19905',null,'{}','Chain coverage; verify current branch footprint in the assigned territory.','verified','2026-08-30'),
('ezz-el-din-pharmacies','Ezz El Din Pharmacies','صيدليات عز الدين','pharmacy_chain',array['National'],'16097',null,'{}','Regional/national chain presence; useful for availability follow-up.','verified','2026-08-30'),
('al-tayeby-pharmacies','Al Tayeby Pharmacies','صيدليات الطيبي','pharmacy_chain',array['National'],null,null,'{}','Growing mid-size chain; often regional supervisors matter as much as HQ.','field-reported','2026-08-30'),
('uhia','Universal Health Insurance Authority','الهيئة العامة للتأمين الصحي','public_payer',array['National'],null,null,'{}','Public benefit packages and reimbursement. Not PHI, but it changes private hospital and pharmacy behaviour as coverage expands.','verified','2026-08-30'),
('allianz-egypt','Allianz Egypt','أليانز مصر','insurer',array['National'],null,'https://www.allianz.com.eg/',array['nextcare'],'Major PHI player. Medical network and approvals often run with Nextcare.','verified','2026-08-30'),
('axa-egypt','AXA Egypt','أكسا مصر','insurer',array['National'],null,null,'{}','Large corporate and individual medical portfolios; network and claims rules vary by plan.','verified','2026-08-30'),
('metlife-egypt','MetLife Egypt','ميتلايف مصر','insurer',array['National'],null,null,'{}','Strong group medical and life-linked corporate schemes.','verified','2026-08-30'),
('bupa-egypt','Bupa Egypt','بوبا مصر','insurer',array['National'],null,null,'{}','Premium medical insurance; network quality and protocol expectations are typically high.','verified','2026-08-30'),
('misr-insurance','Misr Insurance / Misr Life','مصر للتأمين / مصر لتأمينات الحياة','insurer',array['National'],null,null,'{}','Large local insurer; medical portfolios sit alongside general and life business.','verified','2026-08-30'),
('gig-egypt','GIG Egypt','جي آي جي مصر','insurer',array['National'],null,null,'{}','Active general and medical market participant; confirm current TPA partner per scheme.','verified','2026-08-30'),
('nextcare','Nextcare','نكست كير','tpa',array['National'],null,null,array['allianz-egypt'],'TPA / network manager used by Allianz Egypt Health Plus and other schemes. Approvals and pharmacy panel matter as much as the insurer brand.','verified','2026-08-30'),
('mednet-egypt','MedNet Egypt','ميدنت مصر','tpa',array['National'],null,null,'{}','Regional TPA model active in Egypt; confirm which insurer clients and pharmacy panels apply in your territory.','field-reported','2026-08-30'),
('globemed-egypt','GlobeMed Egypt','جلوب ميد مصر','tpa',array['National'],null,null,'{}','Regional TPA / network operator; map the insurer client before assuming one national formulary.','field-reported','2026-08-30')
on conflict (slug) do update set
  name_en=excluded.name_en,
  name_ar=excluded.name_ar,
  account_type=excluded.account_type,
  geography=excluded.geography,
  public_hotline=excluded.public_hotline,
  website=excluded.website,
  related_slugs=excluded.related_slugs,
  kam_relevance=excluded.kam_relevance,
  status=excluded.status,
  last_reviewed_at=excluded.last_reviewed_at;
