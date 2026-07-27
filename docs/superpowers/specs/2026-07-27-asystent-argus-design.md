# Asystent Argus: pytanie z Pulpitu i ekran rozmowy

Data: 2026-07-27. Status: zaprojektowane w sesji autonomicznej, do przejrzenia przez usera.

## Cel

Na zakładce Pulpit (dawne "Dziś") pojawia się komponent, w którym użytkownik zadaje pytanie
swojemu asystentowi AI. Komponent podpowiada propozycje pytań na dany dzień, budowane z briefu
dnia. Wysłanie pytania (własnego albo z propozycji) przenosi na trasę `/asystent-argus`,
gdzie toczy się rozmowa. Trasa nie jest w dolnym menu; docelowo tam trafi.

## Architektura

1. **Backend: nowa Edge Function `argus-assistant`** (operacja `ask`).
   Konwencja jak w pozostałych domenach: CORS preflight, weryfikacja tokena,
   `getTenantId`, koperta `{ ok, data }`, błędy przez `serverErrorResponse`.
   - Wejście: `question` (string, 3-2000 znaków) + `history`
     (tablica `{ role: 'user' | 'assistant', content: string }`, przycinana do 20
     ostatnich wpisów). Rozmowa jest bezstanowa po stronie serwera: historię trzyma
     klient w stanie ekranu, nic nie zapisujemy w bazie (zero migracji).
   - Kontekst wstrzykiwany do promptu: profil polityka (`full_name`, `style_profile`,
     `goals`, `values`, `boundaries`, `bio`, `party_profile`, `topic_positions`)
     oraz dzisiejszy brief dnia (`lead` + `items`), jeśli ma status `ready`.
   - Model: Sonnet (`getGenerationModel`), zwykłe wywołanie tekstowe (bez structured
     output, odpowiedź to proza). Prompt: `_shared/prompts/assistant-ask.md`
     (po polsku, twarde zasady: zakaz zmyślania cytatów i liczb, bieżące wydarzenia
     tylko z briefu dnia, rekomendacje w granicach profilu).
   - Wyjście: `{ answer, used_brief }`.

2. **Klient API**: `src/lib/api/assistant.ts` (`askAssistant(question, history)`,
   `LONG_TIMEOUT_MS`), wpis `argus-assistant` w `EdgeFunctionName`.

3. **Propozycje pytań**: czysta funkcja `buildAssistantSuggestions(brief)` w
   `src/lib/assistant-suggestions.ts` + test jednostkowy. Bez wywołania AI:
   bierze do 3 wydarzeń z dzisiejszego briefu i skleja pytania z szablonów
   ("Jak skomentować...", "Co dla mnie oznacza..."). Gdy briefu nie ma,
   zwraca stały zestaw pytań ogólnych. Zero kosztu i zero opóźnienia przy
   każdym wejściu na Pulpit; jakość pytań rośnie razem z jakością nagłówków briefu.

4. **Komponent Pulpitu**: `src/components/ask-argus-card.tsx`. Karta w stylu
   pozostałych: nagłówek z kropką-okiem, pole tekstowe z przyciskiem wysłania,
   pod spodem propozycje jako przyciski. Brief dnia pobierany raz na montaż
   (`getDailyBrief()`), błąd pobrania degraduje do propozycji ogólnych.
   Wysłanie: `router.push('/asystent-argus?q=...')`.

5. **Ekran rozmowy**: `src/app/asystent-argus.tsx` + rejestracja w Stacku
   głównego layoutu. Dymki rozmowy (user po prawej, Argus po lewej), wskaźnik
   "Argus analizuje", błąd z ponowieniem, pole nowego pytania na dole.
   Parametr `q` wysyłany automatycznie raz po wejściu.

6. **Analytics**: nowy event `assistant_question_asked` (props: `source`:
   `pulpit_input` | `pulpit_suggestion` | `chat`).

## Iteracja 2 (2026-07-27, decyzje usera z sesji)

1. **Asystent jest centralną zakładką dolnego menu** (Pulpit, Analizy, Asystent,
   Dane, Profil): uniesione koło z okiem Argusa, etykieta wymuszona pod ikoną,
   żeby na szerokich ekranach koło nie zjeżdżało z osi. Ekran żyje w
   `src/app/(tabs)/asystent-argus.tsx` (grupa nie dodaje segmentu, trasa to
   nadal `/asystent-argus`).
2. **Odpowiedź strumieniuje się** (SSE): Edge Function zwraca
   `text/event-stream` ze zdarzeniami `meta` (id wątku), `delta` (fragment
   tekstu), `done`, `error`. Klient czyta strumień przez `expo/fetch`
   (wbudowany fetch RN nie daje `response.body` na natywce; web działa tak samo).
3. **Rozmowy są trwałe w Supabase**: tabele `assistant_conversations`
   (tytuł z pierwszego pytania, `updated_at` podbijane po każdej odpowiedzi)
   i `assistant_messages` (wpisy user/assistant), RLS per tenant, migracja
   `20260727120000_assistant_conversations.sql`. Historię wątku do promptu
   dokleja serwer z bazy (ostatnie 20 wpisów), klient wysyła tylko pytanie
   i opcjonalne `conversation_id`.
4. **Id rozmowy w URL**: parametr `cid` na trasie zakładki, ustawiany po
   zdarzeniu `meta`. Link „Historia" w prawym górnym rogu prowadzi na
   `/asystent/rozmowy` (lista wątków po ostatniej aktywności); wybór wraca
   z `cid` i wątek ładuje się z bazy. Obok „Historia" jest „Nowa" (czysta
   rozmowa). Pytanie z karty na Pulpicie zawsze otwiera nową rozmowę.

## Odrzucone warianty

- Generowanie propozycji pytań przez AI (osobna operacja jak `tweets`): lepsza
  polszczyzna, ale koszt i latencja przy każdym wejściu na Pulpit, a bez migracji
  nie ma gdzie cache'ować wyniku na dobę. Do rozważenia później.
- Dokładanie operacji `ask` do `argus-morning-brief`: asystent to osobna domena
  (rozmowa ogólna, nie tylko brief), a konwencja repo to jedna funkcja per domena.
- Trwałe wątki rozmów w bazie: wymagałyby migracji (zasada: nie migrować bez
  pytania) i nie są potrzebne do pierwszej wersji.
