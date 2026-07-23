-- =============================================================================
-- Migracja 002: embeddingi 384 (gte-small) + funkcje RPC wyszukiwania wektorowego
--
-- Decyzja TASK 2: model embeddingowy = gte-small przez wbudowane
-- Supabase.ai.Session w Edge Functions (bez zewnetrznego klucza), wymiar 384.
-- Tabele sa puste, wiec zmiana typu kolumn jest bezpieczna; indeksy HNSW
-- trzeba dropnac i odtworzyc (typ kolumny sie zmienia).
--
-- Funkcje RPC (kontrakt docs/kontrakt-task-2-3.md):
--   match_statements(p_tenant_id, p_query_embedding, p_limit)
--   match_sejm_statements(p_query_embedding, p_mp_id, p_limit)
--   match_news_items(p_query_embedding, p_limit)
-- Wszystkie security definer z search_path = ''. match_statements weryfikuje
-- czlonkostwo auth.uid() w tenancie (nie ufa slepo p_tenant_id); wywolania
-- z service_role (Edge Functions) sa przepuszczane.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Zmiana wymiaru embeddingow: vector(1024) -> vector(384)
-- ---------------------------------------------------------------------------

drop index if exists public.journalists_embedding_idx;
drop index if exists public.journalist_materials_embedding_idx;
drop index if exists public.sejm_statements_embedding_idx;
drop index if exists public.news_items_embedding_idx;
drop index if exists public.statements_embedding_idx;

alter table public.journalists alter column embedding type vector(384);
alter table public.journalist_materials alter column embedding type vector(384);
alter table public.sejm_statements alter column embedding type vector(384);
alter table public.news_items alter column embedding type vector(384);
alter table public.statements alter column embedding type vector(384);

create index journalists_embedding_idx on public.journalists
  using hnsw (embedding vector_cosine_ops);
create index journalist_materials_embedding_idx on public.journalist_materials
  using hnsw (embedding vector_cosine_ops);
create index sejm_statements_embedding_idx on public.sejm_statements
  using hnsw (embedding vector_cosine_ops);
create index news_items_embedding_idx on public.news_items
  using hnsw (embedding vector_cosine_ops);
create index statements_embedding_idx on public.statements
  using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- 2. RPC: match_statements — wypowiedzi polityka w tenancie
-- ---------------------------------------------------------------------------

create or replace function public.match_statements(
  p_tenant_id uuid,
  p_query_embedding vector(384),
  p_limit int default 10
)
returns table (
  id uuid,
  text text,
  date date,
  source public.statement_source,
  similarity double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Filtr tenanta: wolno, gdy wywoluje service_role (Edge Function)
  -- albo zalogowany user nalezacy do tenanta. p_tenant_id nie jest zaufane.
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not exists (
       select 1 from public.memberships m
       where m.user_id = auth.uid() and m.tenant_id = p_tenant_id
     )
  then
    raise exception 'Brak dostepu do danych tego tenanta';
  end if;

  return query
  select s.id, s.text, s.date, s.source,
         1 - (s.embedding <=> p_query_embedding) as similarity
  from public.statements s
  where s.tenant_id = p_tenant_id
    and s.embedding is not null
  order by s.embedding <=> p_query_embedding
  limit greatest(1, least(p_limit, 50));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. RPC: match_sejm_statements — globalne stenogramy Sejmu
-- ---------------------------------------------------------------------------

create or replace function public.match_sejm_statements(
  p_query_embedding vector(384),
  p_mp_id int default null,
  p_limit int default 10
)
returns table (
  id uuid,
  mp_id int,
  text text,
  date date,
  similarity double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and auth.uid() is null
  then
    raise exception 'Wymagane zalogowanie';
  end if;

  return query
  select s.id, s.mp_id, s.text, s.date,
         1 - (s.embedding <=> p_query_embedding) as similarity
  from public.sejm_statements s
  where s.embedding is not null
    and (p_mp_id is null or s.mp_id = p_mp_id)
  order by s.embedding <=> p_query_embedding
  limit greatest(1, least(p_limit, 50));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. RPC: match_news_items — globalne artykuly z RSS
-- ---------------------------------------------------------------------------

create or replace function public.match_news_items(
  p_query_embedding vector(384),
  p_limit int default 10
)
returns table (
  id uuid,
  title text,
  url text,
  published_at timestamptz,
  summary text,
  similarity double precision
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and auth.uid() is null
  then
    raise exception 'Wymagane zalogowanie';
  end if;

  return query
  select n.id, n.title, n.url, n.published_at, n.summary,
         1 - (n.embedding <=> p_query_embedding) as similarity
  from public.news_items n
  where n.embedding is not null
  order by n.embedding <=> p_query_embedding
  limit greatest(1, least(p_limit, 50));
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Uprawnienia: tylko authenticated i service_role (anon nie wywola)
-- ---------------------------------------------------------------------------

revoke all on function public.match_statements(uuid, vector, int) from public, anon;
revoke all on function public.match_sejm_statements(vector, int, int) from public, anon;
revoke all on function public.match_news_items(vector, int) from public, anon;

grant execute on function public.match_statements(uuid, vector, int)
  to authenticated, service_role;
grant execute on function public.match_sejm_statements(vector, int, int)
  to authenticated, service_role;
grant execute on function public.match_news_items(vector, int)
  to authenticated, service_role;
