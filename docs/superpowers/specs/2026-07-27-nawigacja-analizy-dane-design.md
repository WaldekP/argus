# Przebudowa nawigacji: zakładka Analizy i prawdziwa zakładka Dane

Data: 2026-07-27. Decyzja usera (wiadomość z sesji): zakładka Tematy staje się
zakładką **Analizy** (hub typów analiz), a zakładka Dane przestaje być listą
przekazów i staje się **katalogiem danych referencyjnych** (Politycy,
Dziennikarze, Programy wyborcze).

Ta decyzja unieważnia wcześniejszą (2026-07-26, pamięć `przekazy-per-temat`):
zapisane przekazy wracają jako globalna lista, pod Analizy → Analiza przekazu.

## Pasek zakładek

Pulpit | Briefy | **Analizy** | **Dane** | Profil

- `(tabs)/topics.tsx` znika, w jego miejsce `(tabs)/analizy.tsx` (hub).
- `(tabs)/content.tsx` znika, w jego miejsce `(tabs)/dane.tsx` (hub).
- `(tabs)/media.tsx` (ukryta zaślepka Media) skasowana: dziennikarze wchodzą
  do zakładki Dane.

## Zakładka Analizy (hub)

Karty w stylu SectionCard z Pulpitu (ikona, tytuł, opis, chevron albo plakietka
"Wkrótce"):

1. **Analiza niespójności** → `/analysis` (istniejący ekran). Karta znika
   z Pulpitu (przeprowadzka, nie kopia).
2. **Analiza zagadnień** → `/topics` (nowy `src/app/topics/index.tsx` = dawna
   zawartość zakładki Tematy: własne dossiery + gotowe zagadnienia).
   Nazewnictwo w UI: "Zagadnienia", nigdy "korpus" (pamięć
   `nazewnictwo-zagadnienia`); przy przeprowadzce poprawiamy stare etykiety
   "Korpus tematyczny".
3. **Analiza przekazu** → `/content` (nowy `src/app/content/index.tsx` = dawna
   lista przekazów z przyciskiem "Nowy przekaz", bez karty Programów
   wyborczych). Istniejące drafty (Przyjęcie euro, Kwota wolna od podatku) są
   w `content_drafts` i pokażą się tu bez migracji danych.
4. **Analiza wystąpień** — plakietka "Wkrótce". Pomysł usera: link z YouTube →
   transkrypt → ocena wystąpienia (swoje: jak poszło i czy spójne z profilem;
   cudze: linie ataku). Świadomie NIE aktywujemy teraz: pobranie transkryptu
   z YouTube z Edge Functions jest zawodne (YouTube blokuje ruch z centrów
   danych tak samo, jak Google News odbijał nas 503 przy briefie porannym),
   a transkrypcja audio nie mieści się w limitach workera. Wymaga osobnego
   projektu (np. proxy albo wklejanie transkryptu ręcznie).
5. **Analiza sentymentu** — plakietka "Wkrótce" (decyzja usera).

## Zakładka Dane (hub)

1. **Politycy** → `/politycy` (nowy ekran): pełna lista posłów na żywo z API
   Sejmu (bez scrapingu i bez kopii w bazie; API jest źródłem prawdy).
   Wyszukiwarka po nazwisku, grupowanie po klubach, wiersz: imię i nazwisko,
   okręg. Bez zdjęć (decyzja usera 2026-07-24: zdjęcie tylko na karcie
   mandatu).
2. **Dziennikarze** → `/dziennikarze` (nowy ekran): lista z globalnych tabel
   `journalists`/`outlets` (dziś 14 rekordów z Onetu), grupowanie po redakcji,
   wiersz: imię i nazwisko, bio, tematy, mail z oznaczeniem statusu
   (`pattern` = jawnie "mail ze wzorca, niezweryfikowany").
3. **Programy wyborcze** → `/programy-wyborcze` (istniejący ekran, karta
   przenosi się z dawnej zakładki Przekaz).

## Backend

- `argus-onboarding`: nowa operacja `list_mps` (z `getMpList()` w
  `_shared/sejm.ts`), zwraca odchudzone pola: mp_id, full_name, club,
  district_name, voivodeship, active, number_of_votes. Funkcja już serwuje
  operacje sejmowe dla UI (mp_details, list_statements), więc to jej domena.
- Nowa funkcja `argus-media` (przewidziana w CLAUDE.md): operacja
  `list_journalists` (join journalists + outlets, tylko odczyt, bez
  rekordów z `takedown_requested`). Klient: `src/lib/api/media.ts` przez
  `edgeClient`, nowy wariant w `EdgeFunctionName`.
- Zasilenie danych: istniejąca operacja `journalist_refresh` w `argus-ingest`
  (adapter Onet) + nowe adaptery kolejnych redakcji pisane wg wzorca
  `_shared/media/onet.ts` (crawl sekcji → profile autorów → persist).
  Zasady bez zmian: tylko dane zawodowe z publicznych stron, `source_urls`
  jako dowód, poszanowanie robots.txt, maile ze wzorca oznaczone `pattern`.
- Bez migracji bazy: wszystkie potrzebne tabele istnieją.

## Poza zakresem

- Aktywna analiza wystąpień i sentymentu (karty "Wkrótce").
- Profile stylu i playbooki dziennikarzy (TASK 4 w pełnym kształcie).
- Przenoszenie generatora przekazu do wnętrza tematów (stara koncepcja
  z 2026-07-26; unieważniona tą decyzją).
