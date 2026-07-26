-- =============================================================================
-- Migracja: brief dnia (synteza).
--
-- Codzienny, syntetyczny przeglad polskiej polityki pod kat strategii polityka
-- tenanta. Jeden brief na dobe na tenant. Warstwa syntezy nad surowym strumieniem
-- wzmianek (`mentions`) — realizacja pominietej polowy TASK 9.
--
-- Wydarzenia trzymane jako jsonb (`items`), bo brief to gotowy artefakt czytany
-- w calosci (jak dossier / analizy), nie zbior rekordow do odpytywania osobno.
--
-- Projekt: docs/superpowers/specs/2026-07-26-brief-dnia-synteza-design.md
-- =============================================================================

create table if not exists public.daily_briefs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,

  -- Doba, ktorej dotyczy brief. Jeden brief na tenant na dzien.
  brief_date date not null,

  -- generating: trwa zbieranie i synteza; ready: gotowy (takze pusty, gdy cisza);
  -- error: synteza sie nie powiodla, szczegol w `error`.
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'error')),

  -- Jedno zdanie "naglowek dnia".
  lead text,

  -- Tablica wydarzen. Ksztalt jednego elementu:
  --   { kategoria, naglowek, streszczenie, znaczenie_dla_ciebie,
  --     zrodla: [{ tytul, url, redakcja }], source_type }
  items jsonb not null default '[]',

  -- Ile prasy / Sejmu wzieto pod uwage (diagnostyka, nie do UI).
  source_stats jsonb not null default '{}',

  model text,
  error text,
  generated_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, brief_date)
);

create index if not exists daily_briefs_tenant_date_idx
  on public.daily_briefs (tenant_id, brief_date desc);

-- ---------------------------------------------------------------------------
-- RLS — pelny dostep tylko w obrebie wlasnego tenanta (wzorzec jak `mentions`).
-- ---------------------------------------------------------------------------

alter table public.daily_briefs enable row level security;

create policy "daily_briefs: pelny dostep w tenancie"
  on public.daily_briefs for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create trigger set_updated_at before update on public.daily_briefs
  for each row execute function public.set_updated_at();
