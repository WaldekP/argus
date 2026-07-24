-- =============================================================================
-- Migracja 006: Bing News jako zrodlo wzmianek.
--
-- Powod: Google News odpowiada bledem 503 na zadania z adresow centrow danych.
-- Sprawdzone 2026-07-24 na zywej funkcji: lokalnie ten sam feed zwraca
-- kilkanascie pozycji, z runtime'u Edge Functions nie zwraca nic. To polityka
-- Google wobec ruchu serwerowego, nie awaria chwilowa.
--
-- Bing News RSS nie ma tego ograniczenia i daje bogatsze dane: prawdziwy lead
-- artykulu zamiast powtorzonego tytulu, nazwe redakcji w `News:Source` oraz
-- realny adres artykulu zaszyty w linku przekierowujacym.
--
-- Google News zostaje jako zrodlo zapasowe: dziala przy uruchomieniu ze
-- zwyklego lacza i bywa szerszy dla polskiej prasy.
--
-- Kontrakt: docs/kontrakt-wzmianki.md
-- =============================================================================

alter table public.mentions
  drop constraint if exists mentions_source_check;

alter table public.mentions
  add constraint mentions_source_check
  check (source in ('bing_news', 'google_news', 'rss'));
