-- Hosted Supabase projects no longer grant table privileges to service_role by
-- default (only REFERENCES, TRIGGER, TRUNCATE), unlike the local image. The
-- server-only admin client (src/lib/supabase/admin.ts) uses service_role for:
-- the hourly recurring job (/api/cron/recurring), account deletion, and the
-- weekly feedback triage. Grant it explicit access to the app's tables so hosted
-- matches local. service_role bypasses RLS and is never exposed to browsers.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tables added by later migrations get the same access.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
