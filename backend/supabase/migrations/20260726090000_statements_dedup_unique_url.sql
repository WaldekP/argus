-- Deduplikacja wypowiedzi z Sejmu: unikalny (tenant_id, url).
--
-- Problem: import wystąpień (backend/supabase/functions/_shared/sejm.ts)
-- odsiewał duplikaty w kodzie, czytając WSZYSTKIE dotychczasowe URL-e tenanta
-- jednym selectem. PostgREST ma limit wiersza (config.toml: max_rows = 1000),
-- więc powyżej tysiąca wypowiedzi zbiór był niekompletny i te same wystąpienia
-- wjeżdżały po raz drugi: podwójny wpis, podwójny embedding i podwójna waga
-- w wyszukiwaniu wektorowym (match_statements), czyli przekłamany strażnik
-- spójności.
--
-- Rozwiązanie: niech unikalność pilnuje baza, a import robi upsert.
-- Zapytanie po istniejące URL-e znika, więc limit wiersza przestaje mieć
-- znaczenie.

-- Krok 1: usuń istniejące duplikaty, zostawiając najstarszy wiersz.
-- Najstarszy, nie najnowszy: to on ma już policzony embedding.
delete from public.statements s
using public.statements keep
where s.tenant_id = keep.tenant_id
  and s.url = keep.url
  and s.url is not null
  and (
    keep.created_at < s.created_at
    or (keep.created_at = s.created_at and keep.id < s.id)
  );

-- Krok 2: unikalność per tenant. Warunkowy, bo wypowiedzi wpisane ręcznie
-- (source inny niż Sejm) nie muszą mieć URL-a, a NULL-e nie kolidują.
create unique index if not exists statements_tenant_url_key
  on public.statements (tenant_id, url)
  where url is not null;

-- Dzienny limit płatnych wywołań Rejestr.io liczymy per tenant z okna 24 h
-- (_shared/rejestrio.ts). Istniejący indeks jest tylko po created_at, więc
-- zapytanie z filtrem na tenanta skanowało cały dzień wszystkich biur.
create index if not exists registry_api_calls_tenant_created_idx
  on public.registry_api_calls (tenant_id, created_at desc);
