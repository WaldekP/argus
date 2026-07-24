-- =============================================================================
-- Migracja 005: szczegóły organizacji i historia sprawozdań finansowych.
--
-- Wszystkie dane w tej migracji pochodzą z DARMOWEGO otwartego API KRS
-- Ministerstwa Sprawiedliwości. Rejestr.io udostępnia sprawozdania finansowe
-- wyłącznie w planach abonamentowych (dokumenty PDF: Premium 119 zł/mies.,
-- treść w JSON: Biznes 249 zł/mies.), a konto testowe ich nie ma.
--
-- Co z tego wynika: wiemy ZA JAKI OKRES i KIEDY spółka złożyła sprawozdanie,
-- ale nie znamy przychodu ani wyniku. Kolumny revenue i net_result istnieją
-- i są puste, żeby włączenie planu Biznes było uzupełnieniem danych,
-- a nie kolejną migracją.
--
-- Kontrakt: docs/kontrakt-rejestr-krs.md
-- =============================================================================

alter table public.registry_orgs
  -- Kapitał zakładowy: pierwsza liczba, która mówi o skali podmiotu.
  add column capital_amount numeric(18, 2),
  add column capital_currency text,
  add column registered_on date,
  -- Ostatni wpis do KRS: podstawa opisu zdarzenia w briefie porannym.
  add column last_entry_on date,
  add column last_entry_number integer,
  -- Pełna lista PKD (przeważające plus pozostałe) z otwartego API.
  add column pkd_all jsonb not null default '[]',
  -- Kiedy ostatnio wzbogaciliśmy dane z darmowego API MS.
  add column enriched_at timestamptz;

-- Historia sprawozdań finansowych. Jeden wiersz na okres rozliczeniowy.
create table public.registry_org_financials (
  id uuid primary key default gen_random_uuid(),
  org_krs text not null references public.registry_orgs (krs) on delete cascade,
  period_start date not null,
  period_end date not null,
  filed_on date,
  -- Kwoty: null dopóki nie mamy planu Biznes w Rejestr.io. Interfejs pokazuje
  -- wtedy wprost, że kwot nie znamy, zamiast udawać, że spółka ma zero.
  revenue numeric(18, 2),
  net_result numeric(18, 2),
  currency text not null default 'PLN',
  source text not null default 'krs_open'
    check (source in ('krs_open', 'rejestrio')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_krs, period_start, period_end)
);

create index registry_org_financials_org_idx
  on public.registry_org_financials (org_krs, period_end desc);

create trigger set_updated_at before update on public.registry_org_financials
  for each row execute function public.set_updated_at();

alter table public.registry_org_financials enable row level security;

-- Dane publiczne z KRS: odczyt dla zalogowanych, zapis tylko service_role.
create policy "registry_org_financials: odczyt dla zalogowanych"
  on public.registry_org_financials for select to authenticated using (true);
