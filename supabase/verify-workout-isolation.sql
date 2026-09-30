-- Run as postgres in the SQL editor. Uses one synthetic workout only.
-- All changes and local role/claim settings are rolled back.
-- Does not return account IDs or personal workout data.
begin;
do $$
declare owner_id uuid;
begin
  select user_id into owner_id from public.workouts where user_id is not null limit 1;
  if owner_id is null then raise exception 'An existing workout owner is required'; end if;
  perform set_config('mygymtracker.audit_owner', owner_id::text, true);
  perform set_config('mygymtracker.audit_workout', gen_random_uuid()::text, true);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
end $$;

set local role authenticated;
do $$
declare
  probe_id uuid := current_setting('mygymtracker.audit_workout')::uuid;
  owner_id uuid := current_setting('mygymtracker.audit_owner')::uuid;
  affected integer;
begin
  if not exists (select 1 from public.workouts where user_id = owner_id) then
    raise exception 'Owner cannot read existing workouts';
  end if;
  insert into public.workouts (id,user_id,name,date,exercises)
    values (probe_id,owner_id,'__security_probe__',now(),'[]'::jsonb);
  update public.workouts set name='__security_probe_updated__' where id=probe_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner update failed'; end if;

  -- Simulate a different authenticated identity, with no owned rows.
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if exists (select 1 from public.workouts) then
    raise exception 'Other account can read private workouts';
  end if;
  update public.workouts set name='__forbidden__' where id=probe_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account can update'; end if;
  delete from public.workouts where id=probe_id;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account can delete'; end if;
  begin
    insert into public.workouts (id,user_id,name,date,exercises)
      values (gen_random_uuid(),owner_id,'__forbidden__',now(),'[]'::jsonb);
    raise exception 'Other account can insert for owner';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  begin
    update public.workouts set user_id=gen_random_uuid() where id=probe_id;
    raise exception 'Owner can transfer ownership';
  exception when insufficient_privilege then null;
  end;
  delete from public.workouts where id=probe_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner delete failed'; end if;
end $$;

set local role anon;
do $$
begin
  begin
    perform 1 from public.workouts limit 1;
    raise exception 'Anonymous workout access is allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.users limit 1;
    raise exception 'Anonymous profile access is allowed';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
select 'PASS: owner CRUD, cross-account denial, ownership protection, anonymous denial. All test changes rolled back.' as result;
