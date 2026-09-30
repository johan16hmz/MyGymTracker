-- Remove unnecessary privileges without opening access to profile rows.
-- public.users currently has RLS enabled and no policies (default deny).
-- TRUNCATE is not governed by RLS; it must not be granted to API roles.
begin;
revoke all on table public.users from anon, public;
revoke truncate, references, trigger on table public.users from authenticated;
commit;
