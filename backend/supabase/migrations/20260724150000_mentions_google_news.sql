-- =============================================================================
-- Migracja 005: wzmianki z Google News RSS.
--
-- Po co: polityk chce w jednym miejscu widzieć, co się dziś pisze o nim i o
-- jego tematach. Świadomie NIE kupujemy monitoringu mediów (Brand24 i podobne):
-- ich MCP jest per konto użytkownika i nie zasili wielotenantowego backendu, a
-- API jest w najwyższych planach za dopłatą. Google News RSS pokrywa prasę i
-- portale, czyli to, co dla polityka liczy się najbardziej, i kosztuje zero.
--
-- Zakres tej migracji: przechowanie haseł tenanta i pobranych wzmianek.
-- Klasyfikacja tonu (Haiku) jest świadomie odłożona: kolumny `tone`,
-- `classification` i `classified_at` czekają puste, żeby dołożenie pipeline'u
-- nie wymagało kolejnej migracji.
--
-- Kontrakt: docs/kontrakt-wzmianki.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Hasła obserwowane: rozszerzenie istniejącej tabeli topics_watched
-- ---------------------------------------------------------------------------

-- Zapytanie do wyszukiwarki, gdy samo hasło nie wystarcza. Przykład: nazwisko
-- odmienia się przez przypadki, więc `phrase` = "Waldemar Pieniak", a `query` =
-- '"Waldemar Pieniak" OR "Pieniaka" OR "Pieniakowi"'. NULL = użyj `phrase`.
alter table public.topics_watched
  add column if not exists query text;

-- Ile dni wstecz pytamy przy każdym pobraniu (operator `when:Nd` Google News).
-- Krótkie okno na co dzień, dłuższe przy pierwszym pobraniu nowego hasła.
alter table public.topics_watched
  add column if not exists window_days integer not null default 7
  check (window_days between 1 and 30);

alter table public.topics_watched
  add column if not exists last_synced_at timestamptz;

-- Ostatni błąd pobrania. Interfejs pokazuje go wprost przy haśle, zamiast
-- udawać, że hasło działa i nic nie znalazło.
alter table public.topics_watched
  add column if not exists last_sync_error text;

-- Jedno hasło raz na tenant, bez względu na wielkość liter.
create unique index if not exists topics_watched_tenant_phrase_idx
  on public.topics_watched (tenant_id, lower(phrase));

-- ---------------------------------------------------------------------------
-- Wzmianki
-- ---------------------------------------------------------------------------

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  topic_id uuid not null references public.topics_watched (id) on delete cascade,

  -- Skąd wzmianka. Dziś tylko Google News; `rss` zostaje pod własne feedy
  -- z TASK 2, żeby obie ścieżki lądowały w jednej tabeli.
  source text not null default 'google_news'
    check (source in ('google_news', 'rss')),

  -- Identyfikator ze źródła (guid pozycji RSS). Klucz deduplikacji.
  external_id text not null,

  title text not null,
  -- Link Google News jest przekierowaniem (news.google.com/rss/articles/...).
  -- Trzymamy go tak, jak przyszedł: rozwijanie wymaga dodatkowego requestu
  -- i potrafi się psuć, a przekierowanie działa w przeglądarce.
  url text not null,
  snippet text,
  published_at timestamptz,

  -- Nazwa redakcji ze źródła RSS oraz adres jej strony głównej.
  source_name text,
  source_url text,
  -- Dopięcie do bazy mediów (TASK 4). Puste, dopóki nie ma czego dopinać.
  outlet_id uuid references public.outlets (id) on delete set null,

  -- Klasyfikacja tonu: świadomie odłożona, patrz nagłówek migracji.
  tone text check (
    tone is null or tone in ('przychylna', 'krytyczna', 'atak', 'neutralna')
  ),
  classification jsonb not null default '{}',
  classified_at timestamptz,

  read_at timestamptz,
  dismissed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ten sam artykuł może trafić w dwa hasła i ma się pokazać przy obu.
  unique (topic_id, external_id)
);

create index if not exists mentions_tenant_published_idx
  on public.mentions (tenant_id, published_at desc nulls last);

create index if not exists mentions_topic_id_idx
  on public.mentions (topic_id);

create index if not exists mentions_tenant_unread_idx
  on public.mentions (tenant_id, created_at desc)
  where read_at is null and dismissed_at is null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.mentions enable row level security;

create policy "mentions: pelny dostep w tenancie"
  on public.mentions for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create trigger set_updated_at before update on public.mentions
  for each row execute function public.set_updated_at();
