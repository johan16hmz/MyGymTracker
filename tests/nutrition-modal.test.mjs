import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/nutritionScrollLock.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText;
const {lockNutritionScroll}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
function style(){const values=new Map();return {getPropertyValue:key=>values.get(key)?.[0] ?? '',getPropertyPriority:key=>values.get(key)?.[1] ?? '',setProperty:(key,value,priority='')=>values.set(key,[value,priority]),removeProperty:key=>values.delete(key)};}
test('modal scroll lock pins body and root, keeps nested locks and restores exact page position and styles',()=>{
  const original={window:globalThis.window,document:globalThis.document,getComputedStyle:globalThis.getComputedStyle};
  const body={style:style()},root={style:style(),clientWidth:1200};
  body.style.setProperty('position','relative');body.style.setProperty('padding-right','8px');
  root.style.setProperty('overflow','auto','important');
  let restored;
  globalThis.document={body,documentElement:root};
  globalThis.window={scrollX:0,scrollY:930,innerWidth:1220,scrollTo:options=>{restored=options;}};
  globalThis.getComputedStyle=()=>({paddingRight:'8px'});
  try{
    const release=lockNutritionScroll();
    assert.equal(body.style.getPropertyValue('position'),'fixed');assert.equal(body.style.getPropertyValue('top'),'-930px');
    assert.equal(root.style.getPropertyValue('overflow'),'hidden');assert.equal(root.style.getPropertyValue('overscroll-behavior'),'none');
    assert.equal(body.style.getPropertyValue('padding-right'),'28px');
    const releaseNested=lockNutritionScroll();release();release();
    assert.equal(body.style.getPropertyValue('position'),'fixed');assert.equal(restored,undefined);
    body.style.setProperty('background','red');
    releaseNested();
    assert.equal(body.style.getPropertyValue('position'),'relative');assert.equal(body.style.getPropertyValue('top'),'');
    assert.equal(body.style.getPropertyValue('padding-right'),'8px');assert.equal(body.style.getPropertyValue('background'),'red');
    assert.equal(root.style.getPropertyValue('overflow'),'auto');assert.equal(root.style.getPropertyPriority('overflow'),'important');
    assert.deepEqual(restored,{left:0,top:930,behavior:'instant'});
  }finally{Object.assign(globalThis,original);}
});
