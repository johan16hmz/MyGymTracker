import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const nutritionUrl=compile(readFileSync(new URL('../src/nutrition.ts',import.meta.url),'utf8'));
const mealsUrl=compile(readFileSync(new URL('../src/nutritionMeals.ts',import.meta.url),'utf8'));
const trainingUrl=compile(readFileSync(new URL('../src/trainingSessions.ts',import.meta.url),'utf8').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`));
const statisticsUrl=compile(readFileSync(new URL("../src/statistics.ts",import.meta.url),"utf8").replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`).replaceAll("from './trainingSessions';",`from ${JSON.stringify(trainingUrl)};`));
let calls=[];let record;let health={data:null,error:{code:'PGRST205'}};let written;let historyRecords=[];let page;let writeError=null;
globalThis.nutritionTestClient={from(table){
  const query={
    select(columns){calls.push({table,operation:'select',columns});return query;},
    eq(column,value){calls.push({table,operation:'eq',column,value});return query;},
    update(payload){written=payload;calls.push({table,operation:'update'});return query;},
    insert(payload){written=payload;calls.push({table,operation:'insert'});return query;},
    order(column,options){calls.push({table,operation:'order',column,...options});return query;},
    range(start,end){page=[start,end];calls.push({table,operation:'range',start,end});return query;},
    abortSignal(){return query;},
    then(resolve,reject){return Promise.resolve({data:historyRecords.slice(page[0],page[1]+1),error:null}).then(resolve,reject);},
    async limit(){return {data:record?[record]:[],error:null};},
    async maybeSingle(){return health;},
    async single(){return {data:writeError?null:{id:'saved',...written},error:writeError};},
  };
  return query;
}};
const source=readFileSync(new URL('../src/nutritionService.ts',import.meta.url),'utf8').replace("import { supabase } from './supabaseClient';",'const supabase=globalThis.nutritionTestClient;').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`).replaceAll("from './nutritionMeals';",`from ${JSON.stringify(mealsUrl)};`).replaceAll("from './statistics';",`from ${JSON.stringify(statisticsUrl)};`);
const {loadNutritionDay,saveNutritionDay,saveNutritionProfile,loadRecentFoods,loadSavedMeals,saveSavedMeal,isNutritionRecord}=await import(compile(source));
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
test('food history paginates all owner journals, including older than fourteen days',async()=>{
  calls=[];historyRecords=Array.from({length:501},(_,i)=>({id:`day-${i}`,date:'2026-08-01',exercises:[{nutritionDay:{entries:[{id:`food-${i}`,quantity:65,addedAt:'2026-08-01T08:00:00Z',food:{name:'Avoine'}}]}}]}));
  const result=await loadRecentFoods('owner-a');
  assert.equal(result.length,501);assert.equal(result[500].diaryDate,'2026-08-01');
  assert.deepEqual(calls.filter(call=>call.operation==='range').map(call=>[call.start,call.end]),[[0,499],[500,999]]);
  assert.equal(calls.filter(call=>call.column==='user_id' && call.value==='owner-a').length,2);
  assert.equal(calls.filter(call=>call.column==='name' && call.value==='__nutrition_day__').length,2);
});
test('nutrition saves refined activity inputs alongside the owner profile and weight history',async()=>{
  calls=[];record={id:'profile',date:'2026-09-01',exercises:[{id:'profile-data',nutritionProfile:{weightKg:80,weightHistory:[{date:'2026-10-01',weightKg:79}]}}]};
  const profile={weightKg:80,goal:'gain',goalDate:'2027-04-13',activity:'active',dailyActivity:'sedentary',sessionsPerWeek:4,sessionMinutes:60,trainingKind:'strength',equationSex:'female'};
  await saveNutritionProfile('owner-a',profile);
  const saved=written.exercises[0].nutritionProfile;
  for(const key of ['goalDate','dailyActivity','sessionsPerWeek','sessionMinutes','trainingKind','equationSex'])assert.equal(saved[key],profile[key]);
  assert.equal(saved.weightHistory[0].weightKg,79);
  assert.ok(calls.some(call=>call.column==='user_id' && call.value==='owner-a'));
});

const savedMeal={id:'9fcd5aa2-2eae-40a5-b91c-f039ee520365',name:'Déjeuner',meal:'lunch',updatedAt:'2026-10-15T08:00:00Z',items:[{quantity:100,food:{name:'Riz',source:'manual',unit:'g',kcal100:130,protein100:3,carbs100:28,fat100:.5}}]};
test('saved meals use a separate owner-scoped record with a stable ID and are not workouts',async()=>{
  calls=[];record=undefined;writeError=null;
  await saveSavedMeal('owner-a',savedMeal);
  assert.equal(written.id,savedMeal.id);assert.equal(written.user_id,'owner-a');
  assert.equal(written.name,'__nutrition_meal__');assert.deepEqual(written.exercises[0].nutritionMeal,savedMeal);
  assert.equal(isNutritionRecord({...written,id:savedMeal.id}),true);
  assert.ok(calls.some(call=>call.column==='user_id' && call.value==='owner-a'));
  calls=[];record={id:savedMeal.id};
  await saveSavedMeal('owner-a',{...savedMeal,archived:true});
  assert.ok(calls.some(call=>call.operation==='update'));
  assert.ok(calls.filter(call=>call.column==='user_id' && call.value==='owner-a').length>=2);
  assert.ok(calls.filter(call=>call.column==='name' && call.value==='__nutrition_meal__').length>=2);
  assert.equal(written.exercises[0].nutritionMeal.archived,true);
  writeError={message:'offline'};
  await assert.rejects(saveSavedMeal('owner-a',savedMeal),/saisies sont conservées/);
  writeError=null;
});

test('saved meal loading paginates and retains archived meals for restoration',async()=>{
  calls=[];historyRecords=Array.from({length:501},(_,i)=>({id:savedMeal.id,exercises:[{nutritionMeal:{...savedMeal,archived:i===0}}]}));
  const meals=await loadSavedMeals('owner-a');
  assert.equal(meals.length,501);assert.equal(meals[0].archived,true);
  assert.deepEqual(calls.filter(call=>call.operation==='range').map(call=>[call.start,call.end]),[[0,499],[500,999]]);
  assert.equal(calls.filter(call=>call.column==='user_id' && call.value==='owner-a').length,2);
  assert.equal(calls.filter(call=>call.column==='name' && call.value==='__nutrition_meal__').length,2);
});
