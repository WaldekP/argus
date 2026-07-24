# Kontrakt: wzmianki prasowe (Bing News RSS, zapasowo Google News)

Wiążący kontrakt monitoringu prasy. Decyzje podjęte 2026-07-24.
Zmiana zachowania wymaga aktualizacji tego pliku.

## Po co to jest

Polityk chce w jednym miejscu wiedzieć, co się dziś o nim pisze i co się pisze
o tematach, które prowadzi. To jest treść briefu porannego: nie dashboard
monitoringu mediów, tylko lista rzeczy, o które ktoś dziś zapyta.

## Dlaczego nie kupujemy monitoringu mediów

Rozważony i odrzucony wariant: Brand24 (i podobni). Powody, w kolejności wagi:

1. **MCP nie zasili backendu.** Serwer MCP tych narzędzi autoryzuje się przez
   OAuth per konto użytkownika i zwraca odpowiedzi zoptymalizowane pod czytanie
   przez model, nie pod ETL. Jeden token oznaczałby wszystkich klientów w jednej
   puli projektów, bez separacji tenantów. Programowy dostęp do danych to API,
   a API jest w najwyższych planach za dopłatą.
2. **Limity planów podstawowych nie mieszczą polityka.** Cztery frazy przy
   nazwisku, które się odmienia, plus nazwa partii, to limit wyczerpany na
   starcie. Miesięczny limit wzmianek potrafi paść w tydzień gorącego newsa.
3. **Brak backfillu.** Projekt zbiera od momentu założenia, więc scenariusz
   „ten dziennikarz pisał o Tobie trzy razy w miesiącu" nie działa w dniu,
   w którym jest potrzebny.

Darmowe feedy RSS wyszukiwarek pokrywają prasę i portale, nie wymagają klucza
i nie mają limitu. Jeśli pilot zgłosi, że brakuje social mediów i forów,
dokładamy adapter płatnego dostawcy jako kolejne źródło w `news-sources.ts`,
bez zmiany schematu bazy.

## Dwa źródła i dlaczego akurat tak

Sprawdzone na żywej funkcji 2026-07-24: **Google News odpowiada błędem 503 na
żądania z adresów centrów danych.** Lokalnie ten sam feed zwraca kilkanaście
pozycji, z runtime'u Edge Functions nie zwraca nic. To polityka Google wobec
ruchu serwerowego, nie awaria chwilowa, więc pojedyncze źródło oznaczałoby
funkcję, która działa na laptopie i nie działa na produkcji.

| | Bing News RSS | Google News RSS |
| --- | --- | --- |
| Rola | podstawowe | zapasowe |
| Ruch z centrum danych | działa | 503 |
| Adres artykułu | prawdziwy, zaszyty w linku `apiclick.aspx?...url=` | nieprzezroczyste przekierowanie |
| Zajawka | prawdziwy lead artykułu | powtórzony tytuł, więc zapisujemy null |
| Nazwa redakcji | `News:Source` | `source` |
| Identyfikator | brak `guid`, kluczem jest adres artykułu | `guid` |
| Okno czasowe | `qft=interval` z ustalonych przedziałów | `when:Nd`, dowolna liczba dni |

Bing daje więc **bogatsze dane**, nie tylko osiągalne. Google zostaje, bo
działa przy uruchomieniu ze zwykłego łącza i bywa szerszy dla polskiej prasy.

Zasada przełączania (`fetchFromSources`): **pierwsze źródło, które odpowie,
wygrywa.** Zero wyników to poprawna odpowiedź, nie awaria, więc nie pytamy
kolejnego źródła o to samo. Do następnego schodzimy wyłącznie po błędzie.
Gdy wysypią się wszystkie, `last_sync_error` wymienia każdą próbę z osobna,
bo „nie udało się pobrać" bez podania kto i czym odmówił jest bezużyteczne.

Rozważony i odłożony: **GDELT** (`api.gdeltproject.org`), darmowy i wprost
przeznaczony do użytku programowego, ale przy dwóch zapytaniach pod rząd
odpowiedział 429. Kandydat na trzecie źródło, jeśli dwa pierwsze zawiodą.

## Czego to źródło nie da

Wprost, żeby nikt nie budował na tym oczekiwań:

- **Bez social mediów, forów i komentarzy.** Nasłuch X i TikToka jest poza MVP.
- **Bez zasięgów i wskaźników wpływu.** Google News nie podaje takich danych.
- **Bez oceny tonu.** Kolumny `tone`, `classification` i `classified_at` czekają
  puste na pipeline klasyfikacji (Claude Haiku). Decyzja z 2026-07-24: najpierw
  zobaczyć realne dane, potem ustalić kategorie, które mają sens dla polityka.
- **Bez treści artykułu.** Feed daje tytuł, źródło, datę i lead.

## Feedy

**Bing News (podstawowe):**

```
https://www.bing.com/news/search?q=<zapytanie>&format=RSS&cc=PL&setLang=pl&qft=interval="7"
```

Struktura pozycji, potwierdzona na żywym feedzie 2026-07-24 (12 pozycji dla
„Ryszard Petru", wszystkie z datą, źródłem, zajawką i rozwiniętym adresem):

| Pole RSS | Kolumna | Uwagi |
| --- | --- | --- |
| brak `guid` | `external_id` | kluczem jest rozwinięty adres artykułu |
| `title` | `title` | bez sufiksu z nazwą redakcji |
| `link` | `url` | `apiclick.aspx?...&url=<adres>&...`, rozwijane bez requestu |
| `pubDate` | `published_at` | RFC 822, konwertowane na ISO |
| `description` | `snippet` | prawdziwy lead artykułu |
| `News:Source` | `source_name` | nazwa redakcji |

**Google News (zapasowe):**

```
https://news.google.com/rss/search?q=<zapytanie>+when:<N>d&hl=pl&gl=PL&ceid=PL:pl
```

- Wymagany nagłówek `User-Agent`, inaczej Google odmawia obsługi.
- Bez operatora `when:` feed potrafi zwrócić archiwalia sprzed lat.
- Zapytanie przyjmuje operatory Google News: cudzysłów, `OR`, `site:`.
- Tytuł zawiera sufiks `" - Nazwa redakcji"`, ucinany przy parsowaniu.
- `description` powtarza tytuł, więc `snippet` wychodzi null.
- Uwaga na jakość źródeł: Google indeksuje też profile redakcji na Facebooku,
  więc potrafi zwrócić `facebook.com` z posiekanym tytułem. Nie filtrujemy
  tego automatycznie, bo bywa to realna wypowiedź.

## Model danych

**`topics_watched`** (istniejąca tabela, rozszerzona) — hasła obserwowane.
Należą do tenanta, więc polityk i asystent widzą tę samą listę.

| Kolumna | Znaczenie |
| --- | --- |
| `phrase` | to, co widzi użytkownik. Unikalne w tenancie, bez względu na wielkość liter |
| `query` | nadpisanie zapytania, gdy hasło nie wystarcza. NULL = pytamy o `phrase` |
| `window_days` | okno operatora `when:Nd`, 1-30, domyślnie 7 |
| `active` | wyłączone hasło nie jest odpytywane, ale zachowuje wzmianki |
| `last_synced_at`, `last_sync_error` | stan ostatniego pobrania, pokazywany wprost przy haśle |

Polskie nazwiska się odmieniają, a Google News nie robi tego za nas. Dla
nazwiska interfejs zachęca do własnego zapytania z wariantami, na przykład
`"Pieniak" OR "Pieniaka" OR "Pieniakowi"`.

**`mentions`** — wzmianki. Klucz `unique (topic_id, external_id)`: ten sam
artykuł trafiający w dwa hasła pokazuje się przy obu, bo to informacja, a nie
duplikat. `read_at` oznacza przeczytane, `dismissed_at` znika z list, ale
zostaje w bazie jako już widziane.

RLS: pełny dostęp w obrębie tenanta, jak reszta danych klienta.

## Edge Functions

`argus-mentions` (token użytkownika, pole `operation`):

| Operacja | Wejście | Wynik |
| --- | --- | --- |
| `list_topics` | — | hasła z licznikiem nieprzeczytanych |
| `add_topic` | `phrase`, `query?`, `window_days?` | hasło plus pierwsze pobranie od razu |
| `update_topic` | `topic_id`, pola do zmiany | zaktualizowane hasło |
| `remove_topic` | `topic_id` | usuwa hasło i jego wzmianki |
| `sync` | `topic_id?` | pobranie dla jednego hasła lub wszystkich aktywnych |
| `list_mentions` | `topic_id?`, `only_unread?`, `since?`, `limit?`, `offset?` | lista wzmianek |
| `mark_read` | `mention_id?` | bez id: cały ekran jako przeczytany |
| `dismiss` | `mention_id` | ukrycie wzmianki |

`argus-ingest` operacja `mentions_sync` (cron, nagłówek `x-argus-cron`):
bierze najdawniej odświeżane aktywne hasła wszystkich tenantów. Częstszy cron
oznacza świeższe dane przy tej samej porcji pracy na wywołanie.

Limity, świadome i twarde:

- `MAX_TOPICS_PER_RUN = 20` — jedno wywołanie obsługuje najwyżej tyle haseł.
  Worker Edge Functions ma limit czasu, a każde hasło to osobny request HTTP.
- `MAX_TOPICS_PER_TENANT = 25` — limit haseł na biuro.
- Hasła odpytywane **sekwencyjnie**, nie równolegle. Kilkanaście jednoczesnych
  requestów do Google z jednego adresu to prosta droga do odcięcia.

Błąd pobrania nie przerywa przebiegu: ląduje w `last_sync_error` przy haśle
i jest pokazywany użytkownikowi. Hasło, które nic nie znalazło, i hasło, które
się wysypało, muszą wyglądać inaczej.

## Interfejs

Wzmianki nie mają własnej zakładki. Decyzja usera z 2026-07-24: żyją w zakładce
Dziś, pod kartą „Brief poranny", bo są treścią briefu, a nie osobnym produktem.
Osobna zakładka z listą wzmianek byłaby Brand24 w gorszej wersji.

- `src/app/(tabs)/index.tsx` — karta z licznikiem nowych wzmianek.
- `src/app/brief-poranny/index.tsx` — wzmianki pogrupowane po haśle.
- `src/app/brief-poranny/hasla.tsx` — dodawanie i wyłączanie haseł.

## Wdrożenie

```bash
supabase db push
supabase functions deploy argus-mentions
supabase functions deploy argus-ingest
```

Cron (pg_cron, poza zakresem tego zadania) woła `argus-ingest` z operacją
`mentions_sync` i nagłówkiem `x-argus-cron: <CRON_SECRET>`.

## Co dalej

W kolejności wartości, nie trudności:

1. **Klasyfikacja tonu przez Haiku.** Nie „pozytywna/negatywna", tylko kategorie
   użyteczne dla polityka: przychylna, krytyczna, atak personalny, neutralne
   przywołanie. Plus jedno zdanie o osi sporu.
2. **Spięcie z bazą mediów (TASK 4).** `source_name` na `outlet_id`, a stamtąd
   na kartę dziennikarza i playbook rozmowy.
3. **Spięcie ze strażnikiem spójności (TASK 6).** Wzmianka cytująca polityka
   porównana z historią głosowań. To jest ta funkcja, której monitoring mediów
   nie ma i mieć nie będzie.
4. **Własne feedy RSS z TASK 2** jako drugie źródło w tej samej tabeli
   (`source = 'rss'`).
