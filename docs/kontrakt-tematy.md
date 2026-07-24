# Kontrakt: tematy programowe (korpusy tematyczne)

Wiążący kontrakt dla funkcjonalności „Tematy”. Decyzje produktowe podjęte przez usera
2026-07-24, na bazie spotkania z użytkownikiem pilotażowym.

## Czym jest temat

Temat to kuratorowany korpus wiedzy o jednej kwestii programowej, zbudowany po to, żeby
odpowiedzieć na **jedno pytanie decyzyjne** polityka. Nie jest encyklopedią zagadnienia.

Przykład: temat „kwota wolna od podatku” odpowiada na pytanie „trzymać własny temat
(składka zdrowotna) czy poprzeć cudzy (kwota wolna)”.

## Decyzje

### 1. Tematy są kuratorowane, nie generowane

Każdy temat powstaje ręcznie: research, audyt źródeł, oznaczenie danych niegotowych do
publikacji, napisanie rekomendacji. Agent może zbierać materiał, ale korpus publikuje człowiek.

Konsekwencje:

- Temat to artefakt w repo: katalog `docs/<slug>/` plus moduł danych w `src/lib/knowledge/`.
- Skala na start: 5–10 tematów, nie setki. Wąsko i dobrze, zgodnie z zasadą „nie robimy
  drugiego internetu”.
- Nie budujemy agenta, który sam dodaje tematy. Budujemy proces i szablon.
- Każdy temat ma sekcję „luki” i licznik danych `[do weryfikacji]`. To warunek publikacji.

### 2. Narzędzie rekomenduje decyzję

Rekomendacja zostaje na górze ekranu. Skoro bierzemy na siebie doradzanie, obudowujemy je
zabezpieczeniami:

- Rekomendacja ma zawsze sekcję „co przemawia przeciw”. Bez niej temat nie idzie do publikacji.
- Rekomendacja ma datę i podstawę: na jakich badaniach i cytatach się opiera.
- Rekomendacja nie może opierać się na danych `[do weryfikacji]`.
- Gdy dane są słabe (np. brak badania stawiającego dwa tematy obok siebie), rekomendacja mówi
  to wprost i nazywa poszlakę poszlaką.

Granica: narzędzie rekomenduje, człowiek decyduje. Nic nie publikuje się automatycznie.

### 3. Segmenty: domyślne z korpusu plus własne z onboardingu

Dwa źródła segmentów, z jasnym pierwszeństwem:

1. **Segmenty korpusu** — zaszyte w temacie, gotowa treść, zero czekania. Działają zawsze,
   także zanim tenant przejdzie onboarding (który jest nieobowiązkowy).
2. **Segmenty tenanta** — z tabeli `segments`, tworzone w onboardingu. Jeśli tenant je ma,
   playbook generuje się pod nie z materiału korpusu.

Wynik generowania cache'ujemy per (tenant, temat, segment), bo korpus zmienia się rzadko.
Przy zmianie korpusu unieważniamy cache.

Na ekranie widać, skąd segment pochodzi. Użytkownik nie może być zaskoczony, że playbook
dla „rolników z Warmii” powstał w locie, a dla „wolnościowców” jest pisany ręcznie.

### 4. Wyjściem jest brief przedwywiadowy

Temat nie kończy się na czytaniu. Eksportuje się do briefu przedwywiadowego (TASK 5):
liczby kluczowe, przewidywane pytania, rekomendowane odpowiedzi, pułapki i mosty.

Konsekwencja architektoniczna: **temat jest źródłem kontekstu dla briefu**, obok danych
Sejmu i profilu polityka. Pipeline briefu dostaje dodatkowe wejście: `topic_slug`.

Poza zakresem na teraz: generowanie postów na social media z poziomu tematu, alerty o ruchu
w temacie, kopiowanie pojedynczych elementów. Wracamy do tego po briefie.

## Model danych

Typy: `src/lib/knowledge/types.ts` (już docelowe).

Docelowe przeniesienie do bazy:

```text
knowledge_topics       — temat: slug, nazwa, rekomendacja, status (roboczy|opublikowany)
knowledge_chunks       — fragmenty korpusu z embeddingiem (vector 384), do wyszukiwania
knowledge_sources      — źródła: url, wydawca, data, warstwa wiarygodności
knowledge_statements   — wypowiedzi polityków: cytat, data, miejsce, wiarygodność, źródło
knowledge_surveys      — badania: instytut, pytanie, wyniki, jak czytać
topic_segment_playbook — cache playbooka per (tenant, temat, segment)
```

Dane globalne (tematy, źródła, wypowiedzi, badania): read-only dla zalogowanych, zapis tylko
`service_role`. Playbooki: per tenant, RLS jak wszędzie.

## Edge Function `argus-topics`

| Operacja | Opis |
| --- | --- |
| `list` | Lista opublikowanych tematów z licznikami |
| `get` | Pełny temat: rekomendacja, liczby, badania, wypowiedzi, segmenty korpusu |
| `segment_playbook` | Playbook dla segmentu tenanta; z cache albo generowany z korpusu |
| `to_brief` | Zasilenie briefu przedwywiadowego kontekstem tematu |

## Kolejność prac

1. Migracja: tabele korpusu plus RLS i testy RLS.
2. Skrypt seedujący: `docs/kwota-wolna/` oraz moduł TS do bazy.
3. `argus-topics` z operacjami `list` i `get`; ekrany przełączone z modułu na API.
4. `segment_playbook`: generowanie pod segmenty tenanta, z cache.
5. Wpięcie tematu w pipeline briefu (`to_brief`).
6. Drugi temat, żeby sprawdzić, czy proces kuratorowania się skaluje.

## Stan obecny

Zbudowany pionowy wycinek na danych z modułu TS, bez bazy: zakładka „Tematy”, ekran
`/temat/[slug]` z sekcjami Opinia, Politycy, Komunikacja, rekomendacją i liczbami kluczowymi.
Służy do rozmowy o kształcie, nie jest wersją docelową.
