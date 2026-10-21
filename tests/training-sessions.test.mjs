import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const nutritionUrl=compile(readFileSync(new URL('../src/nutrition.ts',import.meta.url),'utf8'));
const trainingUrl=compile(readFileSync(new URL('../src/trainingSessions.ts',import.meta.url),'utf8').replaceAll(/from '\.\/nutrition(?:\.js)?';/g,`from ${JSON.stringify(nutritionUrl)};`));
const testedUrl=compile(readFileSync(new URL('../src/testedMaxes.ts',import.meta.url),'utf8').replaceAll(/from '\.\/nutrition(?:\.js)?';/g,`from ${JSON.stringify(nutritionUrl)};`).replaceAll(/from '\.\/trainingSessions(?:\.js)?';/g,`from ${JSON.stringify(trainingUrl)};`));
const statsUrl=compile(readFileSync(new URL('../src/statistics.ts',import.meta.url),'utf8').replaceAll(/from '\.\/nutrition(?:\.js)?';/g,`from ${JSON.stringify(nutritionUrl)};`).replaceAll(/from '\.\/trainingSessions(?:\.js)?';/g,`from ${JSON.stringify(trainingUrl)};`).replaceAll(/from '\.\/testedMaxes(?:\.js)?';/g,`from ${JSON.stringify(testedUrl)};`));
const {trainingSessionRecord,trainingSessions,validateTrainingSession,snapshotWorkout}=await import(trainingUrl);
const {buildStatistics,estimatedOneRM,estimatedMaxPoints}=await import(statsUrl);
const today='2026-10-13';
const model={id:'template',name:'Haut du corps',date:'2026-10-01',exercises:[{id:'bench',name:'Bench',sets:[{id:'s',weight:999,reps:10}]}]};
const event=(id,date,source='workout',extra={})=>({version:1,id,date,source,sourceId:model.id,name:model.name,recordedAt:'2026-10-13T12:00:00Z',note:'',exercises:[],...extra});
const force=(id,date,extra={})=>event(id,date,'strength',{sourceId:'force-block',exercises:[{id:'bench',name:'Bench',weighted:false,sets:[{weight:80,reps:5},{weight:85,reps:3}]}],...extra});

test('workout history snapshots preserve active alternatives and rep ranges without creating Force performances',()=>{
  const template=structuredClone(model);template.exercises[0].name='Machine';template.exercises[0].sets[0]={id:'range',weight:45,reps:8,repsMin:8,repsMax:12};
  template.exercises[0].alternatives=[{id:'inactive',name:'Haltères',sets:[{id:'inactive-set',weight:20,reps:10}]}];
  const session=event('snapshot',today,'workout',{workoutSnapshot:snapshotWorkout(template)});
  const record=trainingSessionRecord(session);template.exercises[0].sets[0].weight=999;session.workoutSnapshot[0].name='Changed';
  const stats=buildStatistics({workouts:[record],days:[]},'all',today);
  assert.equal(stats.sessions[0].workoutSnapshot[0].name,'Machine');assert.equal(stats.sessions[0].workoutSnapshot[0].sets[0].weight,45);
  assert.equal(stats.sessions[0].workoutSnapshot[0].sets[0].repsMax,12);assert.equal(stats.sessions[0].workoutSnapshot.length,1);
  assert.equal(stats.logs.length,0);assert.equal(stats.volume,0);assert.equal(stats.trainingDates.length,1);
});
test('legacy completions remain readable without invented snapshots; malformed snapshots are rejected',()=>{
  assert.equal(trainingSessions([trainingSessionRecord(event('legacy',today))],today)[0].workoutSnapshot,undefined);
  assert.throws(()=>validateTrainingSession(event('bad',today,'workout',{workoutSnapshot:[{id:'e',name:'Bad',sets:[{weight:NaN,reps:8}]}]}),today));
});

test('reusable model creation never counts as a completed workout or strength load',()=>{
  const stats=buildStatistics({workouts:[model],days:[]},'all',today);
  assert.equal(stats.trainingDates.length,0);assert.equal(stats.logs.length,0);assert.equal(stats.volume,0);
});
test('reusing the same model creates distinct dated completions without duplicating the model',()=>{
  const records=[model,trainingSessionRecord(event('one','2026-10-10')),trainingSessionRecord(event('two','2026-10-12'))];
  const stats=buildStatistics({workouts:records,days:[]},'28',today);
  assert.deepEqual(stats.trainingDates,['2026-10-10','2026-10-12']);assert.equal(stats.sessions.length,2);assert.equal(stats.logs.length,0);
  assert.equal(model.date,'2026-10-01');assert.equal(model.exercises[0].sets[0].weight,999);
});
test('actual Force snapshots survive subsequent plan changes or removal and days are deduplicated',()=>{
  const original=force('force-1','2026-10-10');const record=trainingSessionRecord(original);
  original.exercises[0].sets[0].weight=999;
  const stats=buildStatistics({workouts:[record,trainingSessionRecord(event('same-day','2026-10-10'))],days:[]},'all',today);
  assert.equal(stats.logs[0].weight,80);assert.equal(stats.volume,655);assert.equal(stats.trainingDates.length,1);
});
test('validation rejects future dates, impossible dates, empty Force and invalid actual sets',()=>{
  for(const bad of [event('future','2026-10-14'),event('bad-date','2026-02-30'),event('empty',today,'strength'),force('bad-rep',today,{exercises:[{id:'bench',name:'Bench',weighted:false,sets:[{weight:80,reps:3.5}]}]}),force('bad-rpe',today,{exercises:[{id:'bench',name:'Bench',weighted:false,sets:[{weight:80,reps:3,rpe:8.3}]}]})])assert.throws(()=>validateTrainingSession(bad,today));
  assert.doesNotThrow(()=>validateTrainingSession(force('good',today),today));
});
test('1RM estimate uses actual 1-10 rep sets, singles retain load, daily best is independent of rep filter',()=>{
  const stats=buildStatistics({workouts:[model,trainingSessionRecord(force('f',today))],days:[]},'all',today);
  const points=estimatedMaxPoints(stats.logs,'bench');assert.equal(points.length,1);assert.ok(Math.abs(points[0].oneRM-93.5)<1e-10);
  assert.equal(estimatedOneRM({...stats.logs[0],reps:1}),80);assert.equal(estimatedOneRM({...stats.logs[0],reps:11}),undefined);
  assert.equal(estimatedOneRM({...stats.logs[0],reps:0}),undefined);
});
test('weighted 1RM uses body weight recorded for that day, not present-day profile or plan',()=>{
  const weighted=force('w',today,{exercises:[{id:'pullup',name:'Tractions',weighted:true,sets:[{weight:20,reps:5}]}]});
  const record=trainingSessionRecord(weighted);
  let stats=buildStatistics({workouts:[record],profile:{weightKg:100},days:[]},'all',today);
  assert.equal(estimatedMaxPoints(stats.logs,'pullup').length,0);
  stats=buildStatistics({workouts:[record],days:[{date:today,entries:[],weightKg:80}]},'all',today);
  assert.ok(Math.abs(estimatedOneRM(stats.logs[0])-36.66666666666667)<1e-10);
  const snapshot=trainingSessionRecord({...weighted,bodyWeightKg:75});
  stats=buildStatistics({workouts:[snapshot],days:[{date:today,entries:[],weightKg:80}]},'all',today);
  assert.equal(stats.logs[0].bodyWeightKg,75);
});
test('duplicate delivery of an event counts once, malformed or future records are excluded',()=>{
  const record=trainingSessionRecord(event('a',today));
  assert.equal(trainingSessions([record,record],today).length,1);
  const future=structuredClone(record);future.exercises[0].trainingSession.date='2026-10-14';
  assert.equal(trainingSessions([future],today).length,0);
});

let calls=[];let payload;
globalThis.trainingTestClient={from(table){calls.push(['from',table]);const query={upsert(value,options){payload=value;calls.push(['upsert',options]);return query;},select(){return query;},eq(key,value){calls.push(['eq',key,value]);return query;},delete(){calls.push(['delete']);return query;},abortSignal(){return query;},async single(){return {data:payload,error:null};},then(resolve){return Promise.resolve({error:null}).then(resolve);}};return query;}};
const service=readFileSync(new URL('../src/trainingSessionService.ts',import.meta.url),'utf8').replace("import { supabase } from './supabaseClient';",'const supabase=globalThis.trainingTestClient;').replaceAll(/from '\.\/trainingSessions(?:\.js)?';/g,`from ${JSON.stringify(trainingUrl)};`);
const {saveTrainingSession,removeTrainingSession}=await import(compile(service));
test('session saves retry with the same event ID and deletes are limited to owner and history records',async()=>{
  calls=[];const session=event('stable-id',today);
  await saveTrainingSession('owner-a',session);await saveTrainingSession('owner-a',session);
  assert.equal(payload.id,'stable-id');assert.equal(payload.user_id,'owner-a');assert.equal(payload.name,'__training_session__');
  assert.equal(calls.filter(call=>call[0]==='upsert' && call[1].onConflict==='id').length,2);
  calls=[];await removeTrainingSession('owner-a','stable-id');
  for(const expected of [['eq','id','stable-id'],['eq','user_id','owner-a'],['eq','name','__training_session__']])assert.ok(calls.some(call=>JSON.stringify(call)===JSON.stringify(expected)));
});
