-- =============================================================================
-- Migracja: content_drafts.topic_ref — powiazanie draftu z tematem wiedzy.
--
-- UWAGA: plik odtworzony ze stanu produkcji (2026-07-31). Oryginal nalozono na
-- zdalna baze w innej sesji przez Management API i nie trafil do repo (dryft
-- historii migracji opisany w CLAUDE.md). Ponizsze DDL odwzorowuje dokladnie to,
-- co jest w bazie: pojedyncza, nullable kolumna tekstowa, bez FK i indeksu.
-- =============================================================================

alter table public.content_drafts
  add column if not exists topic_ref text;
