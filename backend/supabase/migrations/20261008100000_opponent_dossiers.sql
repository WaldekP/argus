-- =============================================================================
-- Migracja: teczka oponenta (opponent_dossiers).
--
-- Dlaczego. Brief przedwywiadowy znał oponenta tylko wtedy, gdy był posłem,
-- i tylko z API Sejmu: głosowania, rozjazdy z klubem, wystąpienia z mównicy.
-- Politycy medialni prawie nie mówią z mównicy, a osoba spoza Sejmu dostawała
-- wprost „brak danych". Petru potrzebuje czegoś innego: wszystkich dostępnych
-- wypowiedzi przeciwnika z ostatniego roku, zwłaszcza kontrowersyjnych,
-- sprzecznych z programem jego partii albo z tym, co wydarzyło się później.
--
-- Teczka powstaje przez wyszukiwanie w sieci (narzędzie web search API Claude)
-- w kilku porcjowanych przebiegach i jest zapisywana per tenant, bo:
--   - kosztuje (ok. 1-2 USD) i trwa kilka minut, więc nie liczymy jej od nowa
--     przy każdym briefie,
--   - można ją odświeżyć ręcznie, doklejając nowsze wypowiedzi,
--   - brief z tym samym oponentem bierze gotową teczkę.
--
-- Dlaczego dane tenanta, a nie globalne. Wybór oponenta, uwagi do identyfikacji
-- i to, co biuro uznało za istotne, to wiedza strategiczna konkretnego klienta.
--
-- Kształt `items` (jsonb, tablica), patrz docs/kontrakt-teczka-oponenta.md:
--   [{ "id": "w1", "date": "2026-03-14", "quote": "...", "context": "...",
--      "source_url": "https://...", "source_title": "...",
--      "category": "kontrowersja" | "sprzecznosc-z-programem"
--                | "zweryfikowane-przez-fakty" | "zmiana-zdania" | "wypowiedz",
--      "why_it_matters": "...", "later_facts": "..." | null,
--      "later_facts_url": "https://..." | null, "pass": "wywiady" }]
--
-- RLS: pełny dostęp w tenancie, jak przy pozostałych tabelach klienta.
-- Usunięcie tenanta kasuje teczki kaskadowo (argus-tenant delete_all).
-- =============================================================================

create table if not exists public.opponent_dossiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,

  -- Identyfikacja osoby. Funkcja i partia rozróżniają imienników
  -- w wyszukiwaniu, `notes` to wolne wskazówki („europoseł, nie mylić z...").
  full_name text not null,
  role_hint text,
  party text,
  mp_id integer,
  notes text,

  -- Postęp porcjowanej pętli: indeks następnego przebiegu w PASSES.
  status text not null default 'collecting'
    check (status in ('collecting', 'done', 'error')),
  pass_index integer not null default 0,

  items jsonb not null default '[]'::jsonb,
  summary jsonb,
  -- Wszystkie adresy zwrócone przez wyszukiwarkę: pula, z której walidujemy
  -- źródła pozycji (pozycja z adresem spoza puli jest odrzucana).
  sources jsonb not null default '[]'::jsonb,
  search_count integer not null default 0,
  error text,

  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.opponent_dossiers is
  'Teczka oponenta: wypowiedzi z ostatniego roku zebrane wyszukiwaniem w sieci (argus-opponents).';

create index if not exists opponent_dossiers_tenant_idx
  on public.opponent_dossiers (tenant_id, updated_at desc);

drop trigger if exists opponent_dossiers_updated_at on public.opponent_dossiers;
create trigger opponent_dossiers_updated_at
  before update on public.opponent_dossiers
  for each row execute function public.set_updated_at();

alter table public.opponent_dossiers enable row level security;

drop policy if exists "opponent_dossiers: pelny dostep w tenancie" on public.opponent_dossiers;
create policy "opponent_dossiers: pelny dostep w tenancie"
  on public.opponent_dossiers for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));
