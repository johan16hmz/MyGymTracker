import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const scanSource=ts.transpileModule(readFileSync(new URL('../src/nutritionScan.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}}).outputText;
const scan=await import(`data:text/javascript;base64,${Buffer.from(scanSource).toString('base64')}`);
const componentSource=ts.transpileModule(readFileSync(new URL('../src/components/NutritionScanner.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;

// Isolated component lifecycle harness: no browser, webcam or user data is touched.
function mountScanner(getUserMedia,{secure=true,decode}={}){
  const effects=[];
  const video={srcObject:null};
  const observed={codes:[],errors:[],decodeCalls:0,controlStops:0};
  const controls={stop:()=>{observed.controlStops++;}};
  const hooks={useRef:current=>({current}),useState:value=>[value,()=>{}],useEffect:effect=>effects.push(effect)};
  const jsx=(type,props)=>{if(type==='video')props.ref.current=video;return {type,props};};
  class Reader{
    async decodeFromStream(stream,preview,onResult){
      observed.decodeCalls++;
      preview.srcObject=stream;
      observed.onResult=onResult;
      return decode ? decode(stream,controls,onResult) : controls;
    }
  }
  const modules={
    '@zxing/browser':{BrowserMultiFormatReader:Reader},
    '@zxing/library':{BarcodeFormat:{},DecodeHintType:{}},
    'react':hooks,
    'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    '../i18n':{t:value=>value},
    '../nutritionScan':scan,
  };
  const exports={};
  new Function('require','exports','window','navigator','HTMLMediaElement',componentSource)(name=>{
    if(!(name in modules))throw new Error(`Unexpected import: ${name}`);
    return modules[name];
  },exports,{isSecureContext:secure},{mediaDevices:{getUserMedia}},{HAVE_CURRENT_DATA:2});
  exports.NutritionScanner({onCode:code=>observed.codes.push(code),onError:error=>observed.errors.push(error)});
  assert.equal(effects.length,1);
  const cleanup=effects[0]();
  return {observed,video,cleanup};
}

const flush=()=>new Promise(resolve=>setImmediate(resolve));
function capture(){
  let stops=0;
  const stream={getTracks:()=>[{stop:()=>{stops++;}}]};
  return {stream,get stops(){return stops;}};
}

test('fermer le scanner arrête aussi une autorisation accordée tardivement',async()=>{
  let grant;
  const device=capture();
  const mounted=mountScanner(()=>new Promise(resolve=>{grant=resolve;}));
  mounted.cleanup();
  grant(device.stream);
  await flush();
  assert.equal(device.stops,1);
  assert.equal(mounted.observed.decodeCalls,0);
  assert.equal(mounted.video.srcObject,null);
  assert.deepEqual(mounted.observed.errors,[]);
});

test('fermer la caméra active libère le flux et le lecteur',async()=>{
  const device=capture();
  const mounted=mountScanner(async()=>device.stream);
  await flush();
  assert.equal(mounted.video.srcObject,device.stream);
  mounted.cleanup();
  assert.equal(device.stops,1);
  assert.equal(mounted.observed.controlStops,1);
  assert.equal(mounted.video.srcObject,null);
});

test('un code détecté pendant le démarrage arrête le flux sans double ajout',async()=>{
  const device=capture();
  const mounted=mountScanner(async()=>device.stream,{decode:async(stream,controls,onResult)=>{
    onResult({getText:()=> '3017620422003'});
    onResult({getText:()=> '3017620422003'});
    return controls;
  }});
  await flush();
  assert.deepEqual(mounted.observed.codes,['3017620422003']);
  assert.equal(device.stops,1);
  assert.equal(mounted.observed.controlStops,1);
  assert.equal(mounted.video.srcObject,null);
});

test('une permission refusée ne relance pas la demande et remonte un message utile',async()=>{
  let attempts=0;
  const mounted=mountScanner(async()=>{attempts++;throw new DOMException('Device details','NotAllowedError');});
  await flush();
  assert.equal(attempts,1);
  assert.equal(mounted.observed.errors.length,1);
  assert.match(mounted.observed.errors[0],/^Accès caméra refusé/);
  assert.equal(mounted.observed.decodeCalls,0);
  mounted.cleanup();
});

test('une adresse non sécurisée n’essaie pas d’ouvrir la caméra',async()=>{
  let attempts=0;
  const mounted=mountScanner(async()=>{attempts++;},{secure:false});
  await flush();
  assert.equal(attempts,0);
  assert.match(mounted.observed.errors[0],/HTTPS ou localhost/);
  mounted.cleanup();
});
