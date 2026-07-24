-- =============================================================================
-- Migracja 007: dane odblokowane przez plan Rejestr.io Biznes.
--
-- Co doszło do dyspozycji (decyzja usera 2026-07-24, wykupiony abonament):
--   - data urodzenia osoby, czyli TWARDE rozróżnienie imienników,
--   - powiązania historyczne (spółki, z których ktoś już wyszedł),
--   - sprawozdania finansowe w JSON, czyli przychód i wynik netto.
--
-- Data urodzenia zmienia jakościowo dwie rzeczy: potwierdzanie tożsamości
-- polityka i wykrywanie INNYCH polityków w tych samych spółkach. API Sejmu
-- podaje `birthDate` posłów, więc dopasowanie nazwisko plus data urodzenia
-- jest wiarygodne, a nie poszlakowe.
--
-- Kontrakt: docs/kontrakt-rejestr-krs.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Data urodzenia: rozróżnienie imienników
-- ---------------------------------------------------------------------------

alter table public.registry_persons
  add column birth_date date;

-- ---------------------------------------------------------------------------
-- Kwoty ze sprawozdań finansowych
-- ---------------------------------------------------------------------------

alter table public.registry_org_financials
  -- Etykieta księgowa kwoty. W schemach Ministerstwa Finansów "przychód"
  -- znaczy co innego dla spółki i dla organizacji pozarządowej, a użytkownik
  -- ma prawo wiedzieć, na co patrzy.
  add column revenue_label text,
  add column net_result_label text,
  -- Rok poprzedni z tego samego dokumentu: pozwala pokazać kierunek zmiany
  -- bez pobierania drugiego sprawozdania.
  add column revenue_prev numeric(18, 2),
  add column net_result_prev numeric(18, 2),
  add column document_id bigint,
  -- Czy sprawozdanie w ogóle istnieje w postaci JSON. Duże spółki raportujące
  -- według MSSF wrzucają jeden PDF, którego nie parsujemy. Wtedy kwot nie ma
  -- i interfejs mówi dlaczego.
  add column has_json boolean not null default false;

-- ---------------------------------------------------------------------------
-- Osoby w spółce plus dopasowanie do posłów
-- ---------------------------------------------------------------------------

-- Skład osobowy organizacji z Rejestr.io. Globalny cache, bo to dane publiczne
-- z KRS i dwa tenanty nie powinny płacić dwa razy za ten sam skład zarządu.
create table public.registry_org_people (
  id uuid primary key default gen_random_uuid(),
  org_krs text not null references public.registry_orgs (krs) on delete cascade,
  person_id bigint not null,
  full_name text not null,
  birth_date date,
  role_type text not null,
  date_start date,
  date_end date,
  is_current boolean not null default true,
  -- Dopasowanie do posła z API Sejmu.
  sejm_mp_id integer,
  sejm_club text,
  -- Na jakiej podstawie uznaliśmy, że to ten poseł:
  --   birth_date — nazwisko ORAZ data urodzenia, dopasowanie pewne,
  --   name_only  — samo nazwisko, dopasowanie do weryfikacji przez człowieka.
  match_basis text check (match_basis in ('birth_date', 'name_only')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_krs, person_id, role_type)
);

create index registry_org_people_org_idx on public.registry_org_people (org_krs);
create index registry_org_people_mp_idx on public.registry_org_people (sejm_mp_id)
  where sejm_mp_id is not null;

-- ---------------------------------------------------------------------------
-- Kontekst polityczny spółki (podsumowanie AI)
-- ---------------------------------------------------------------------------

-- Zestawienie branży spółki z historią głosowań i wypowiedzi polityka.
-- Per tenant, bo opiera się na danych sejmowych konkretnego polityka.
-- Cache, bo generacja kosztuje wywołanie modelu, a korpus zmienia się rzadko.
create table public.registry_company_context (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  org_krs text not null references public.registry_orgs (krs) on delete cascade,
  summary text not null,
  -- Głosowania i wypowiedzi, na których oparte jest podsumowanie. Bez tego
  -- nie da się sprawdzić, czy model czegoś nie dopowiedział.
  evidence jsonb not null default '{}',
  -- Ile materiału znalazł wyszukiwacz. Zero znaczy, że podsumowanie mówi
  -- "brak danych", i tak ma być.
  votes_found integer not null default 0,
  statements_found integer not null default 0,
  model text,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, org_krs)
);

create trigger set_updated_at before update on public.registry_org_people
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.registry_company_context
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.registry_org_people enable row level security;
alter table public.registry_company_context enable row level security;

create policy "registry_org_people: odczyt dla zalogowanych"
  on public.registry_org_people for select to authenticated using (true);

create policy "registry_company_context: pelny dostep w tenancie"
  on public.registry_company_context for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));
