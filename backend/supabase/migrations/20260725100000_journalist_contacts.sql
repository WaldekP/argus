-- Baza dziennikarzy: pola kontaktowe i provenance pod scraping stron autorow.
--
-- Decyzje uzytkownika (2026-07-25):
--   - baza sluzy do briefu ORAZ kontaktu (outreach), wiec trzymamy maile,
--   - maile-wzorce dozwolone, ale JAWNIE oznaczone jako niezweryfikowane,
--   - zrodlo pierwszej wersji: strony autorow glownych mediow newsowych.
--
-- Zasada nadrzedna (CLAUDE.md, RODO): tylko dane zawodowe z publicznych
-- zrodel. `source_urls` jest dowodem publicznego pochodzenia kazdego rekordu.
-- Mail wygenerowany ze wzorca dostaje status 'pattern' i UI musi go oznaczyc.
-- Odkrycie z rekonesansu: Onet publikuje mail dziennikarza wprost na stronie
-- autora ("Chcesz porozmawiac z autorem? Napisz: ..."), wiec dla Onetu status
-- jest 'public', nie 'pattern'.

-- Status pewnosci adresu e-mail dziennikarza.
--   public   - opublikowany przez redakcje/dziennikarza na publicznej stronie
--   pattern  - wygenerowany ze wzorca redakcji (imie.nazwisko@domena), NIEZWERYFIKOWANY
--   verified - potwierdzony recznie przez czlowieka
--   none     - brak maila
-- Idempotentnie (Postgres nie ma CREATE TYPE IF NOT EXISTS), bo repo i zdalna
-- baza sa chwilowo rozjechane i migracja moze byc aplikowana rozna sciezka.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'email_status') then
    create type public.email_status as enum ('public', 'pattern', 'verified', 'none');
  end if;
end $$;

-- Wzorzec maila i kontakty ogolne zyja na poziomie redakcji, nie osoby.
alter table public.outlets
  add column if not exists domain text,
  add column if not exists email_pattern text,                    -- np. '{first}.{last}@redakcjaonet.pl'
  add column if not exists contact_emails text[] not null default '{}', -- newsroom@, kontakt@ (dzialowe, nie osobowe)
  add column if not exists author_url_pattern text,               -- np. 'https://wiadomosci.onet.pl/autorzy/{slug}'
  add column if not exists robots_ok boolean not null default true, -- czy robots.txt pozwala na /autorzy/
  add column if not exists last_crawled_at timestamptz;

-- Pola kontaktowe i slad zrodlowy dziennikarza.
alter table public.journalists
  add column if not exists email text,
  add column if not exists email_status public.email_status not null default 'none',
  add column if not exists phone text,
  add column if not exists source_urls text[] not null default '{}', -- strony, z ktorych powstal rekord (dowod publicznego zrodla)
  add column if not exists bio text,                              -- publiczny opis autora ze strony redakcji
  add column if not exists last_scraped_at timestamptz,
  -- Deduplikacja przy re-scrapie: slug profilu w outlecie = stabilny klucz.
  add column if not exists outlet_author_slug text;

create unique index if not exists journalists_outlet_author_slug_uidx
  on public.journalists (outlet_id, outlet_author_slug)
  where outlet_author_slug is not null;
