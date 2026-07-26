-- Powiazanie draftu przekazu z tematem, z ktorego zostal wygenerowany.
-- Generacja przeniesiona z osobnej zakladki do wnetrza tematu (korpus
-- tematyczny albo dossier uzytkownika), wiec drafty listujemy per temat oraz
-- globalnie. `topic_ref` trzyma slug korpusu (np. 'kwota-wolna') albo
-- referencje do dossieru w formie 'dossier:<uuid>'. NULL = brak powiazania
-- (drafty sprzed tej zmiany albo generacja bez kontekstu tematu).
alter table public.content_drafts
  add column if not exists topic_ref text;

-- Lista przekazow danego tematu: filtr po tenant + topic_ref, sort po dacie.
create index if not exists content_drafts_tenant_topic_ref_idx
  on public.content_drafts (tenant_id, topic_ref, created_at desc);
