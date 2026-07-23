-- =============================================================================
-- Migracja 001: pełny model danych Argus.ai MVP (brief 14, sekcja 3)
-- Tabele globalne (współdzielone, read-only dla klientów) + tabele tenanta
-- (RLS per tenant), triggery updated_at, indeksy (w tym HNSW dla pgvector).
--
-- Embeddingi: vector(1024). Wybór modelu embeddingowego następuje w TASK 2;
-- wymiar można zmienić ALTER-em, dopóki tabele są puste.
-- =============================================================================

create extension if not exists vector;

-- Prywatny schemat na helpery (niedostępny przez API).
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Typy wyliczeniowe (kategorie)
-- ---------------------------------------------------------------------------

create type public.outlet_type as enum ('tv', 'radio', 'portal', 'prasa', 'podcast');
create type public.membership_role as enum ('politician', 'assistant');
create type public.vote_value as enum ('for', 'against', 'abstain', 'absent');
create type public.statement_source as enum ('sejm', 'interview', 'social', 'manual');
create type public.promise_status as enum ('done', 'in_progress', 'at_risk', 'dropped');
create type public.segment_priority as enum ('mobilize', 'persuade', 'ignore');
create type public.brief_status as enum ('generating', 'ready', 'error');
create type public.draft_status as enum ('draft', 'accepted', 'rejected');
create type public.alert_source_type as enum ('brief', 'draft');

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabele globalne
-- ---------------------------------------------------------------------------

create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.outlet_type not null,
  audience_profile jsonb not null default '{}',
  editorial_line jsonb not null default '{}',
  reach_notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journalists (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  outlet_id uuid references public.outlets (id) on delete set null,
  role text,
  topics text[] not null default '{}',
  style_profile jsonb not null default '{}',
  playbook jsonb not null default '{}',
  socials jsonb not null default '{}',
  last_activity_summary text,
  -- RODO: żądanie usunięcia danych (proces takedown, brief sekcja 8)
  takedown_requested boolean not null default false,
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journalist_materials (
  id uuid primary key default gen_random_uuid(),
  journalist_id uuid not null references public.journalists (id) on delete cascade,
  title text not null,
  url text,
  published_at timestamptz,
  summary text,
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sejm_votings (
  id uuid primary key default gen_random_uuid(),
  sitting integer not null,
  voting_no integer not null,
  date date not null,
  title text not null,
  description text,
  topic_tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sitting, voting_no)
);

create table public.sejm_statements (
  id uuid primary key default gen_random_uuid(),
  mp_id integer not null,
  date date not null,
  text text not null,
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references public.outlets (id) on delete set null,
  title text not null,
  url text not null,
  published_at timestamptz,
  summary text,
  topic_tags text[] not null default '{}',
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (url)
);

-- ---------------------------------------------------------------------------
-- Tabele tenanta
-- ---------------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'pilot',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table public.politician_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text not null,
  -- id posła w API Sejmu (nullable: polityk spoza Sejmu)
  mp_id integer,
  district jsonb not null default '{}',
  bio text,
  "values" jsonb not null default '{}',
  boundaries jsonb not null default '{}',
  style_profile jsonb not null default '{}',
  goals jsonb not null default '{}',
  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started', 'importing', 'interview', 'style', 'segments', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create table public.politician_votes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  voting_id uuid not null references public.sejm_votings (id) on delete cascade,
  vote public.vote_value not null,
  explanation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, voting_id)
);

create table public.statements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  source public.statement_source not null,
  date date,
  text text not null,
  url text,
  embedding vector(1024),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.promises (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  text text not null,
  made_at date,
  status public.promise_status not null default 'in_progress',
  defense_line text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  size_estimate integer,
  priority public.segment_priority not null default 'persuade',
  profile jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interview_briefs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  outlet_id uuid references public.outlets (id) on delete set null,
  journalist_id uuid references public.journalists (id) on delete set null,
  scheduled_at timestamptz,
  topic text not null,
  status public.brief_status not null default 'generating',
  content jsonb not null default '{}',
  rating smallint check (rating between 1 and 5),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brief_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  brief_id uuid not null references public.interview_briefs (id) on delete cascade,
  question text not null,
  probability real check (probability between 0 and 1),
  recommended_answer jsonb not null default '{}',
  -- feedback po wywiadzie: czy pytanie padło
  was_asked boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  topic text not null,
  core_message text,
  -- [{segment_id, channel, text}]
  variants jsonb not null default '[]',
  status public.draft_status not null default 'draft',
  consistency_check jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consistency_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  source_type public.alert_source_type not null,
  source_id uuid not null,
  conflict_statement_id uuid references public.statements (id) on delete set null,
  description text not null,
  suggested_response text,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  journalist_id uuid references public.journalists (id) on delete set null,
  transcript jsonb not null default '[]',
  score jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.morning_briefs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  date date not null,
  content jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, date)
);

create table public.topics_watched (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  phrase text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Logi dostępu do danych tenanta (RODO, brief sekcja 8). Zapis wyłącznie
-- z Edge Functions (service_role); klienci nie mają żadnych polityk.
create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  resource text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper RLS: tenanty zalogowanego użytkownika.
-- SECURITY DEFINER omija RLS na memberships (brak rekurencji polityk).
-- ---------------------------------------------------------------------------

create or replace function app.user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tenant_id from public.memberships where user_id = auth.uid();
$$;

revoke all on function app.user_tenant_ids() from public;
grant usage on schema app to authenticated;
grant execute on function app.user_tenant_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: tabele globalne (select dla zalogowanych; zapis tylko service_role,
-- który omija RLS)
-- ---------------------------------------------------------------------------

alter table public.outlets enable row level security;
alter table public.journalists enable row level security;
alter table public.journalist_materials enable row level security;
alter table public.sejm_votings enable row level security;
alter table public.sejm_statements enable row level security;
alter table public.news_items enable row level security;

create policy "outlets: odczyt dla zalogowanych"
  on public.outlets for select to authenticated using (true);

-- Dziennikarze z aktywnym żądaniem takedown znikają z odczytu klientów.
create policy "journalists: odczyt dla zalogowanych"
  on public.journalists for select to authenticated using (takedown_requested = false);

create policy "journalist_materials: odczyt dla zalogowanych"
  on public.journalist_materials for select to authenticated using (true);

create policy "sejm_votings: odczyt dla zalogowanych"
  on public.sejm_votings for select to authenticated using (true);

create policy "sejm_statements: odczyt dla zalogowanych"
  on public.sejm_statements for select to authenticated using (true);

create policy "news_items: odczyt dla zalogowanych"
  on public.news_items for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- RLS: tabele tenanta
-- ---------------------------------------------------------------------------

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.politician_profiles enable row level security;
alter table public.politician_votes enable row level security;
alter table public.statements enable row level security;
alter table public.promises enable row level security;
alter table public.segments enable row level security;
alter table public.interview_briefs enable row level security;
alter table public.brief_questions enable row level security;
alter table public.content_drafts enable row level security;
alter table public.consistency_alerts enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.morning_briefs enable row level security;
alter table public.topics_watched enable row level security;
alter table public.access_logs enable row level security;

-- Konta zakładane ręcznie w MVP: insert do tenants/memberships tylko service_role.
create policy "tenants: odczyt swoich"
  on public.tenants for select to authenticated
  using (id in (select app.user_tenant_ids()));

create policy "tenants: edycja swoich"
  on public.tenants for update to authenticated
  using (id in (select app.user_tenant_ids()))
  with check (id in (select app.user_tenant_ids()));

create policy "memberships: odczyt w swoim tenancie"
  on public.memberships for select to authenticated
  using (tenant_id in (select app.user_tenant_ids()));

create policy "politician_profiles: pelny dostep w tenancie"
  on public.politician_profiles for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "politician_votes: pelny dostep w tenancie"
  on public.politician_votes for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "statements: pelny dostep w tenancie"
  on public.statements for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "promises: pelny dostep w tenancie"
  on public.promises for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "segments: pelny dostep w tenancie"
  on public.segments for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "interview_briefs: pelny dostep w tenancie"
  on public.interview_briefs for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "brief_questions: pelny dostep w tenancie"
  on public.brief_questions for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "content_drafts: pelny dostep w tenancie"
  on public.content_drafts for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "consistency_alerts: pelny dostep w tenancie"
  on public.consistency_alerts for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "practice_sessions: pelny dostep w tenancie"
  on public.practice_sessions for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "morning_briefs: pelny dostep w tenancie"
  on public.morning_briefs for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "topics_watched: pelny dostep w tenancie"
  on public.topics_watched for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

-- access_logs: brak polityk dla authenticated = pełna blokada (tylko service_role).

-- ---------------------------------------------------------------------------
-- Triggery updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.outlets
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.journalists
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.journalist_materials
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sejm_votings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sejm_statements
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.news_items
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.politician_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.politician_votes
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.statements
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.promises
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.segments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.interview_briefs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.brief_questions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.content_drafts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.consistency_alerts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.practice_sessions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.morning_briefs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.topics_watched
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Indeksy
-- ---------------------------------------------------------------------------

-- Globalne: FK, daty, tagi, wektory (HNSW, cosine)
create index journalists_outlet_id_idx on public.journalists (outlet_id);
create index journalists_topics_idx on public.journalists using gin (topics);
create index journalists_embedding_idx on public.journalists
  using hnsw (embedding vector_cosine_ops);

create index journalist_materials_journalist_id_idx
  on public.journalist_materials (journalist_id, published_at desc);
create index journalist_materials_embedding_idx on public.journalist_materials
  using hnsw (embedding vector_cosine_ops);

create index sejm_votings_date_idx on public.sejm_votings (date desc);
create index sejm_votings_topic_tags_idx on public.sejm_votings using gin (topic_tags);

create index sejm_statements_mp_id_date_idx on public.sejm_statements (mp_id, date desc);
create index sejm_statements_embedding_idx on public.sejm_statements
  using hnsw (embedding vector_cosine_ops);

create index news_items_outlet_id_idx on public.news_items (outlet_id);
create index news_items_published_at_idx on public.news_items (published_at desc);
create index news_items_topic_tags_idx on public.news_items using gin (topic_tags);
create index news_items_embedding_idx on public.news_items
  using hnsw (embedding vector_cosine_ops);

-- Tenant: memberships + tenant_id wszędzie + daty/statusy pod listy
create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_tenant_id_idx on public.memberships (tenant_id);

create index politician_profiles_tenant_id_idx on public.politician_profiles (tenant_id);
create index politician_votes_tenant_id_idx on public.politician_votes (tenant_id);
create index politician_votes_voting_id_idx on public.politician_votes (voting_id);

create index statements_tenant_id_date_idx on public.statements (tenant_id, date desc);
create index statements_embedding_idx on public.statements
  using hnsw (embedding vector_cosine_ops);

create index promises_tenant_id_idx on public.promises (tenant_id);
create index segments_tenant_id_idx on public.segments (tenant_id);

create index interview_briefs_tenant_id_idx
  on public.interview_briefs (tenant_id, scheduled_at desc);
create index brief_questions_brief_id_idx on public.brief_questions (brief_id);
create index brief_questions_tenant_id_idx on public.brief_questions (tenant_id);

create index content_drafts_tenant_id_idx on public.content_drafts (tenant_id, created_at desc);

create index consistency_alerts_tenant_id_idx
  on public.consistency_alerts (tenant_id, resolved, created_at desc);

create index practice_sessions_tenant_id_idx on public.practice_sessions (tenant_id);
create index morning_briefs_tenant_id_date_idx on public.morning_briefs (tenant_id, date desc);
create index topics_watched_tenant_id_idx on public.topics_watched (tenant_id);
create index access_logs_tenant_id_idx on public.access_logs (tenant_id, created_at desc);
