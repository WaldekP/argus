-- =============================================================================
-- Migracja 003: poprawka funkcji RPC wyszukiwania wektorowego.
-- Przy security definer z search_path = '' operator <=> (pgvector, schemat
-- public) nie jest znajdowany. Zapis jawny: operator(public.<=>).
-- =============================================================================

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
         1 - (s.embedding operator(public.<=>) p_query_embedding) as similarity
  from public.statements s
  where s.tenant_id = p_tenant_id
    and s.embedding is not null
  order by s.embedding operator(public.<=>) p_query_embedding
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
         1 - (s.embedding operator(public.<=>) p_query_embedding) as similarity
  from public.sejm_statements s
  where s.embedding is not null
    and (p_mp_id is null or s.mp_id = p_mp_id)
  order by s.embedding operator(public.<=>) p_query_embedding
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
         1 - (n.embedding operator(public.<=>) p_query_embedding) as similarity
  from public.news_items n
  where n.embedding is not null
  order by n.embedding operator(public.<=>) p_query_embedding
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
