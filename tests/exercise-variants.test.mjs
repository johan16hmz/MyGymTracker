import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile=file=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const {exerciseVariants,selectExerciseVariant,addExerciseVariant,groupExerciseVariants,ungroupExerciseVariant}=await import(compile('../src/exerciseVariants.ts'));
const {applyDraftReps}=await import(compile('../src/workoutDrafts.ts'));
const base=()=>({id:'press',name:'Militaire haltères',sets:[{id:'s1',weight:22.5,reps:0,repsMin:8,repsMax:10},{id:'s2',weight:20,reps:12}],workoutUpdatedAt:'2026-10-01T12:00:00Z'});
const count=exercises=>exercises.reduce((sum,ex)=>sum+ex.sets.length,0);

test('adding and switching alternatives preserves each load without duplicating sets',()=>{
  const original=base();let exercise=addExerciseVariant(original,'Machine','machine');
  assert.equal(exercise.name,'Machine');assert.equal(count([exercise]),2);
  assert.deepEqual(exercise.sets.map(s=>s.weight),[0,0]);assert.notEqual(exercise.sets[0].id,'s1');
  exercise={...exercise,sets:exercise.sets.map(s=>({...s,weight:45}))};
  exercise=selectExerciseVariant(exercise,'press');assert.deepEqual(exercise.sets,original.sets);
  exercise=JSON.parse(JSON.stringify(exercise));exercise=selectExerciseVariant(exercise,'machine');
  assert.deepEqual(exercise.sets.map(s=>s.weight),[45,45]);assert.equal(count([exercise]),2);
  assert.equal(exercise.workoutUpdatedAt,original.workoutUpdatedAt);assert.equal(original.alternatives,undefined);
});

test('existing exercise groups merge and split losslessly, only active sets count',()=>{
  const target=base();const source={id:'machine',name:'Machine',sets:[{id:'m1',weight:55,reps:10}],alternatives:[{id:'smith',name:'Smith',sets:[{id:'smith1',weight:35,reps:8}]}]};
  const grouped=groupExerciseVariants([target,source],'press','machine');assert.equal(grouped.length,1);assert.equal(count(grouped),2);
  assert.equal(exerciseVariants(grouped[0]).length,3);
  const switched=selectExerciseVariant(grouped[0],'machine');assert.equal(count([switched]),1);assert.equal(switched.sets[0].weight,55);
  const split=ungroupExerciseVariant(grouped,'press','smith','separate');assert.equal(split.length,2);assert.equal(count(split),3);
  assert.deepEqual(split[1].sets,source.alternatives[0].sets);assert.equal(exerciseVariants(split[0]).length,2);
  assert.deepEqual(groupExerciseVariants(grouped,'press','press'),grouped);
});

test('pending rep ranges are applied even after their variant becomes inactive',()=>{
  const exercise=addExerciseVariant(base(),'Machine','machine');
  const result=applyDraftReps({id:'w',name:'Upper',date:'2026-10-15',exercises:[exercise]},{s1:'6-8',[exercise.sets[0].id]:'15'});
  assert.equal(result.exercises[0].sets[0].reps,15);
  assert.equal(result.exercises[0].alternatives[0].sets[0].repsMin,6);
  assert.equal(result.exercises[0].alternatives[0].sets[0].repsMax,8);
});
