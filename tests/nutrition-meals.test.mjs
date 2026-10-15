import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const compile=source=>`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText).toString('base64')}`;
const {createSavedMeal,savedMealEntries,appendMealEntries,validateSavedMeal}=await import(compile(readFileSync(new URL('../src/nutritionMeals.ts',import.meta.url),'utf8')));
const food={name:'Yaourt',brand:'Carrefour',source:'manual',unit:'g',kcal100:62,protein100:4,carbs100:5,fat100:3};
test('saved meals snapshot foods, brands, quantities and unknown fibre without modifying history',()=>{
  const original=[{food:structuredClone(food),quantity:125}];
  const saved=createSavedMeal('  Mon déjeuner  ','lunch',original);
  assert.equal(saved.name,'Mon déjeuner');assert.equal(saved.items[0].food.brand,'Carrefour');
  assert.equal(saved.items[0].food.fiber100,undefined);
  original[0].quantity=200;original[0].food.name='Autre aliment';
  assert.equal(saved.items[0].quantity,125);assert.equal(saved.items[0].food.name,'Yaourt');
  const first=savedMealEntries(saved,'dinner'),second=savedMealEntries(saved,'breakfast');
  assert.notEqual(first[0].id,second[0].id);assert.equal(first[0].meal,'dinner');
  first[0].food.name='Modifié';first[0].quantity=999;
  assert.equal(saved.items[0].quantity,125);assert.equal(saved.items[0].food.name,'Yaourt');
});
test('adding a whole meal is idempotent on retry and preserves unrelated daily data',()=>{
  const saved=createSavedMeal('Déjeuner','lunch',[{food,quantity:125},{food:{...food,name:'Deuxième'},quantity:200}]);
  const entries=savedMealEntries(saved,'lunch');
  const day={date:'2026-10-15',entries:[{...entries[0],id:'original',meal:'breakfast'}],waterMl:750,steps:{count:4000},weightKg:80};
  const next=appendMealEntries(day,entries);
  assert.equal(next.entries.length,3);assert.equal(day.entries.length,1);
  assert.deepEqual(appendMealEntries(next,entries),next);
  assert.equal(next.waterMl,750);assert.deepEqual(next.steps,{count:4000});assert.equal(next.weightKg,80);
});
test('invalid templates and archived templates cannot generate diary entries',()=>{
  const saved=createSavedMeal('Déjeuner','lunch',[{food,quantity:125}]);
  for(const changes of [{name:''},{name:'a'.repeat(101)},{id:'not-an-id'},{meal:'invalid'},{items:[]},{items:[{food,quantity:NaN}]},{items:[{food:{...food,kcal100:Infinity},quantity:125}]},{items:[{food:{...food,fiber100:-1},quantity:125}]}])assert.throws(()=>validateSavedMeal({...saved,...changes}));
  assert.throws(()=>savedMealEntries({...saved,archived:true},'lunch'));
  assert.throws(()=>savedMealEntries(saved,'invalid'));
});
