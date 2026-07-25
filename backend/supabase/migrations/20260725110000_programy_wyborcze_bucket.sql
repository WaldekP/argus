-- Bucket na PDF-y programów wyborczych partii sejmowych (2011-2023).
-- Dokumenty są jawne (oficjalne programy publikowane przez komitety), więc
-- bucket jest publiczny: odczyt przez stały URL bez podpisywania.
-- Zapis: żadnych polityk INSERT/UPDATE/DELETE dla ról klienckich, więc
-- modyfikacje wyłącznie przez service_role (upload z backend/scripts).
insert into storage.buckets (id, name, public)
values ('programy-wyborcze', 'programy-wyborcze', true)
on conflict (id) do update set public = true;
