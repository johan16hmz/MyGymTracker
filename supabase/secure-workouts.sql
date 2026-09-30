-- Applied to the production Supabase project on 2026-09-30.
-- Keep this script as a reproducible, idempotent record of the fix.
-- Protect the private workouts table (also contains strength and nutrition).
-- The transaction changes permissions only; it does not change stored rows.
begin;

alter table public.workouts enable row level security;
revoke all on table public.workouts from anon, authenticated, public;
grant select, insert, update, delete on table public.workouts to authenticated;

-- A restrictive boundary also constrains any pre-existing permissive policies.
drop policy if exists mygymtracker_owner_boundary on public.workouts;
create policy mygymtracker_owner_boundary on public.workouts
  as restrictive for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists mygymtracker_owner_access on public.workouts;
create policy mygymtracker_owner_access on public.workouts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

commit;
