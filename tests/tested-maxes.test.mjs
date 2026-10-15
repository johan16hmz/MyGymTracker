import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const source=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const nutritionUrl=compile(source('../src/nutrition.ts'));
const trainingUrl=compile(source('../src/trainingSessions.ts').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`));
const testedUrl=compile(source('../src/testedMaxes.ts').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`).replaceAll("from './trainingSessions';",`from ${JSON.stringify(trainingUrl)};`));
const statsUrl=compile(source('../src/statistics.ts').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`).replaceAll("from './trainingSessions';",`from ${JSON.stringify(trainingUrl)};`).replaceAll("from './testedMaxes';",`from ${JSON.stringify(testedUrl)};`));
const {validateTestedMax,testedMaxRecord,testedMaxes,testedMaxPoints}=await import(testedUrl);
const {buildStatistics}=await import(statsUrl);
const today='2026-10-15';
const value=(extra={})=>({version:1,id:'max',exerciseId:'bench',exercise:'Bench',weighted:false,weight:110,date:today,recordedAt:'2026-10-15T12:00:00Z',note:'Fin de bloc',...extra});

test('tested maximum validates date, real load and added-weight zero',()=>{
  assert.doesNotThrow(()=>validateTestedMax(value(),today));
  for(const extra of [{weight:NaN},{weight:-1},{weight:0},{weight:2001},{date:'2026-02-30'},{date:'2026-10-16'},{weighted:'yes'},{note:'x'.repeat(501)},{exercise:''}]) assert.throws(()=>validateTestedMax(value(extra),today));
  assert.doesNotThrow(()=>validateTestedMax(value({weighted:true,weight:0}),today));
});
test('tested records deduplicate IDs, ignore invalid rows and retain daily maximum only in chart',()=>{
  const records=[testedMaxRecord(value(),today),testedMaxRecord(value({id:'second',weight:105}),today)];
  const all=testedMaxes([...records,records[0],{...records[0],id:'mismatch'}],today);
  assert.equal(all.length,2);assert.equal(testedMaxPoints(all,'bench').length,1);assert.equal(testedMaxPoints(all,'bench')[0].weight,110);
});
test('tested maximum improves best lifts without creating planned or working sets',()=>{
  const workout={id:'block',name:'Bloc',date:today,exercises:[{id:'b',name:'Force',sets:[],strengthBlock:{exercises:[{id:'bench',name:'Bench',weighted:false,prescriptions:[{weight:500,performances:[{weight:90,reps:5,rpe:9,date:today,note:''}]}]}]}}]};
  const stats=buildStatistics({workouts:[workout,testedMaxRecord(value(),today)],days:[]},'28',today);
  assert.equal(stats.logs.length,1);assert.equal(stats.volume,450);assert.equal(stats.trainingDates.length,1);
  assert.equal(stats.records[0].best.weight,110);assert.equal(stats.records[0].best.tested,true);assert.equal(stats.records[0].testedBest.weight,110);
  assert.equal(stats.weeks.reduce((n,w)=>n+w.sets,0),1);
  const old=testedMaxRecord(value({id:'old',date:'2025-01-01',weight:120}),today);
  assert.equal(buildStatistics({workouts:[old],days:[]},'28',today).maxTests.length,0);
  assert.equal(buildStatistics({workouts:[old],days:[]},'all',today).start,'2025-01-01');
});

let calls=[],written,error=null;
globalThis.testedClient={from(table){calls.push(['from',table]);const q={upsert(payload,options){written=payload;calls.push(['upsert',options]);return q;},select(){return q;},delete(){calls.push(['delete']);return q;},eq(k,v){calls.push(['eq',k,v]);return q;},abortSignal(){return q;},single(){return Promise.resolve({data:error?null:written,error});},then(resolve,reject){return Promise.resolve({error}).then(resolve,reject);}};return q;}};
const service=compile(source('../src/testedMaxService.ts').replace("import { supabase } from './supabaseClient';",'const supabase=globalThis.testedClient;').replaceAll("from './testedMaxes';",`from ${JSON.stringify(testedUrl)};`));
const {saveTestedMax,removeTestedMax}=await import(service);
test('tested max saves are owner-scoped, retry-stable and deletions marker-scoped',async()=>{
  calls=[];error=new Error('offline');await assert.rejects(saveTestedMax('owner-a',value()));
  const id=written.id;error=null;await saveTestedMax('owner-a',value());assert.equal(written.id,id);assert.equal(written.user_id,'owner-a');
  assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner-a'));
  calls=[];await removeTestedMax('owner-a',id);
  for(const expected of [['eq','user_id','owner-a'],['eq','id',id],['eq','name','__strength_tested_max__']])assert.ok(calls.some(c=>JSON.stringify(c)===JSON.stringify(expected)));
  error=new Error('denied');await assert.rejects(removeTestedMax('owner-a',id));error=null;
});
