-- Harmonogram Argusa (pg_cron + pg_net). Wdrożony na produkcji 2026-09-08.
--
-- Zastępuje daily-brief-630.sql: ten plik trzyma komplet zadań, nie samą
-- generację briefu. Wartości `<...>` uzupełnij przed uruchomieniem; klucz anon
-- jest publiczny, sekret crona NIE i nie może trafić do repo.
--
-- Dwie pułapki, na które nadziałem się przy wdrożeniu:
--
-- 1. Sam nagłówek `x-argus-cron` NIE wystarczy. Bramka Edge Functions odrzuca
--    żądanie bez `Authorization` odpowiedzią 401 UNAUTHORIZED_NO_AUTH_HEADER,
--    zanim dojdzie ono do naszego kodu. Dlatego w nagłówkach jest ponadto klucz
--    anon: bramka go akceptuje, a `isAuthorized()` w funkcji i tak sprawdza
--    sekret crona. Wcześniejsza wersja tego pliku miała sam `x-argus-cron`,
--    więc zadanie wykonywałoby się co dzień i za każdym razem dostawało 401,
--    bez śladu w aplikacji.
--
-- 2. Management API zwraca dla sekretu pole `value`, ale jest to HASH, a nie
--    wartość. Sekret znasz wyłącznie w momencie ustawiania go przez
--    `supabase secrets set CRON_SECRET=...` (albo POST /v1/projects/{ref}/secrets).
--
-- Strefa czasowa: pg_cron liczy w UTC. Poniżej wariant letni (CEST, UTC+2).
-- Zimą (CET, UTC+1) przesuń `argus-sejm-sync` na '0 4 * * *', a
-- `argus-daily-brief` na '30 5 * * *', albo pogódź się z godziną w tę i we w tę.
--
-- Podgląd i usunięcie:
--   select jobname, schedule, active from cron.job order by jobname;
--   select * from cron.job_run_details order by start_time desc limit 20;
--   select cron.unschedule('argus-daily-brief');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Wspólne nagłówki. `cron.schedule` po nazwie nadpisuje istniejące zadanie,
-- więc ten plik można uruchomić ponownie po zmianie sekretu.

-- 03:00 UTC (05:00 Warszawa): świeże głosowania i wystąpienia z API Sejmu,
-- zanim brief zacznie je czytać.
select cron.schedule('argus-sejm-sync', '0 3 * * *', $job$
  select net.http_post(
    url := 'https://jgwvtlghpkztivbhnofi.supabase.co/functions/v1/argus-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_KEY>',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-argus-cron', '<CRON_SECRET>'
    ),
    body := jsonb_build_object('operation', 'sejm_sync'),
    timeout_milliseconds := 20000
  );
$job$);

-- 04:30 UTC (06:30 Warszawa): synteza przeglądu dnia dla wszystkich tenantów.
select cron.schedule('argus-daily-brief', '30 4 * * *', $job$
  select net.http_post(
    url := 'https://jgwvtlghpkztivbhnofi.supabase.co/functions/v1/argus-morning-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_KEY>',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-argus-cron', '<CRON_SECRET>'
    ),
    body := jsonb_build_object('operation', 'generate'),
    timeout_milliseconds := 20000
  );
$job$);

-- Co trzy godziny: wzmianki z Bing News dla haseł wszystkich tenantów.
-- Jeden przebieg bierze najdawniej odświeżane hasła, więc częstszy cron
-- oznacza świeższe dane przy tej samej porcji pracy na wywołanie.
select cron.schedule('argus-mentions-sync', '0 */3 * * *', $job$
  select net.http_post(
    url := 'https://jgwvtlghpkztivbhnofi.supabase.co/functions/v1/argus-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_KEY>',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-argus-cron', '<CRON_SECRET>'
    ),
    body := jsonb_build_object('operation', 'mentions_sync'),
    timeout_milliseconds := 20000
  );
$job$);

-- Co trzy godziny, pół godziny po Bingu, żeby oba przebiegi się nie nakładały:
-- wzmianki z Brand24 razem z oceną tonu (Haiku).
select cron.schedule('argus-brand24-sync', '30 */3 * * *', $job$
  select net.http_post(
    url := 'https://jgwvtlghpkztivbhnofi.supabase.co/functions/v1/argus-ingest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<ANON_KEY>',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-argus-cron', '<CRON_SECRET>'
    ),
    body := jsonb_build_object('operation', 'brand24_sync'),
    timeout_milliseconds := 20000
  );
$job$);
