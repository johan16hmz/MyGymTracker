import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const nutritionUrl=compile(readFileSync(new URL('../src/nutrition.ts',import.meta.url),'utf8'));
const statisticsUrl=compile(readFileSync(new URL('../src/statistics.ts',import.meta.url),'utf8').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`));
let calls=[];let record;let health={data:null,error:{code:'PGRST205'}};let written;
globalThis.nutritionTestClient={from(table){
  const query={
    select(columns){calls.push({table,operation:'select',columns});return query;},
    eq(column,value){calls.push({table,operation:'eq',column,value});return query;},
    update(payload){written=payload;calls.push({table,operation:'update'});return query;},
    insert(payload){written=payload;calls.push({table,operation:'insert'});return query;},
    async limit(){return {data:record?[record]:[],error:null};},
    async maybeSingle(){return health;},
    async single(){return {data:{id:'saved',...written},error:null};},
  };
  return query;
}};
const source=readFileSync(new URL('../src/nutritionService.ts',import.meta.url),'utf8').replace("import { supabase } from './supabaseClient';",'const supabase=globalThis.nutritionTestClient;').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`).replaceAll("from './statistics';",`from ${JSON.stringify(statisticsUrl)};`);
const {loadNutritionDay,saveNutritionDay,saveNutritionProfile}=await import(compile(source));
const date='2026-10-07';

test('nutrition remains usable before the optional Health migration, with owner and date filters',async()=>{
  calls=[];record=undefined;health={data:null,error:{code:'PGRST205'}};
  assert.deepEqual((await loadNutritionDay('owner-a',date)).day,{date,entries:[]});
  for(const table of ['workouts','health_step_totals']){
    assert.ok(calls.some(call=>call.table===table && call.column==='user_id' && call.value==='owner-a'));
    assert.ok(calls.some(call=>call.table===table && call.column==='date' && call.value===date));
  }
});
test('Health timestamps are compared as instants rather than timezone-dependent strings',async()=>{
  const day={date,entries:[],waterMl:750,steps:{count:123,source:'manual',updatedAt:'2026-10-07T19:30:00Z'}};
  record={exercises:[{nutritionDay:day}]};
  health={data:{count:500,updated_at:'2026-10-07T20:00:00+01:00'},error:null};
  assert.equal((await loadNutritionDay('owner-a',date)).day.steps.count,123);
  health={data:{count:600,updated_at:'2026-10-07T20:31:00+01:00'},error:null};
  const result=(await loadNutritionDay('owner-a',date)).day;
  assert.equal(result.steps.count,600);assert.equal(result.steps.source,'apple-shortcuts');
  assert.equal(result.waterMl,750);assert.deepEqual(result.entries,[]);
});
test('an unreadable Health total blocks stale day writes instead of silently discarding it',async()=>{
  record=undefined;health={data:null,error:{code:'42501'}};
  await assert.rejects(loadNutritionDay('owner-a',date),/Impossible de charger les pas/);
});
test('saving foods retains step totals and water and scopes updates to the owner',async()=>{
  calls=[];
  const day={date,entries:[],waterMl:1250,steps:{count:4170,source:'apple-shortcuts',updatedAt:'2026-10-07T19:30:00Z'}};
  await saveNutritionDay('owner-a',day,{id:'day-record',date,exercises:[{id:'exercise-record'}]});
  assert.deepEqual(written.exercises[0].nutritionDay,day);
  assert.equal(written.exercises[0].id,'exercise-record');
  assert.ok(calls.some(call=>call.column==='user_id' && call.value==='owner-a'));
  assert.ok(calls.some(call=>call.column==='id' && call.value==='day-record'));
});
test('saving a profile retains the latest server weight history and records today without backdating',async()=>{
  calls=[];record={id:'profile',date:'2026-09-01',exercises:[{id:'profile-data',nutritionProfile:{weightKg:79,weightHistory:[{date:'2026-10-01',weightKg:79}]}}]};
  await saveNutritionProfile('owner-a',{weightKg:80},{id:'stale',exercises:[{id:'stale-data'}]});
  assert.equal(written.exercises[0].nutritionProfile.weightHistory[0].weightKg,79);
  assert.equal(written.exercises[0].nutritionProfile.weightHistory.at(-1).weightKg,80);
  assert.equal(written.exercises[0].id,'profile-data');
  assert.ok(calls.some(call=>call.column==='id' && call.value==='profile'));
  assert.ok(calls.some(call=>call.column==='user_id' && call.value==='owner-a'));
});
