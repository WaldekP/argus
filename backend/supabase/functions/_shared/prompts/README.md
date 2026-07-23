# Prompty Argus.ai

Wszystkie prompty aplikacji trzymamy w tym katalogu jako pliki `.md`, ładowane w Edge Functions przez `loadPrompt(name)` z `_shared/ai.ts`.

## Zasady (z CLAUDE.md)

1. Wszystkie prompty piszemy **po polsku** i wersjonujemy w gicie (zmiana promptu = commit z opisem).
2. Styl polityka (`style_profile`) jest wstrzykiwany do **każdej** generacji treści.
3. Twarde zasady w system promptach:
   - zakaz zmyślania cytatów i liczb; brak danych = napisz "brak danych",
   - zakaz treści dezinformacyjnych,
   - warianty przekazu nie mogą być merytorycznie sprzeczne.

## Konwencja nazw

Jeden plik per zadanie, np. `brief-generate.md`, `onboarding-interview.md`, `consistency-check.md`. Nazwa pliku (bez `.md`) jest argumentem `loadPrompt`.

## Generowany `index.ts` (wymagane przy deployu)

`supabase functions deploy` NIE bundluje plików `.md` (eszip zawiera tylko importowane moduły), więc treść promptów trafia do Edge Functions przez generowany moduł `index.ts` w tym katalogu. Źródłem prawdy są pliki `.md`.

Po każdej zmianie albo dodaniu promptu `.md`:

```bash
./backend/scripts/build-prompts.sh   # regeneruje prompts/index.ts
cd backend && supabase functions deploy <funkcja>
```

`index.ts` jest generowany — nie edytuj go ręcznie i commituj razem ze zmianą `.md`.
