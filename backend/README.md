# Backend Argus.ai (Supabase)

Backend aplikacji: Postgres (+ pgvector), Auth, Edge Functions (Deno), Storage. Osobny projekt Supabase (EU/Frankfurt), niewspółdzielony z innymi aplikacjami.

## Lokalny start

Wymagany Supabase CLI oraz Docker. Z katalogu `backend/`:

```sh
supabase start    # podnosi lokalny stack (Postgres, Auth, Edge Functions)
supabase stop     # zatrzymuje stack
```

Dokumentacja: https://supabase.com/docs/guides/local-development

Migracje leżą w `supabase/migrations/`, konfiguracja w `supabase/config.toml`.

## Konwencja Edge Functions

- **Jedna funkcja per domena** (np. `argus-brief`, `argus-content`), pole `operation` w body requestu wybiera operację.
- Każda funkcja: obsługa preflight CORS (`_shared/cors.ts`) → weryfikacja tokena (`authenticateRequest` z `_shared/auth.ts`) → walidacja `tenant_id` (`getTenantId`) → operacja → `jsonResponse` (`_shared/types.ts`).
- Klucz `service_role` i klucze AI istnieją wyłącznie w Edge Functions, nigdy w kliencie.

## AI

- Modele: `claude-sonnet-5` (generacja: briefy, treści), `claude-haiku-4-5` (klasyfikacja).
- Wywołania przez LangChain/LangGraph, importy jako `npm:` specifiers (Deno): `npm:@langchain/anthropic`, `npm:@langchain/langgraph`. Fabryki modeli i loader promptów w `supabase/functions/_shared/ai.ts`, szkielet pipeline'u briefu w `_shared/pipelines/brief.ts`.
- Sekret ustawiamy przez CLI, nigdy w kodzie ani w kliencie:

```sh
supabase secrets set ANTHROPIC_API_KEY=...
```

## Prompty

Wszystkie prompty (po polsku, wersjonowane w gicie) leżą w `supabase/functions/_shared/prompts/` — zasady w tamtejszym `README.md`.

## Skrypty

`scripts/` — skrypty seedujące bazę mediów (scraping bio + analiza LLM), wynik jako pliki seed. Szczegóły w `scripts/README.md`.
