create table if not exists public.public_entity_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('medicine', 'company')),
  entity_key text not null check (length(entity_key) between 1 and 180),
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_key)
);

create table if not exists public.public_entity_reactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('medicine', 'company')),
  entity_key text not null check (length(entity_key) between 1 and 180),
  reaction_type text not null default 'like' check (reaction_type in ('like', 'helpful')),
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_key, reaction_type)
);

create table if not exists public.public_entity_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Community member',
  entity_type text not null check (entity_type in ('medicine', 'company')),
  entity_key text not null check (length(entity_key) between 1 and 180),
  parent_id uuid references public.public_entity_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 2 and 2000),
  status text not null default 'published' check (status in ('pending', 'published', 'hidden', 'rejected')),
  moderation_reason text,
  moderated_by uuid references auth.users(id),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists public_entity_comments_lookup_idx on public.public_entity_comments(entity_type, entity_key, status, created_at desc);

create table if not exists public.public_entity_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('medicine', 'company', 'comment')),
  entity_key text not null,
  reason text not null check (reason in ('misinformation', 'unsafe_medical_claim', 'spam', 'abuse', 'impersonation', 'other')),
  details text check (details is null or length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz
);

create table if not exists public.medicine_community_observations (
  id uuid primary key default gen_random_uuid(),
  canonical_id bigint not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Community member',
  observation_type text not null check (observation_type in ('possible_benefit', 'side_effect', 'adverse_effect')),
  title text not null check (length(trim(title)) between 3 and 180),
  description text not null check (length(trim(description)) between 10 and 4000),
  severity text check (severity is null or severity in ('mild', 'moderate', 'severe', 'life_threatening', 'unknown')),
  onset_timing text,
  evidence_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_information')),
  moderation_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists medicine_community_observations_lookup_idx on public.medicine_community_observations(canonical_id, status, created_at desc);

create table if not exists public.company_profile_messages (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default 'Platform member',
  subject text not null check (length(trim(subject)) between 3 and 180),
  body text not null check (length(trim(body)) between 5 and 4000),
  status text not null default 'unread' check (status in ('unread', 'read', 'replied', 'archived', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists company_profile_messages_lookup_idx on public.company_profile_messages(company_slug, status, created_at desc);
