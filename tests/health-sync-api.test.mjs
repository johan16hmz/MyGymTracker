import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const parserUrl=compile(readFileSync(new URL('../src/nutritionHealth.ts',import.meta.url),'utf8'));
let calls=[];let responseError=null;let networkError=false;
globalThis.healthTestClient=()=>({rpc:async(name,input)=>{calls.push({name,input});if(networkError)throw new Error('private network details');return {error:responseError};}});
process.env.VITE_SUPABASE_URL='https://example.supabase.co';process.env.VITE_SUPABASE_ANON_KEY='public-test';
const source=readFileSync(new URL('../api/health-sync.ts',import.meta.url),'utf8').replace("import { createClient } from '@supabase/supabase-js';",'const createClient=globalThis.healthTestClient;').replace("'../src/nutritionHealth.js'",JSON.stringify(parserUrl));
const {POST}=await import(compile(source));
const req=(body,headers={})=>new Request('https://test.app/api/health-sync',{method:'POST',headers:{'Authorization':`Bearer ${'a'.repeat(64)}`,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

test('health route rejects missing capability, malformed data and huge bodies before database access',async()=>{
  calls=[];
  assert.equal((await POST(req({}, {Authorization:''}))).status,401);
  assert.equal((await POST(req({}, {'Content-Type':'text/plain'}))).status,415);
  assert.equal((await POST(req({date:'2026-02-30',steps:100}))).status,400);
  assert.equal((await POST(req({date:'2026-10-07',steps:-1}))).status,400);
  assert.equal((await POST(req({padding:'x'.repeat(1000)}))).status,413);
  assert.equal(calls.length,0);
});
test('health route distinguishes network failure from invalid input without leaking details',async()=>{
  networkError=true;
  try{
    const response=await POST(req({date:'2026-10-07',steps:4170}));
    assert.equal(response.status,503);
    assert.ok(!(await response.text()).includes('private network details'));
  }finally{networkError=false;}
});
test('health route only calls the scoped RPC, never leaks errors or caches health',async()=>{
  calls=[];responseError=null;
  const response=await POST(req({date:'2026-10-07',steps:4170,user_id:'injected-owner'}));
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.deepEqual(calls[0],{name:'health_sync_steps',input:{p_token:'a'.repeat(64),p_date:'2026-10-07',p_steps:4170}});
  responseError={code:'42501',message:'private database error'};
  const rejected=await POST(req({date:'2026-10-07',steps:4170}));assert.equal(rejected.status,401);assert.ok(!(await rejected.text()).includes('private database error'));
});
