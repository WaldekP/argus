-- =============================================================================
-- Migracja: rozmowy z asystentem Argusem (zakładka Asystent, argus-assistant)
--
-- Tabele tenanta: assistant_conversations (wątek z tytułem) i
-- assistant_messages (wpisy user/assistant). RLS per tenant przez
-- app.user_tenant_ids(), trigger updated_at na wątku (odświeżany przy każdej
-- nowej wiadomości, żeby lista historii sortowała się po ostatniej aktywności).
-- Projekt: docs/superpowers/specs/2026-07-27-asystent-argus-design.md
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabele
-- ---------------------------------------------------------------------------

create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Tytuł z pierwszego pytania (przycinany w Edge Function).
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  conversation_id uuid not null
    references public.assistant_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Indeksy
-- ---------------------------------------------------------------------------

-- Lista historii: rozmowy tenanta po ostatniej aktywności.
create index assistant_conversations_tenant_updated_idx
  on public.assistant_conversations (tenant_id, updated_at desc);

-- Odczyt wątku: wiadomości rozmowy w kolejności powstania.
create index assistant_messages_conversation_created_idx
  on public.assistant_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------

alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;

create policy "assistant_conversations: pelny dostep w tenancie"
  on public.assistant_conversations for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

create policy "assistant_messages: pelny dostep w tenancie"
  on public.assistant_messages for all to authenticated
  using (tenant_id in (select app.user_tenant_ids()))
  with check (tenant_id in (select app.user_tenant_ids()));

-- ---------------------------------------------------------------------------
-- 4. Trigger updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.assistant_conversations
  for each row execute function public.set_updated_at();
