-- =============================================================================
-- Migracja 004: Analizy niespójności (kontrakt docs/kontrakt-analizy.md)
--
-- Tabele tenanta: analyses, analysis_documents (RLS per tenant przez
-- app.user_tenant_ids(), triggery updated_at, indeksy).
-- Tabela GLOBALNA: sejm_mp_votes (głosy dowolnego posła; select dla
-- zalogowanych, zapis wyłącznie service_role — jak sejm_votings).
-- Dodatkowo: dedup globalnych sejm_statements po (mp_id, date, hash tekstu),
-- żeby kolejne analizy tego samego posła nie dublowały wystąpień.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabele tenanta
-- ---------------------------------------------------------------------------

create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  topic text not null,
  target_type text not null check (target_type in ('mps', 'club')),
  target_name text not null,
  target_mp_ids integer[] not null default '{}',
  status text not null default 'collecting'
    check (status in ('collecting', 'analyzing', 'ready', 'error')),
  -- Stan porcjowania (collect/analyze) — patrz kontrakt.
  progress jsonb not null default '{}',
  findings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.analysis_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  analysis_id uuid not null references public.analyses (id) on delete cascade,
  filename text not null,
  mime text not null,
  -- Wyekstrahowany tekst, cap 60k znaków (przycinany w Edge Function).
  text text not null,
  chars integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Tabela globalna: głosy posłów (dowolnych, nie tylko polityka tenanta)
-- ---------------------------------------------------------------------------

create table public.sejm_mp_votes (
  id uuid primary key default gen_random_uuid(),
  mp_id integer not null,
  voting_id uuid not null references public.sejm_votings (id) on delete cascade,
  vote public.vote_value not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mp_id, voting_id)
);

-- ---------------------------------------------------------------------------
-- 3. Dedup globalnych sejm_statements: (mp_id, date, hash tekstu)
--    Kolumna generowana + unikalny indeks => upsert z ignorowaniem duplikatów.
-- ---------------------------------------------------------------------------

alter table public.sejm_statements
  add column if not exists text_hash text generated always as (md5(text)) stored;

-- Ewentualne istniejące duplikaty usuwamy przed założeniem unikalnego indeksu.
delete from public.sejm_statements a
using public.sejm_statements b
where a.id > b.id
  and a.mp_id = b.mp_id
  and a.date = b.date
  and a.text_hash = b.text_hash;

create unique index if not exists sejm_statements_dedup_idx
  on public.sejm_statements (mp_id, date, text_hash);

-- Szybki filtr per poseł (retrieval i sprawdzanie zaimportowanych dni).
create index if not exists sejm_statements_mp_date_idx
  on public.sejm_statements (mp_id, date);

-- ---------------------------------------------------------------------------
-- 4. Indeksy
-- ---------------------------------------------------------------------------

create index analyses_tenant_id_idx on public.analyses (tenant_id);
create index analyses_tenant_created_idx
  on public.analyses (tenant_id, created_at desc);
create index analysis_documents_tenant_id_idx
  on public.analysis_documents (tenant_id);
create index analysis_documents_analysis_id_idx
  on public.analysis_documents (analysis_id);
create index sejm_mp_votes_mp_id_idx on public.sejm_mp_votes (mp_id);
create index sejm_mp_votes_voting_id_idx on public.sejm_mp_votes (voting_id);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.analyses enable row level security;
alter table public.analysis_documents enable row level security;
alter table public.sejm_mp_votes enable row level security;

create policy "analyses: pelny dostep w tenancie"
  on public.analyses for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "analysis_documents: pelny dostep w tenancie"
  on public.analysis_documents for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

-- Globalna: odczyt dla zalogowanych, zapis tylko service_role (omija RLS).
create policy "sejm_mp_votes: odczyt dla zalogowanych"
  on public.sejm_mp_votes for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 6. Triggery updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.analyses
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.analysis_documents
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.sejm_mp_votes
  for each row execute function public.set_updated_at();
