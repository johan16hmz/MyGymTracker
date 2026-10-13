import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
let payload,filters,signal,response;
globalThis.strengthSaveTestClient={from(table){assert.equal(table,'workouts');filters=[];const query={update(value){payload=value;return query;},insert(value){payload=value;return query;},eq(key,value){filters.push([key,value]);return query;},select(){return query;},abortSignal(value){signal=value;return query;},async single(){return response;}};return query;}};
const compiled=ts.transpileModule(readFileSync(new URL('../src/strengthService.ts',import.meta.url),'utf8').replace("import { supabase } from './supabaseClient';",'const supabase=globalThis.strengthSaveTestClient;'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText;
const {saveStrengthBlock}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const existing={id:'block-id',exercises:[{id:'block-data'}]};
test('saving Force keeps edited weight and shared body weight in an owner-scoped record',async()=>{
  const block={version:1,bodyWeight:82.5,exercises:[{id:'pullup',target:35,prescriptions:[{id:'p1',weight:21.25,reps:5,performances:[{weight:20,reps:5}]}]}]};
  response={data:{id:existing.id,exercises:[{strengthBlock:block}]},error:null};
  await saveStrengthBlock('owner-a','My block',block,existing);
  assert.deepEqual(payload.exercises[0].strengthBlock,block);
  assert.equal(payload.exercises[0].id,'block-data');
  assert.deepEqual(filters,[['id','block-id'],['user_id','owner-a']]);
  assert.ok(signal instanceof AbortSignal);
});
test('Force failures are reported without mutating draft values',async()=>{
  const draft={version:1,bodyWeight:80,exercises:[]};const original=structuredClone(draft);
  response={data:null,error:{message:'Network error'}};
  await assert.rejects(saveStrengthBlock('owner-a','My block',draft,existing),/saisies sont conservées/);
  assert.deepEqual(draft,original);
});
test('Force never claims a save succeeded without a returned record',async()=>{
  response={data:null,error:null};
  await assert.rejects(saveStrengthBlock('owner-a','My block',{version:1,exercises:[]},existing),/Enregistrement impossible/);
});
