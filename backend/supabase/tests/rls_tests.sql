-- =============================================================================
-- Testy RLS (brief 14, sekcja 8): tenant A nie może zobaczyć danych tenanta B.
-- Uruchamiane na bazie w transakcji z rollbackiem: nie zostawiają danych.
-- Każde niespełnione oczekiwanie rzuca wyjątek FAIL, sukces zwraca 'RLS OK'.
-- Uruchomienie: backend/scripts/run-rls-tests.sh (Management API).
-- =============================================================================

begin;

-- Syntetyczni użytkownicy testowi
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'rls-test-a@test.local', 'test-only',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'rls-test-b@test.local', 'test-only',
   now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into public.tenants (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'RLS Test Tenant A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'RLS Test Tenant B');

insert into public.memberships (user_id, tenant_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'politician'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'assistant');

insert into public.statements (tenant_id, source, text) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'manual', 'sekret tenanta A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manual', 'sekret tenanta B');

insert into public.promises (tenant_id, text) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'obietnica tenanta B');

insert into public.access_logs (tenant_id, action, resource) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test', 'rls');

insert into public.outlets (id, name, type) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Testowa Redakcja', 'portal');

insert into public.journalists (full_name, outlet_id, takedown_requested) values
  ('Jan Testowy', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false),
  ('Anna Ukryta', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);

-- ---------------------------------------------------------------------------
-- Jako user A (tenant A)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);

do $$
declare c integer;
begin
  select count(*) into c from public.tenants;
  if c <> 1 then raise exception 'FAIL: user A widzi % tenantow (oczekiwano 1)', c; end if;

  select count(*) into c from public.tenants where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  if c <> 0 then raise exception 'FAIL: user A widzi tenanta B'; end if;

  select count(*) into c from public.statements;
  if c <> 1 then raise exception 'FAIL: user A widzi % statements (oczekiwano 1)', c; end if;

  select count(*) into c from public.statements where text = 'sekret tenanta B';
  if c <> 0 then raise exception 'FAIL: user A czyta statements tenanta B'; end if;

  select count(*) into c from public.promises;
  if c <> 0 then raise exception 'FAIL: user A widzi promises tenanta B'; end if;

  select count(*) into c from public.memberships;
  if c <> 1 then raise exception 'FAIL: user A widzi % memberships (oczekiwano 1)', c; end if;

  select count(*) into c from public.access_logs;
  if c <> 0 then raise exception 'FAIL: access_logs widoczne dla klienta'; end if;

  -- Tabele globalne: odczyt działa, takedown ukrywa dziennikarza
  select count(*) into c from public.outlets;
  if c <> 1 then raise exception 'FAIL: brak odczytu tabel globalnych'; end if;

  select count(*) into c from public.journalists;
  if c <> 1 then raise exception 'FAIL: journalists z takedown widoczni (%)', c; end if;

  -- Zapis do własnego tenanta działa
  insert into public.statements (tenant_id, source, text)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'manual', 'wpis usera A');

  -- Zapis do cudzego tenanta musi zostać odrzucony
  begin
    insert into public.statements (tenant_id, source, text)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'manual', 'wlamanie');
    raise exception 'FAIL: insert do tenanta B przeszedl';
  exception
    when insufficient_privilege then null;
  end;

  -- Zapis do tabeli globalnej musi zostać odrzucony
  begin
    insert into public.outlets (name, type) values ('Nielegalna', 'tv');
    raise exception 'FAIL: insert do tabeli globalnej przeszedl';
  exception
    when insufficient_privilege then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- Jako user B (tenant B)
-- ---------------------------------------------------------------------------
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',
  true
);

do $$
declare c integer;
begin
  select count(*) into c from public.tenants;
  if c <> 1 then raise exception 'FAIL: user B widzi % tenantow (oczekiwano 1)', c; end if;

  select count(*) into c from public.statements where text like 'sekret tenanta A%';
  if c <> 0 then raise exception 'FAIL: user B czyta statements tenanta A'; end if;

  select count(*) into c from public.statements where text = 'wpis usera A';
  if c <> 0 then raise exception 'FAIL: user B widzi nowy wpis tenanta A'; end if;

  select count(*) into c from public.promises;
  if c <> 1 then raise exception 'FAIL: user B nie widzi wlasnych promises'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Anonimowo (bez sesji): nic z danych tenantów ani tabel globalnych
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

do $$
declare c integer;
begin
  select count(*) into c from public.tenants;
  if c <> 0 then raise exception 'FAIL: anon widzi tenants'; end if;
  select count(*) into c from public.statements;
  if c <> 0 then raise exception 'FAIL: anon widzi statements'; end if;
  select count(*) into c from public.journalists;
  if c <> 0 then raise exception 'FAIL: anon widzi journalists'; end if;
end $$;

rollback;

select 'RLS OK' as result;
