-- =============================================================================
-- Migracja: programs + program_episodes — archiwum programów publicystycznych.
--
-- Po co: przygotowanie do wywiadu potrzebuje wiedzieć, czym dany program żyje
-- w tym tygodniu i jak prowadzący ustawia rozmowę z politykiem danej formacji.
-- Dotąd Argus modelował redakcje (outlets) i autorów tekstów (journalists),
-- więc prowadzący programu był niewidzialny: Monika Olejnik nie pisze
-- artykułów, a crawl stron autorskich szuka właśnie autorów artykułów.
--
-- Program jest osobnym bytem, nie tagiem przyklejonym do dziennikarza:
-- ma własne pasmo, własną obsadę prowadzących (bywa rotacyjna) i własne
-- archiwum odcinków. Prowadzący jest atrybutem programu, a nie odwrotnie.
--
-- Charakter danych: GLOBALNE, read-only dla zalogowanych (jak journalists,
-- sejm_statements, knowledge_docs). Insert/update wyłącznie service_role,
-- czyli Edge Function argus-ingest (operation program_refresh, adapter
-- _shared/media/programs.ts). Odczyt dla UI: argus-media.
--
-- Źródło i jego granica: strona programu w TVN24 oddaje 24 ostatnie odcinki,
-- a robots.txt blokuje paginację, więc archiwum jest z założenia płytkie.
-- To świadomy zakres funkcji ("ostatnia seria tematów"), nie brak do nadrobienia.
--
-- RODO: to dane zawodowe osób publicznych z publicznej strony nadawcy
-- (gość programu telewizyjnego, temat rozmowy, data emisji). Nie ma tu
-- danych kontaktowych ani prywatnych, więc nie powielamy procesu takedown
-- z tabeli journalists.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Programy
-- ---------------------------------------------------------------------------

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid references public.outlets (id) on delete set null,
  -- Źródło danych, zgodne z nazwą adaptera: 'tvn24', docelowo 'polsatnews'.
  source text not null,
  -- Slug programu u źródła, człon adresu archiwum ('kropka-nad-i').
  slug text not null,
  name text not null,
  -- Prowadzący. Wpisywani ręcznie w adapterze: strona archiwum ich nie podaje.
  hosts text[] not null default '{}',
  archive_url text not null,
  -- Pasmo antenowe, opisowo ('od poniedziałku do czwartku, 20:00').
  schedule_note text,
  last_scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, slug)
);

-- ---------------------------------------------------------------------------
-- 2. Odcinki
-- ---------------------------------------------------------------------------

create table public.program_episodes (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs (id) on delete cascade,
  -- Identyfikator u źródła (człon `vc<id>` w adresie odcinka).
  external_id text not null,
  url text not null,
  -- Temat odcinka: nagłówek ze strony odcinka.
  title text not null,
  -- Goście, po odjęciu tytułów grzecznościowych ('mec.', 'prof.').
  guests text[] not null default '{}',
  published_at timestamptz,
  -- Lead odcinka. Niesie cytaty gościa i listę pozostałych wątków rozmowy.
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Klucz deduplikacji. Indeks jest PEŁNY, nie częściowy, więc w odróżnieniu
  -- od journalists (outlet_id, outlet_author_slug) wolno tu użyć upsertu
  -- z on_conflict: Postgres potrafi go dopasować.
  unique (program_id, external_id)
);

-- ---------------------------------------------------------------------------
-- 3. Indeksy
-- ---------------------------------------------------------------------------

create index programs_source_idx on public.programs (source);
create index program_episodes_program_date_idx
  on public.program_episodes (program_id, published_at desc nulls last);
-- Wyszukiwanie "gdzie ostatnio występował ten polityk" po nazwisku gościa.
create index program_episodes_guests_idx on public.program_episodes using gin (guests);

-- ---------------------------------------------------------------------------
-- 4. Triggery updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.program_episodes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. RLS: globalne read-only dla zalogowanych; zapis tylko service_role
--    (service_role omija RLS, więc brak polityki insert/update jest celowy).
-- ---------------------------------------------------------------------------

alter table public.programs enable row level security;
alter table public.program_episodes enable row level security;

create policy "programs: odczyt dla zalogowanych"
  on public.programs for select to authenticated using (true);

create policy "program_episodes: odczyt dla zalogowanych"
  on public.program_episodes for select to authenticated using (true);
