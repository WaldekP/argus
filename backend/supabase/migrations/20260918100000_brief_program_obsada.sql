-- =============================================================================
-- Migracja: brief przedwywiadowy poznaje program i obsadę rozmowy.
--
-- Dlaczego. Brief zakładał rozmowę jeden na jeden z dziennikarzem: pole
-- `journalist_id` i nic poza tym. Wystąpienie telewizyjne ma jednak obsadę,
-- a w Kropce nad i 7 z 24 ostatnich odcinków to duety, zawsze międzyobozowe.
-- Bez obsady prompt nie przewidzi pytań w formie, w jakiej naprawdę padają
-- w duecie („poseł X mówi, że..."), bo nie wie, że ktoś siedzi naprzeciwko.
--
-- Program niesie dwie rzeczy, których dotąd trzeba było szukać ręcznie na
-- innym ekranie: prowadzącego (tabela `programs` ma `hosts`) i ostatnie tematy
-- pasma. To usuwa też pułapkę z imiennikami: w bazie dziennikarzy jest
-- Magdalena Olejnik, a Kropkę nad i prowadzi Monika, więc wybór z listy
-- budował profil zupełnie innej osoby i nic nie ostrzegało.
--
-- Dlaczego kolumny, a nie tabela `brief_participants`. Obsada jest zawsze
-- czytana razem z briefem i nigdy osobno, więc osobna tabela dokładałaby drugą
-- powierzchnię RLS bez zysku. Do tabeli wracamy dopiero, gdy pojawi się pytanie
-- „w których briefach występował ten poseł" (wtedy jsonb wymaga indeksu GIN
-- i przestaje być prostszy).
--
-- Kształt `participants` (jsonb, tablica):
--   [{ "role": "opponent" | "guest",
--      "kind": "mp" | "person",
--      "mp_id": 412,            -- gdy kind = "mp"
--      "name": "Michał Wawer",
--      "club": "Konfederacja" }]
-- Prowadzący NIE jest elementem tej tablicy: siedzi w `journalist_id`
-- albo w treści briefu, bo ma inną rolę i inne źródło danych.
--
-- RLS: bez zmian. Kolumny dokładane do istniejącej tabeli tenanta, która ma
-- już politykę „pełny dostęp w tenancie".
-- =============================================================================

alter table public.interview_briefs
  add column if not exists program_id uuid references public.programs (id) on delete set null,
  add column if not exists participants jsonb not null default '[]'::jsonb;

comment on column public.interview_briefs.program_id is
  'Program publicystyczny, w którym odbywa się rozmowa (programs).';
comment on column public.interview_briefs.participants is
  'Obsada poza prowadzącym: oponenci i współgoście. Patrz migracja 20260918100000.';

create index if not exists interview_briefs_program_idx
  on public.interview_briefs (program_id);
