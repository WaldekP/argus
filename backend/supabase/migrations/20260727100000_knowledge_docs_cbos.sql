-- =============================================================================
-- Migracja: knowledge_docs — globalna baza badan opinii publicznej (CBOS + ...)
--
-- Zrodlo: narzedzie tools/cbos-crawler kataloguje komunikaty CBOS, rozczytuje
-- PDF i strukturyzuje je w badania (typ Badanie), po czym eksportuje payload.
-- Operacja load_knowledge w Edge Function argus-ingest liczy embeddingi
-- (Supabase.ai gte-small, wymiar 384 — wylacznie server-side) i wstawia tutaj.
--
-- Charakter danych: GLOBALNE, read-only dla zalogowanych (jak news_items,
-- sejm_statements). Insert/update wylacznie service_role (Edge Function).
-- Zrodlo `source` przewidziane pod wiele instytutow (CBOS teraz, Eurobarometer
-- pozniej) — architektura pluggable po stronie crawlera i tej tabeli.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabela globalna
-- ---------------------------------------------------------------------------

create table public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  -- Instytut / zrodlo badania: 'CBOS', docelowo 'Eurobarometer', ...
  source text not null,
  -- Identyfikator u zrodla, np. numer komunikatu "79/2026". Unikalny w obrebie source.
  external_id text not null,
  title text not null,
  report_url text,
  pdf_url text,
  pub_date date,
  author text,
  year int,
  -- Tagi klastrow tematycznych z crawlera (np. 'obronnosc-ukraina').
  topic_tags text[] not null default '{}',
  -- Slugi tematow Argusa (knowledge/topics), do ktorych badanie pasuje.
  topic_slugs text[] not null default '{}',
  -- Streszczenie z listingu CBOS (niesie kluczowe procenty).
  summary text,
  -- Ustrukturyzowane badanie (wynik etapu AI): przydatny, badania[] z wynikami.
  structured jsonb not null default '{}',
  -- Pelny rozczytany tekst (zrodlo pod embedding i cytowanie).
  content text,
  -- sha256 tresci PDF — klucz dedup miedzy przebiegami crawlera.
  content_hash text not null,
  embedding vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, external_id)
);

-- ---------------------------------------------------------------------------
-- 2. Indeksy
-- ---------------------------------------------------------------------------

create unique index knowledge_docs_content_hash_idx
  on public.knowledge_docs (content_hash);
create index knowledge_docs_source_idx on public.knowledge_docs (source);
create index knowledge_docs_topic_slugs_idx
  on public.knowledge_docs using gin (topic_slugs);
create index knowledge_docs_embedding_idx on public.knowledge_docs
  using hnsw (embedding vector_cosine_ops);

create trigger set_updated_at before update on public.knowledge_docs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS: globalne read-only dla zalogowanych; zapis tylko service_role
--    (service_role omija RLS, wiec brak polityki insert/update jest celowy).
-- ---------------------------------------------------------------------------

alter table public.knowledge_docs enable row level security;

create policy "knowledge_docs: odczyt dla zalogowanych"
  on public.knowledge_docs for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 4. RPC: match_knowledge_docs — wyszukiwanie wektorowe po badaniach,
--    opcjonalnie zawezone do jednego tematu Argusa.
-- ---------------------------------------------------------------------------

create or replace function public.match_knowledge_docs(
  p_query_embedding vector(384),
  p_topic_slug text default null,
  p_limit int default 10
)
returns table (
  id uuid,
  source text,
  external_id text,
  title text,
  pub_date date,
  summary text,
  structured jsonb,
  topic_slugs text[],
  similarity double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Dane globalne: wolno service_role (Edge Function) albo zalogowanemu userowi.
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and auth.uid() is null
  then
    raise exception 'Wymagane zalogowanie';
  end if;

  return query
  select d.id, d.source, d.external_id, d.title, d.pub_date, d.summary,
         d.structured, d.topic_slugs,
         1 - (d.embedding <=> p_query_embedding) as similarity
  from public.knowledge_docs d
  where d.embedding is not null
    and (p_topic_slug is null or p_topic_slug = any (d.topic_slugs))
  order by d.embedding <=> p_query_embedding
  limit greatest(1, least(p_limit, 50));
end;
$$;

grant execute on function public.match_knowledge_docs(vector, text, int) to authenticated, service_role;
