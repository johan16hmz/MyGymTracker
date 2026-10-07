// Optional isolated PostgreSQL regression tests. Never touches Supabase.
// NUTRITION_PGLITE_MODULE points to a temporary @electric-sql/pglite install.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

test('Health sync: isolation, scoped capability, expiry, revocation and idempotency',{skip:!process.env.NUTRITION_PGLITE_MODULE},async()=>{
  const {PGlite}=await import(pathToFileURL(process.env.NUTRITION_PGLITE_MODULE).href);
  const db=new PGlite();
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
  const token='a'.repeat(64),second='b'.repeat(64);
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${a}'),('${b}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
    const migration=readFileSync(new URL('../supabase/nutrition-health-sync.sql',import.meta.url),'utf8');
    await db.exec(migration);await db.exec(migration); // idempotent deployment
    const asRole=async(role,user,sql)=>{
      await db.exec(`reset role;set role ${role};set request.jwt.claim.sub='${user}';`);
      try{return await db.query(sql);}finally{await db.exec('reset role;');}
    };
    assert.equal((await asRole('authenticated',a,'select public.health_sync_status() as expiry')).rows[0].expiry,null);
    await assert.rejects(asRole('anon','',`select public.health_sync_enable('${token}')`));
    await assert.rejects(asRole('authenticated',a,`select public.health_sync_enable('short')`));
    await asRole('authenticated',a,`select public.health_sync_enable('${token}')`);
    assert.ok((await asRole('authenticated',a,'select public.health_sync_status() as expiry')).rows[0].expiry);
    assert.equal((await asRole('authenticated',b,'select public.health_sync_status() as expiry')).rows[0].expiry,null);
    await assert.rejects(asRole('authenticated',a,'select * from mygym_private.health_tokens'));
    await assert.rejects(asRole('anon','',`select public.health_sync_steps('${second}',current_date,1234)`));
    await assert.rejects(asRole('anon','',`select public.health_sync_steps('${token}',current_date,-1)`));
    await assert.rejects(asRole('anon','',`select public.health_sync_steps('${token}',current_date-8,100)`));
    await asRole('anon','',`select public.health_sync_steps('${token}',current_date,1234)`);
    await asRole('anon','',`select public.health_sync_steps('${token}',current_date,1234)`);
    assert.equal((await asRole('authenticated',a,'select count from public.health_step_totals')).rows[0].count,1234);
    assert.equal((await asRole('authenticated',b,'select count from public.health_step_totals')).rows.length,0);
    await assert.rejects(asRole('anon','','select * from public.health_step_totals'));
    await assert.rejects(asRole('authenticated',a,'update public.health_step_totals set count=9999'));
    await asRole('anon','',`select public.health_sync_steps('${token}',current_date,9999)`);
    assert.equal((await asRole('authenticated',a,'select count from public.health_step_totals')).rows[0].count,1234); // throttle
    await db.exec("update public.health_step_totals set updated_at=now()-interval '2 minutes'");
    await asRole('anon','',`select public.health_sync_steps('${token}',current_date,2345)`);
    assert.equal((await asRole('authenticated',a,'select count from public.health_step_totals')).rows[0].count,2345); // replace, not add
    await asRole('authenticated',a,`select public.health_sync_enable('${second}')`);
    await assert.rejects(asRole('anon','',`select public.health_sync_steps('${token}',current_date,2345)`));
    await db.exec("update mygym_private.health_tokens set expires_at=now()-interval '1 day'");
    await assert.rejects(asRole('anon','',`select public.health_sync_steps('${second}',current_date,2345)`));
    await asRole('authenticated',a,`select public.health_sync_enable('${token}')`);
    await asRole('authenticated',b,'select public.health_sync_revoke()'); // cannot revoke A
    await asRole('anon','',`select public.health_sync_steps('${token}',current_date,2345)`);
    await asRole('authenticated',a,'select public.health_sync_revoke()');
    await assert.rejects(asRole('anon','',`select public.health_sync_steps('${token}',current_date,2345)`));
  }finally{await db.close();}
});
