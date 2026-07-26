-- =============================================================================
-- Migracja 005: ręcznie edytowalny kontekst polityka na profilu.
--
-- Ekran Profil dostaje kartę "Kontekst dla Argusa" z trzema sekcjami wolnego
-- tekstu, które user (polityk lub asystent) wpisuje sam i które Argus
-- wstrzykuje do promptów (generator przekazu, docelowo brief i strażnik
-- spójności). "O kandydacie" korzysta z istniejącego pola bio; tu dokładamy
-- dwa brakujące pola.
--
-- Wolny tekst (text), nie jsonb: to notatki dla modelu, nie struktura do
-- odpytywania. RLS bez zmian — polityka "pełny dostęp w tenancie" na
-- politician_profiles obejmuje nowe kolumny automatycznie.
-- =============================================================================

alter table public.politician_profiles
  add column if not exists party_profile   text,
  add column if not exists topic_positions text;

comment on column public.politician_profiles.party_profile is
  'Wolny tekst: profil partii/formacji polityka. Wstrzykiwany do promptów AI.';
comment on column public.politician_profiles.topic_positions is
  'Wolny tekst: stanowiska polityka wobec tematów. Wstrzykiwany do promptów AI.';
