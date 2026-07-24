-- =============================================================================
-- Migracja 004: rejestr sądowy (KRS) jako źródło powiązań kapitałowych.
--
-- Dwa źródła, świadomie rozdzielone:
--   1. Otwarte API KRS Ministerstwa Sprawiedliwości (api-krs.ms.gov.pl) —
--      darmowe, ale dane osób fizycznych są zamaskowane ("K*******").
--      Używamy go wyłącznie do WYKRYWANIA ZMIAN (biuletyn dzienny).
--   2. Rejestr.io API (rejestr.io/api/v2) — płatne per wywołanie, ma nazwiska
--      i gotową sieć powiązań osoba <-> organizacja. Używamy go do TREŚCI.
--
-- Zasada kosztowa: darmowy biuletyn mówi "coś się zmieniło w KRS X",
-- płatne Rejestr.io wołamy tylko dla obserwowanych podmiotów.
-- Kontrakt: docs/kontrakt-rejestr-krs.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Typy wyliczeniowe
-- ---------------------------------------------------------------------------

-- Do czego w Argusie przypięta jest tożsamość z KRS.
create type public.registry_subject_type as enum (
  'politician',  -- polityk tenanta (politician_profiles)
  'journalist',  -- dziennikarz z bazy mediów (journalists)
  'outlet',      -- redakcja / wydawca (outlets)
  'other'        -- podmiot obserwowany ad hoc (np. kontrahent, fundacja)
);

-- Status dopasowania osoby. Nigdy nie ustawiamy 'confirmed' automatycznie:
-- wyszukiwanie po imieniu i nazwisku zwraca imienników, a przypisanie
-- cudzych spółek politykowi to zniesławienie, nie bug.
create type public.registry_match_status as enum (
  'candidate',   -- kandydat z wyszukiwania, nikt tego nie potwierdził
  'confirmed',   -- człowiek potwierdził, że to ta sama osoba
  'rejected'     -- człowiek odrzucił, nie pokazujemy ponownie
);

-- ---------------------------------------------------------------------------
-- Tabele globalne: cache rejestru (read-only dla klientów)
-- ---------------------------------------------------------------------------

-- Organizacja z KRS. Klucz naturalny: numer KRS jako tekst z wiodącymi zerami.
create table public.registry_orgs (
  krs text primary key check (krs ~ '^[0-9]{10}$'),
  rejestrio_id bigint unique,
  name_full text not null,
  name_short text,
  nip text,
  regon text,
  legal_form text,
  -- Dział przeważającej działalności (PKD) w formie opisowej z Rejestr.io.
  -- Podstawa heurystyki konfliktu interesów: temat wypowiedzi vs branża.
  pkd_main_section text,
  address jsonb not null default '{}',
  -- Flagi stanu: wykreślona, w likwidacji, spółka Skarbu Państwa, OPP, GPW...
  status jsonb not null default '{}',
  -- Pełna odpowiedź źródła, na wypadek pól, których jeszcze nie mapujemy.
  raw jsonb not null default '{}',
  source text not null default 'rejestrio' check (source in ('rejestrio', 'krs_open')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Osoba fizyczna występująca w KRS (dane z Rejestr.io; otwarte API ich nie ma).
create table public.registry_persons (
  rejestrio_id bigint primary key,
  first_name text not null,
  middle_names text,
  last_name text not null,
  full_name text not null,
  -- Liczniki powiązań ze źródła: pozwalają pokazać "0 powiązań" bez płatnego
  -- wywołania o szczegóły.
  connections_current integer not null default 0,
  connections_past integer not null default 0,
  raw jsonb not null default '{}',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Powiązanie osoba -> organizacja (zarząd, wspólnik, rada nadzorcza, prokura).
-- role_type bez CHECK: Rejestr.io może dodać typ, a nieznany typ ma trafić do
-- bazy i wyświetlić się surowo, zamiast wywalić import.
create table public.registry_connections (
  id uuid primary key default gen_random_uuid(),
  person_id bigint not null references public.registry_persons (rejestrio_id) on delete cascade,
  org_krs text not null references public.registry_orgs (krs) on delete cascade,
  role_type text not null,
  direction text,
  date_start date,
  date_end date,
  is_current boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (person_id, org_krs, role_type, date_start)
);

create index registry_connections_person_idx on public.registry_connections (person_id);
create index registry_connections_org_idx on public.registry_connections (org_krs);

-- ---------------------------------------------------------------------------
-- Tabele tenanta
-- ---------------------------------------------------------------------------

-- Przypisanie tożsamości z KRS do bytu w Argusie. To jest miejsce, w którym
-- człowiek bierze odpowiedzialność za dopasowanie.
create table public.registry_subjects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subject_type public.registry_subject_type not null,
  -- Id bytu w Argusie: politician_profiles.id, journalists.id, outlets.id.
  -- Null dla 'other' (podmiot obserwowany bez odpowiednika w bazie).
  subject_id uuid,
  -- Etykieta pokazywana w interfejsie, np. "Waldemar Pieniak".
  label text not null,
  person_id bigint references public.registry_persons (rejestrio_id) on delete set null,
  org_krs text references public.registry_orgs (krs) on delete set null,
  match_status public.registry_match_status not null default 'candidate',
  -- Kto i kiedy potwierdził tożsamość. Bez tego nie pokazujemy powiązań
  -- jako faktów o tej osobie.
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_at timestamptz,
  -- Kiedy ostatnio odświeżyliśmy powiązania z płatnego API.
  connections_synced_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Jeden byt może mieć jedną tożsamość w rejestrze na tenant.
  unique (tenant_id, subject_type, subject_id, person_id, org_krs)
);

create index registry_subjects_tenant_idx on public.registry_subjects (tenant_id);

-- Numery KRS obserwowane przez tenanta. Zasila darmowy biuletyn zmian:
-- cron pobiera listę zmienionych KRS z api-krs.ms.gov.pl i porównuje z tą tabelą.
create table public.registry_watches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  org_krs text not null references public.registry_orgs (krs) on delete cascade,
  -- Dlaczego obserwujemy: "spółka polityka", "wydawca redakcji".
  reason text not null default 'brak danych',
  subject_id uuid references public.registry_subjects (id) on delete cascade,
  active boolean not null default true,
  last_change_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, org_krs)
);

create index registry_watches_org_idx on public.registry_watches (org_krs) where active;

-- Zdarzenie w rejestrze dotyczące obserwowanego podmiotu. Wejście do briefu
-- porannego i do strażnika spójności.
create table public.registry_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  org_krs text not null references public.registry_orgs (krs) on delete cascade,
  watch_id uuid references public.registry_watches (id) on delete set null,
  event_date date not null,
  -- Skąd wiemy o zmianie: 'krs_bulletin' (darmowy biuletyn) albo 'rejestrio'.
  source text not null default 'krs_bulletin',
  summary text not null,
  details jsonb not null default '{}',
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, org_krs, event_date, source)
);

create index registry_events_tenant_idx on public.registry_events (tenant_id, event_date desc);

-- ---------------------------------------------------------------------------
-- Audyt kosztów płatnego API (service_role only)
-- ---------------------------------------------------------------------------

-- Każde wywołanie Rejestr.io. Bez tego nie da się odpowiedzieć na pytanie
-- "gdzie poszło 200 złotych" ani postawić limitu na tenanta.
create table public.registry_api_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  provider text not null default 'rejestrio',
  endpoint text not null,
  http_status integer,
  -- Stan konta w PLN odczytany po wywołaniu (źródło ma opóźnienie do kilku
  -- minut, więc to wskaźnik, nie księgowość).
  balance_after numeric(12, 5),
  cache_hit boolean not null default false,
  duration_ms integer,
  error text,
  created_at timestamptz not null default now()
);

create index registry_api_calls_created_idx on public.registry_api_calls (created_at desc);

-- ---------------------------------------------------------------------------
-- Triggery updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.registry_orgs
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.registry_persons
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.registry_connections
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.registry_subjects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.registry_watches
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.registry_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.registry_orgs enable row level security;
alter table public.registry_persons enable row level security;
alter table public.registry_connections enable row level security;
alter table public.registry_subjects enable row level security;
alter table public.registry_watches enable row level security;
alter table public.registry_events enable row level security;
alter table public.registry_api_calls enable row level security;

-- Cache rejestru: dane publiczne z KRS, odczyt dla zalogowanych,
-- zapis wyłącznie z Edge Functions (service_role omija RLS).
create policy "registry_orgs: odczyt dla zalogowanych"
  on public.registry_orgs for select to authenticated using (true);

create policy "registry_persons: odczyt dla zalogowanych"
  on public.registry_persons for select to authenticated using (true);

create policy "registry_connections: odczyt dla zalogowanych"
  on public.registry_connections for select to authenticated using (true);

-- Dane tenanta: kto kogo obserwuje i czyją tożsamość potwierdził, jest
-- informacją wrażliwą biznesowo. Pełna izolacja per tenant.
create policy "registry_subjects: pelny dostep w tenancie"
  on public.registry_subjects for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "registry_watches: pelny dostep w tenancie"
  on public.registry_watches for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "registry_events: pelny dostep w tenancie"
  on public.registry_events for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

-- registry_api_calls: brak polityk dla authenticated = tylko service_role.
