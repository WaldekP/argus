-- =============================================================================
-- Migracja: brand24_projects — powiazanie tenanta z projektem monitoringu
-- Brand24 (Data API).
--
-- Kazdy tenant ma jeden projekt Brand24 (project_id = zestaw hasel u dostawcy).
-- Hasel nie da sie zmienic przez API po zalozeniu, wiec trzymamy tez ich kopie.
-- `watched_topic_id` to syntetyczne haslo w topics_watched, pod ktore podpinamy
-- wzmianki z Brand24 (mentions.topic_id jest NOT NULL z FK do topics_watched).
--
-- Charakter: konfiguracja per tenant. Zapis wylacznie service_role (Edge
-- Function argus-ingest, operacje brand24_setup/brand24_sync). Odczyt dla
-- czlonkow tenanta, zeby UI moglo pokazac status monitoringu.
-- =============================================================================

create table public.brand24_projects (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  account_id text not null,
  project_id text not null,
  keywords jsonb not null default '[]',
  watched_topic_id uuid references public.topics_watched(id) on delete set null,
  last_synced_at timestamptz,
  last_cursor text,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.brand24_projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: odczyt dla czlonkow tenanta; zapis tylko service_role (omija RLS, wiec
-- brak polityki insert/update/delete jest celowy).
-- ---------------------------------------------------------------------------

alter table public.brand24_projects enable row level security;

create policy "brand24_projects: odczyt dla czlonkow tenanta"
  on public.brand24_projects for select to authenticated
  using (tenant_id in (select app.user_tenant_ids()));

-- ---------------------------------------------------------------------------
-- Brand24 jako nowe zrodlo wzmianek: rozszerzenie dopuszczalnych wartosci
-- mentions.source (dotad tylko RSS-owe).
-- ---------------------------------------------------------------------------

alter table public.mentions drop constraint if exists mentions_source_check;
alter table public.mentions add constraint mentions_source_check
  check (source = any (array['bing_news', 'google_news', 'rss', 'brand24']));
