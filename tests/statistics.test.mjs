import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const nutritionUrl=compile(readFileSync(new URL('../src/nutrition.ts',import.meta.url),'utf8'));
const statisticsUrl=compile(readFileSync(new URL('../src/statistics.ts',import.meta.url),'utf8').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`));
const {buildStatistics,loadPoints,strengthLogs,weightPoints,profileWithWeightHistory,weekStart,validDate}=await import(statisticsUrl);
const fixtureUrl=compile(readFileSync(new URL('./statistics-fixture.ts',import.meta.url),'utf8').replaceAll("from '../src/statistics';",`from ${JSON.stringify(statisticsUrl)};`).replaceAll("from '../src/nutrition';",`from ${JSON.stringify(nutritionUrl)};`));
const {statisticsFixture}=await import(fixtureUrl);
const today='2026-10-09';

test('strength statistics use actual sets, never planned loads or future performances',()=>{
  const source=statisticsFixture(today);const row=source.workouts[0].exercises[0].strengthBlock.exercises[0].prescriptions[0];
  row.weight=999;row.performances.push({weight:777,reps:3,date:'2026-11-09'},{weight:666,reps:0,date:today},{weight:NaN,reps:3,date:today},{weight:666,reps:3,date:'2026-02-30'},{weight:666,reps:3,date:null});
  const logs=strengthLogs(source.workouts,today);
  assert.equal(logs.length,240);assert.equal(Math.max(...logs.filter(log=>log.exerciseId==='bench').map(log=>log.weight)),95);
});
test('daily maxima and reps filters compare like for like across blocks',()=>{
  const logs=strengthLogs(statisticsFixture(today).workouts,today);
  const triples=loadPoints(logs,'bench',3);const fives=loadPoints(logs,'bench',5);
  assert.equal(triples.length,10);assert.equal(triples[0].weight,72.5);assert.equal(triples.at(-1).weight,95);
  assert.equal(fives.at(-1).weight,92.5);
});
test('calendar period is inclusive, weeks begin on Monday, days are not double counted',()=>{
  const source=statisticsFixture(today);const stats=buildStatistics(source,'28',today);
  assert.equal(stats.start,'2026-09-12');assert.equal(weekStart(today),'2026-10-05');
  assert.equal(stats.logs.length,96);assert.equal(stats.weeks.reduce((sum,week)=>sum+week.days,0),stats.trainingDates.length);
  assert.equal(stats.weeks.reduce((sum,week)=>sum+week.sets,0),stats.logs.length);
  assert.ok(stats.trainingDates.every(date=>date>=stats.start && date<=today));
  const count=stats.trainingDates.length;source.workouts.push({...source.workouts.at(-1),id:'duplicate-day'});
  assert.equal(buildStatistics(source,'28',today).trainingDates.length,count);
});
test('weight history has one point per date, diary overrides profile, no fictional legacy points',()=>{
  assert.deepEqual(weightPoints({weightKg:80},[],today),[]);
  const points=weightPoints({weightHistory:[{date:'2026-10-01',weightKg:80}]},[{date:'2026-10-01',weightKg:79},{date:'2026-10-02',weightKg:0},{date:'2026-11-01',weightKg:81},{date:'2026-02-30',weightKg:81}],today);
  assert.deepEqual(points,[{date:'2026-10-01',weightKg:79}]);
});
test('profile updates preserve history and replace same-day measurements',()=>{
  const previous={weightHistory:[{date:'2026-10-01',weightKg:80},{date:today,weightKg:81}]};
  assert.deepEqual(profileWithWeightHistory({weightKg:82},previous,today).weightHistory,[{date:'2026-10-01',weightKg:80},{date:today,weightKg:82}]);
});
test('empty data and zero added weight remain valid without fabricating trends',()=>{
  assert.equal(validDate('2026-02-30'),false);
  const stats=buildStatistics({workouts:[],days:[]},'all',today);
  assert.equal(stats.start,today);assert.equal(stats.latestWeight,undefined);assert.equal(stats.logs.length,0);assert.equal(stats.weeks.length,1);
  const source=statisticsFixture(today);source.workouts[0].exercises[0].strengthBlock.exercises[1].prescriptions[0].performances[0].weight=0;
  assert.ok(strengthLogs(source.workouts,today).some(log=>log.exerciseId==='pullup' && log.weight===0));
});
test('volume is only actual external force load times repetitions, never body weight',()=>{
  const source=statisticsFixture(today);const stats=buildStatistics(source,'84',today);
  assert.equal(stats.volume,51975);assert.equal(stats.latestWeight,80.2);assert.equal(stats.logs.length,240);
  assert.equal(stats.weeks.reduce((sum,week)=>sum+week.volume,0),stats.volume);
  source.workouts[0].exercises[0].strengthBlock.bodyWeight=200;
  assert.equal(buildStatistics(source,'84',today).volume,stats.volume);
});

let queries=[];
globalThis.statsTestClient={from(table){const current={table};queries.push(current);const q={select(){return q;},eq(key,value){current[key]=value;return q;},order(key){current.order=key;return q;},range(start,end){current.range=[start,end];return q;},async abortSignal(){return {data:current.range[0]===0?Array.from({length:500},(_,i)=>({id:String(i),name:'test',date:today,exercises:[]})):[],error:null};}};return q;}};
const service=readFileSync(new URL('../src/statisticsService.ts',import.meta.url),'utf8').replace("import { supabase } from './supabaseClient';",'const supabase=globalThis.statsTestClient;').replaceAll("from './nutrition';",`from ${JSON.stringify(nutritionUrl)};`);
const {loadStatistics}=await import(compile(service));
test('statistics load paginates and applies the owner filter on every page',async()=>{
  queries=[];const loaded=await loadStatistics('owner-a');assert.equal(loaded.workouts.length,500);
  assert.equal(queries.length,2);assert.ok(queries.every(q=>q.user_id==='owner-a' && q.order==='id'));
  assert.deepEqual(queries.map(q=>q.range),[[0,499],[500,999]]);
});
