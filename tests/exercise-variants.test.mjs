import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const compile=file=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const {exerciseVariants,selectExerciseVariant,addExerciseVariant,groupExerciseVariants,ungroupExerciseVariant,copyExerciseVariant,workoutExerciseBank,removeExerciseVariant}=await import(compile('../src/exerciseVariants.ts'));
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

test('cross-session alternatives copy loads with fresh IDs and never mutate or link the source',()=>{
  const original=base();const source={id:'other-machine',name:'Machine',sets:[{id:'source-set',weight:52.5,reps:0,repsMin:8,repsMax:12}]};
  const before=structuredClone(source);let index=0;
  const result=copyExerciseVariant(original,source,()=>`copied-${++index}`);
  assert.equal(count([result]),count([original]));assert.equal(result.name,original.name);
  const copied=result.alternatives[0];assert.equal(copied.id,'copied-1');assert.equal(copied.sets[0].id,'copied-2');
  assert.equal(copied.sets[0].weight,52.5);assert.equal(copied.sets[0].repsMin,8);assert.equal(copied.sets[0].repsMax,12);
  copied.sets[0].weight=60;assert.deepEqual(source,before);assert.equal(original.alternatives,undefined);
  const selected=selectExerciseVariant(result,copied.id);assert.equal(selected.sets[0].weight,60);
  const back=selectExerciseVariant(selected,original.id);assert.deepEqual(back.sets,original.sets);
});

test('cross-session bank includes ordinary workouts but excludes all internal records and strength blocks',()=>{
  const workout={id:'valid',name:'Upper',date:'2026-10-15',exercises:[base()]};
  const reserved=['__nutrition_profile__','__nutrition_day__','__nutrition_meal__','__training_session__','__strength_tested_max__'];
  const rows=[workout,...reserved.map((name,i)=>({...workout,id:`record-${i}`,name})),{...workout,id:'force',exercises:[{...base(),strengthBlock:{version:1}}]}];
  assert.deepEqual(workoutExerciseBank(rows),[workout]);
});

test('removing an inactive alternative keeps the selected load, count and source intact',()=>{
  const original=base();const exercise=copyExerciseVariant(original,{id:'machine',name:'Machine',sets:[{id:'m',weight:50,reps:10}]});
  const before=structuredClone(exercise);const result=removeExerciseVariant(exercise,exercise.alternatives[0].id);
  assert.deepEqual(exercise,before);assert.equal(exerciseVariants(result).length,1);
  assert.deepEqual(result.sets,original.sets);assert.equal(count([result]),2);
});

test('removing the selected alternative switches to a remaining one without losing its weights',()=>{
  const original=base();const exercise=addExerciseVariant(original,'Machine','machine');
  const result=removeExerciseVariant(exercise,'machine');
  assert.equal(result.name,original.name);assert.deepEqual(result.sets,original.sets);
  assert.equal(result.id,original.id);assert.equal(exerciseVariants(result).length,1);
  assert.equal(removeExerciseVariant(result,result.activeVariantId),result);
  assert.equal(removeExerciseVariant(result,'not-found'),result);
  const grouped=copyExerciseVariant(exercise,{id:'smith',name:'Smith',sets:[{id:'smith-s',weight:40,reps:8}]});
  const resultWithTwo=removeExerciseVariant(grouped,'machine');assert.equal(exerciseVariants(resultWithTwo).length,2);
  assert.equal(resultWithTwo.alternatives[0].sets[0].weight,40);
});
