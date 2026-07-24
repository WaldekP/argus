-- =============================================================================
-- Migracja: Tematy — dossier tematyczny (spec docs/superpowers/specs/
-- 2026-07-24-tematy-dossier-design.md)
--
-- Polityk (tenant) wgrywa grubą analizę (NotebookLM, PDF/MD/TXT), a Argus robi
-- z niej dossier do self-briefingu: podsumowanie, kluczowe liczby, przewidywane
-- pytania (dziennikarze + rywale) z odpowiedziami oraz linie ataku i obrony.
--
-- Tabele tenanta: topics, topic_documents (RLS per tenant przez
-- app.user_tenant_ids(), triggery updated_at, indeksy). Grounding wyłącznie
-- z wgranych dokumentów — brak danych globalnych.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabele tenanta
-- ---------------------------------------------------------------------------

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'error')),
  -- Stan porcjowania generacji (faza dossier) — patrz spec.
  progress jsonb not null default '{}',
  -- Wygenerowane dossier: summary, key_numbers[], questions[], attack_defense.
  dossier jsonb not null default '{}',
  -- Suma znaków źródeł (meta do UI).
  source_chars integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topic_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  filename text not null,
  mime text not null,
  -- Wyekstrahowany tekst, cap 60k znaków (przycinany w Edge Function).
  text text not null,
  chars integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Indeksy
-- ---------------------------------------------------------------------------

create index topics_tenant_id_idx on public.topics (tenant_id);
create index topics_tenant_created_idx
  on public.topics (tenant_id, created_at desc);
create index topic_documents_tenant_id_idx
  on public.topic_documents (tenant_id);
create index topic_documents_topic_id_idx
  on public.topic_documents (topic_id);

-- ---------------------------------------------------------------------------
-- 3. RLS (pełny dostęp wyłącznie w obrębie tenanta usera)
-- ---------------------------------------------------------------------------

alter table public.topics enable row level security;
alter table public.topic_documents enable row level security;

create policy "topics: pelny dostep w tenancie"
  on public.topics for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "topic_documents: pelny dostep w tenancie"
  on public.topic_documents for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

-- ---------------------------------------------------------------------------
-- 4. Triggery updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.topics
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.topic_documents
  for each row execute function public.set_updated_at();
