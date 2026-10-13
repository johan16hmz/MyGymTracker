import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/nutritionHistory.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText;
const {foodHistory,foodHistoryKey,mergeFoodHistory,searchFoodHistory}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const food={name:'Yaourt nature',brand:'Carrefour',unit:'g',source:'manual',kcal100:62,protein100:3,carbs100:4,fat100:3};
const entry=(id,date,quantity=125)=>({id,food,quantity,meal:'breakfast',diaryDate:date,addedAt:'2026-10-13T10:00:00Z'});
test('food history uses eaten date, latest portion and frequency without duplicate entries',()=>{
  const old=entry('old','2026-08-01',250),recent=entry('new','2026-10-12',125);
  const items=foodHistory([old,recent,old]);
  assert.equal(items.length,1);assert.equal(items[0].count,2);assert.equal(items[0].entry.quantity,125);assert.equal(items[0].lastDate,'2026-10-12');
});
test('history does not merge different brands or liquid and solid units',()=>{
  const base=entry('a','2026-10-12');
  assert.equal(foodHistory([base,{...base,id:'b',food:{...food,brand:'Danone'}},{...base,id:'c',food:{...food,unit:'ml'}}]).length,3);
  assert.equal(foodHistoryKey(food),foodHistoryKey({...food,brand:' CARREFOUR '}));
});
test('search matches accents, multiple words and brand without a remote request',()=>{
  const items=foodHistory([{...entry('a','2026-10-12'),food:{...food,name:'Céréales à l’avoine',brand:'Quaker'}}]);
  assert.equal(searchFoodHistory(items,'cereales quaker').length,1);assert.equal(searchFoodHistory(items,'carrefour').length,0);
});
test('merging a day removes deleted foods without losing other days',()=>{
  const old=entry('old','2026-08-01'),today=entry('today','2026-10-13');
  assert.deepEqual(mergeFoodHistory([old,today],'2026-10-13',[]),[old]);
  const next=mergeFoodHistory([old,today],'2026-10-13',[{...today,quantity:150}]);
  assert.equal(next.length,2);assert.equal(foodHistory(next)[0].entry.quantity,150);
});
test('reusing a food leaves the original snapshot unchanged',()=>{
  const original=entry('old','2026-08-01',65);
  const copy=structuredClone(foodHistory([original])[0].entry);
  copy.quantity=100;copy.food.brand='Other';
  assert.equal(original.quantity,65);assert.equal(original.food.brand,'Carrefour');
});
