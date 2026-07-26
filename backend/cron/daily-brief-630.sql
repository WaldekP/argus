-- Cron 6:30 (Warszawa): codzienna generacja briefu dnia dla wszystkich tenantów.
--
-- NIE jest to migracja repo ani nie jest uruchamiane automatycznie: włączenie
-- pg_cron/pg_net to zmiana infrastruktury produkcyjnej bazy Argus, którą
-- świadomie zostawiam do ręcznego zatwierdzenia (tak samo nie jest wpięty cron
-- mentions_sync — patrz CLAUDE.md). Przycisk "Wygeneruj przegląd" na ekranie
-- Brief poranny działa bez crona.
--
-- Jak wdrożyć (jednorazowo, po zatwierdzeniu):
--   1. Uzupełnij <CRON_SECRET> wartością sekretu funkcji (ta sama, którą ma
--      argus-morning-brief w env: `supabase secrets list` pokazuje jej hash,
--      wartość znasz z `supabase secrets set CRON_SECRET=...`).
--   2. Odpal ten plik na bazie Argus (Management API / SQL editor).
--
-- Uwaga o strefie: pg_cron liczy w UTC. 6:30 czasu Warszawy to 04:30 UTC latem
-- (CEST, UTC+2) i 05:30 UTC zimą (CET, UTC+1). Poniżej wariant letni; zimą
-- zmień na '30 5 * * *' albo pogódź się z briefem o 5:30/6:30 zależnie od DST.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'argus-daily-brief',
  '30 4 * * *',
  $$
  select net.http_post(
    url := 'https://jgwvtlghpkztivbhnofi.supabase.co/functions/v1/argus-morning-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-argus-cron', '<CRON_SECRET>'
    ),
    body := jsonb_build_object('operation', 'generate')
  );
  $$
);

-- Podgląd / usunięcie:
--   select * from cron.job where jobname = 'argus-daily-brief';
--   select cron.unschedule('argus-daily-brief');
