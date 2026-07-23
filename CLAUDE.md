# CLAUDE.md — Argus.ai (MVP)

## Czym jest ta aplikacja

**Argus.ai** — aplikacja dla polityka i jego asystenta/rzecznika (2 konta na klienta, wspólne dane). Pełny brief: `../briefy/14-brief-implementacja-aplikacji-mvp.md` (czytaj przed większymi zadaniami). Kontekst produktowy: `../analiza/`.

MVP robi 5 rzeczy:

1. **Profil polityka (graf kontekstu)** — onboarding: auto-import z API Sejmu (głosowania, stenogramy) + wywiad onboardingowy z AI + profil stylu językowego.
2. **Baza mediów i dziennikarzy** — karty redakcji i dziennikarzy z profilami stylu i playbookami rozmowy (dane seedowane, globalne, read-only).
3. **Brief przedwywiadowy** (serce MVP) — formularz "gdzie / kto / temat" → brief w < 5 min: profil dziennikarza, 10 przewidywanych pytań z prawdopodobieństwem, rekomendowane odpowiedzi, pułapki i mosty, 3 message'y dnia.
4. **Generator przekazu** — temat → warianty treści per segment wyborców × kanał (FB, X, TikTok skrypt, prasa lokalna), w stylu polityka.
5. **Strażnik spójności** — każdy draft i brief porównywany z historią głosowań/wypowiedzi/obietnic; alerty sprzeczności.

Plus: **brief poranny lite** (synteza RSS + stenogramy per tematy użytkownika, cron 6:30) i **tryb ćwiczenia** (chat, AI odgrywa dziennikarza).

**Poza zakresem MVP — nie buduj, nawet jeśli kusi:** tryb LIVE (ASR), nasłuch X/TikTok, analiza nagrań po wywiadzie, publikacja do social mediów, role enterprise/partia, watch, płatności, speechwriter, crisis room.

## Stack

| Warstwa | Decyzja |
| --- | --- |
| Frontend | React Native + Expo (expo-router, TypeScript **strict**). Target: iOS, Android, **Web** — web pierwszorzędny (asystent pracuje na laptopie) |
| State | Zustand |
| Backend | Supabase (osobny projekt, EU/Frankfurt — NIE współdzielić z TwójPsycholog): Postgres + pgvector, Auth (e-mail + Google), Edge Functions (Deno), Storage. **Stan: projekt jeszcze niepodłączony — user podepnie nowy; do tego czasu ŻADNYCH migracji na zdalnych projektach.** Konfiguracja klienta przez `.env` (patrz `.env.example`) |
| AI | Claude API przez **LangChain/LangGraph** (npm: specifiers w Deno) — `claude-sonnet-5` (briefy/treści), `claude-haiku-4-5` (klasyfikacja). Wywołania WYŁĄCZNIE z Edge Functions, klucz nigdy na kliencie. Moduł: `backend/supabase/functions/_shared/ai.ts`, pipeline'y (LangGraph): `_shared/pipelines/` |
| Embeddingi | pgvector + model multilingual przez Edge Function |
| Ingest | Edge Functions + pg_cron (Sejm API, RSS ~50 feedów). Bez zewnętrznego orkiestratora |
| Analytics | PostHog, osobny projekt "Argus" (`src/lib/analytics/events.ts`) |

## Struktura monorepo

```text
argus_app/
  src/app/            — ekrany (expo-router, file-based routing)
  src/components/     — komponenty współdzielone
  src/constants/      — Colors.ts (JEDYNE źródło kolorów), theme
  src/lib/            — supabase.ts, analytics/, api/
  src/store/          — story Zustand
  backend/
    supabase/
      migrations/     — migracje SQL
      functions/      — Edge Functions (Deno)
        _shared/      — wspólny kod + prompts/ (wszystkie prompty, po polsku, wersjonowane)
    scripts/          — skrypty seedujące (baza mediów itp.)
```

## Auth i multi-tenancy (krytyczne)

- **Auth pattern**: klient wysyła token Supabase w nagłówku `Authorization` → Edge Function weryfikuje `supabase.auth.getUser(token)` → operacje na `user.id`. `service_role` tylko w Edge Functions. Klucz serwisowy i klucz Claude NIGDY na kliencie.
- **Multi-tenancy**: `tenant_id` (= konto klienta, "biuro") na każdej tabeli z danymi klienta. Polityk + asystent = ten sam tenant (tabela `memberships`, role: `politician`/`assistant`). RLS: `tenant_id` musi zgadzać się z tenantem usera.
- **Dane globalne** (dziennikarze, redakcje, dane Sejmu, news_items): read-only dla zalogowanych, insert/update tylko `service_role`.
- **RLS na KAŻDEJ tabeli** + testy RLS (tenant A nie widzi danych tenanta B) — warunek zaliczenia migracji.
- 2FA (TOTP) wymuszone dla roli `politician`.

## Edge Functions — konwencja

Jedna funkcja per domena, pole `operation` w body. Każda: CORS preflight → weryfikacja tokena → walidacja tenant_id → operacja. Funkcje: `argus-onboarding`, `argus-brief`, `argus-content`, `argus-consistency`, `argus-practice`, `argus-media`, `argus-morning-brief`, `argus-ingest` (cron, service-only), `argus-segments`, `argus-tenant` (eksport / twarde usunięcie danych).

### Zasady promptów

- Wszystkie prompty po polsku, w `backend/supabase/functions/_shared/prompts/`, wersjonowane w gicie.
- Styl polityka (`style_profile`) wstrzykiwany do każdej generacji treści.
- Twarde zasady: zakaz zmyślania cytatów i liczb (brak danych = napisz "brak danych"), zakaz treści dezinformacyjnych, warianty przekazu nie mogą być merytorycznie sprzeczne.

## Design system

**Źródło prawdy: `../briefy/15-mini-brief-design-argus.md`** (mini brief designu — przeczytaj przed każdą pracą nad UI). Spójność wizualna z prezentacją (brief 13). Klimat: "quiet power" — antyczna powaga + nowoczesny produkt, "muzeum nocą, nie startup". **Dark mode first.** Motyw oka Argusa (logo, empty states, loader, kropka-oko zamiast bulletów) — subtelnie.

Skrót palety (dark):

| Token | HEX | Użycie |
| --- | --- | --- |
| Tło | `#0A0F2C` | główne tło ekranów |
| Tło głębsze | `#080C22` | krawędzie, gradienty, cień |
| Karta / panel | `#0E1436` | karty, modale, pola |
| Panel alt | `#0B1026` | drugi ton kart, wiersze |
| Złoto (akcent) | `#C9A227` | linie, akcenty, kluczowe liczby, CTA. Zasada: złoto = biżuteria, oszczędnie |
| Złoto jasne | `#E6C65A` | hover, podświetlenia, iris, tekst chipów |
| Teal (pawi) | `#14857A` | dane, drugi akcent, wykresy, info |
| Tekst | `#F4F1E8` | nigdy czysta biel; akapity 80%, meta 50% opacity |
| Alert | `#E0483A` | ostrzeżenia, kryzys |

- Karty: tło `#0E1436`, border `1px rgba(201,162,39,.25)`, radius 14–18. Alerty: lewy border 2px w kolorze roli (alert czerwony, info teal, sukces złoto), tło `rgba(koloru,.14)`. Chipy: border `rgba(201,162,39,.4)`, radius pełny, tekst `#E6C65A`.
- Zakaz: fiolet/róż "AI", neon, czysta biel/czerń.
- Nagłówki i kluczowe liczby: **Cormorant Garamond** 600 (`@expo-google-fonts/cormorant-garamond`); liczby kluczowe duże, złote; cytaty/akcenty emocjonalne Cormorant *italic*. UI/treść/dane: **Inter** (400/500/600). Kickery/etykiety: Inter UPPERCASE, letter-spacing .24em, złote, min 14px.
- Skala: tytuł ekranu 28–34, sekcja 20–24, body 15–16, meta 13, line-height 1.5.
- Layout: jedna myśl na widok, duże marginesy, spacing w skoku 8px, radiusy 12–18.
- `src/constants/Colors.ts` — jedyne źródło kolorów. Zero hardkodowanych hexów w komponentach.

## Konwencje tekstów UI (copy)

- Wszystkie teksty UI **po polsku**, z polskimi znakami. Rzeczowo, spokojnie, pełne zdania.
- **Bez półpauz** (—): osobne zdania lub przecinki. **Zero emoji i wykrzykników**, zero słów typu "rewolucja/innowacyjny/game-changer".
- **Pisownia inkluzywna z podkreślnikiem** (np. "gotowy_a").
- Głos marki: doradca w dobrze skrojonym garniturze, nie gadżet. Tagline: „Sto oczu. Jeden przekaz."

## Analytics (PostHog, obowiązkowe od początku)

Eventy: `onboarding_started/completed`, `sejm_import_completed`, `brief_created`, `brief_viewed`, `brief_rated`, `brief_question_feedback`, `content_generated`, `content_variant_copied`, `consistency_alert_shown/resolved`, `practice_session_started/finished`, `morning_brief_read`, `journalist_viewed`, `media_searched`. North star: liczba briefów tygodniowo per tenant.

## Bezpieczeństwo i RODO

- Żadnych tabel z danymi pojedynczych wyborców — segmenty to wyłącznie agregaty.
- Dane dziennikarzy: tylko zawodowe, z publicznych źródeł; pole `takedown_requested` + proces usunięcia.
- Eksport i twarde usunięcie danych tenanta (`argus-tenant` operation `delete_all`) — od MVP.
- Logi dostępu do danych tenanta w tabeli `access_logs`.
- Klucze: lokalny `.env` (nigdy nie commitować) trzyma `CLAUDE_API_KEY` i klucze publiczne Expo (`EXPO_PUBLIC_*`). Sekrety Edge Functions (klucz Claude, service_role) ustawiane przez `supabase secrets set` — nigdy w kodzie klienta.

## Postęp (TASK 0–10 z briefu, sekcja 9)

- [x] TASK 0 — szkielet: Expo + backend/supabase + Colors.ts + auth (ekrany gotowe; wymaga konfiguracji `.env` z kluczami Supabase)
- [ ] TASK 1 — migracja 001: pełny model danych + RLS + testy RLS
- [ ] TASK 2 — ingest Sejm API + embeddingi
- [ ] TASK 3 — onboarding (import, wywiad AI, profil stylu)
- [ ] TASK 4 — seed bazy mediów + ekrany media/journalist/outlet
- [ ] TASK 5 — brief przedwywiadowy (pipeline + ekrany + push)
- [ ] TASK 6 — strażnik spójności
- [ ] TASK 7 — generator przekazu + segmenty
- [ ] TASK 8 — tryb ćwiczenia
- [ ] TASK 9 — brief poranny lite
- [ ] TASK 10 — polish (states, PostHog komplet, eksport/usunięcie, E2E)

## Definition of Done MVP

1. Nowy użytkownik przechodzi onboarding i ma działający graf kontekstu z realnymi danymi z Sejmu.
2. Brief przedwywiadowy dla realnego wywiadu powstaje w < 5 min, ocena pilotów 4+/5.
3. Generator daje warianty per segment, które brzmią jak polityk, nie jak chatbot.
4. Strażnik spójności łapie podstawione sprzeczności.
5. RLS szczelny (testy), 2FA działa, eksport/usunięcie danych działa.
6. 5 kont pilotażowych używa aplikacji tydzień bez asysty developera.
