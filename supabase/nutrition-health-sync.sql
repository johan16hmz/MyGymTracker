-- NOT YET APPLIED. Run once in the project's SQL editor before enabling
-- Shortcuts. No service-role key: the narrowly scoped RPC validates a
-- revocable 256-bit capability and can ONLY replace its owner's step totals.
begin;
create schema if not exists mygym_private;
revoke all on schema mygym_private from public, anon, authenticated;
create table if not exists mygym_private.health_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null
);
alter table mygym_private.health_tokens enable row level security;
revoke all on mygym_private.health_tokens from public, anon, authenticated;

create table if not exists public.health_step_totals (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  count integer not null check (count between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.health_step_totals enable row level security;
revoke all on public.health_step_totals from public, anon, authenticated;
grant select on public.health_step_totals to authenticated;
drop policy if exists health_steps_owner on public.health_step_totals;
create policy health_steps_owner on public.health_step_totals for select to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.health_sync_status() returns timestamptz
language sql security definer set search_path = '' as $$
  select expires_at from mygym_private.health_tokens
  where user_id = auth.uid() and expires_at > now();
$$;
create or replace function public.health_sync_enable(p_token text) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare v_expiry timestamptz := now() + interval '1 year';
begin
  if auth.uid() is null or p_token !~ '^[a-f0-9]{64}$' or p_token is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  insert into mygym_private.health_tokens(user_id, token_hash, expires_at)
  values(auth.uid(), encode(sha256(convert_to(p_token,'UTF8')),'hex'), v_expiry)
  on conflict(user_id) do update set token_hash=excluded.token_hash, expires_at=excluded.expires_at;
  return v_expiry;
end;
$$;
create or replace function public.health_sync_revoke() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized' using errcode='42501'; end if;
  delete from mygym_private.health_tokens where user_id=auth.uid();
end;
$$;
create or replace function public.health_sync_steps(p_token text, p_date date, p_steps integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Unauthorized' using errcode='42501';
  end if;
  -- Serialize with revocation/key rotation for the same account.
  select user_id into v_user from mygym_private.health_tokens
  where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and expires_at>now() for update;
  if v_user is null then raise exception 'Unauthorized' using errcode='42501'; end if;
  if p_steps is null or p_steps not between 0 and 100000 or p_date is null
     or p_date < current_date - 7 or p_date > current_date + 1 then
    raise exception 'Invalid steps or date' using errcode='22023';
  end if;
  -- Same day's total is replaced, never added; duplicate retries are safe.
  -- At most one changed total per minute and day.
  insert into public.health_step_totals(user_id,date,count) values(v_user,p_date,p_steps)
  on conflict(user_id,date) do update set count=excluded.count, updated_at=now()
  where health_step_totals.count <> excluded.count and health_step_totals.updated_at < now()-interval '1 minute';
end;
$$;
revoke all on function public.health_sync_status() from public, anon;
revoke all on function public.health_sync_enable(text) from public, anon;
revoke all on function public.health_sync_revoke() from public, anon;
revoke all on function public.health_sync_steps(text,date,integer) from public, authenticated;
grant execute on function public.health_sync_status(), public.health_sync_enable(text), public.health_sync_revoke() to authenticated;
grant execute on function public.health_sync_steps(text,date,integer) to anon;
commit;
