import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

async function load(source) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(source, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { estimateCalories, goalDateInWeeks, goalDateInMonths, foodTotals, sumEntries, defaultPortions, stepEnergy, macroTargets } = await load('../src/nutrition.ts');
const { normalizeOpenFoodFacts, normalizeFoodSearch, filterFoodCatalog, foodBrandLabel, foodKindLabel, rankFoodSearch, searchBrandedFoods, lookupFood } = await load('../src/nutritionFood.ts');
const { foodCodeFromScan, foodCameraErrorMessage, requestFoodCamera } = await load('../src/nutritionScan.ts');
const { parseHealthImport } = await load('../src/nutritionHealth.ts');
const { foodUpstreamUrl, GET } = await load('../api/food.ts');

test('macro targets are automatic and vary with goal, weight and training',()=>{
  const profile={goal:'maintain',weightKg:80,targetKg:80,age:25,heightCm:180,activity:'active',equationSex:'male'};
  const maintenance=macroTargets(profile,2650);
  assert.deepEqual(maintenance,{protein:128,fat:88,carbs:337,fiber:30,proteinPerKg:1.6,proteinLimited:false});
  assert.equal(macroTargets({...profile,goal:'gain'},2650).protein,144);
  assert.equal(macroTargets({...profile,goal:'lose'},2650).protein,160);
  assert.equal(macroTargets({...profile,weightKg:90},2650).protein,144);
  assert.equal(macroTargets({...profile,activity:'low'},2650).protein,96);
  assert.equal(macroTargets({...profile,goal:'gain',activity:'veryActive'},2650).protein,160);
});
test('age, height and equation affect automatic macros through the calorie estimate',()=>{
  const profile={goal:'maintain',weightKg:80,targetKg:80,age:25,heightCm:180,activity:'active',equationSex:'male'};
  const targets=p=>macroTargets(p,estimateCalories(p).target);
  for(const changes of [{age:65},{heightCm:160},{equationSex:'female'}])assert.notDeepEqual(targets({...profile,...changes}),targets(profile));
});
test('automatic macro energy matches the goal and does not create negative carbs',()=>{
  for(const weightKg of [25,80,200,400])for(const goal of ['lose','maintain','gain'])for(const activity of ['low','moderate','active','veryActive'])for(const calories of [1200,2650,6600]){
    const targets=macroTargets({weightKg,goal,activity},calories);
    assert.ok([targets.protein,targets.carbs,targets.fat,targets.fiber].every(Number.isFinite));
    assert.ok(targets.carbs>=0);
    assert.ok(Math.abs(targets.protein*4+targets.carbs*4+targets.fat*9-calories)<=2);
  }
  assert.equal(macroTargets({weightKg:400,goal:'lose',activity:'active'},1200).proteinLimited,true);
});
test('invalid macro inputs never show NaN and fibres keep their saved reference',()=>{
  const profile={weightKg:80,goal:'maintain',activity:'active',fiberGoal:35};
  assert.equal(macroTargets(profile,2650).fiber,35);
  assert.equal(macroTargets({...profile,fiberGoal:NaN},2650).fiber,30);
  for(const calories of [NaN,Infinity,-10])assert.equal(macroTargets(profile,calories).protein,0);
  assert.equal(macroTargets({...profile,weightKg:NaN},2650).protein,0);
});
test('refined calories separate ordinary activity from net weekly training',()=>{
  const profile={goal:'maintain',weightKg:80,targetKg:80,age:30,heightCm:180,equationSex:'male',activity:'active',dailyActivity:'sedentary',sessionsPerWeek:4,sessionMinutes:60,trainingKind:'strength'};
  const estimate=estimateCalories(profile);
  assert.equal(estimate.bmr,1780);assert.equal(estimate.maintenance,2250);assert.equal(estimate.trainingDaily,114);assert.equal(estimate.refined,true);
  assert.equal(estimateCalories({...profile,sessionsPerWeek:0,sessionMinutes:undefined,trainingKind:undefined}).maintenance,2140);
  assert.ok(estimateCalories({...profile,dailyActivity:'high'}).maintenance>estimate.maintenance);
  assert.ok(estimateCalories({...profile,sessionMinutes:90}).maintenance>estimate.maintenance);
  assert.ok(estimateCalories({...profile,sessionsPerWeek:6}).maintenance>estimate.maintenance);
  assert.ok(estimateCalories({...profile,trainingKind:'strengthHard'}).trainingDaily>estimate.trainingDaily);
  assert.ok(estimateCalories({...profile,equationSex:'female'}).maintenance<estimate.maintenance);
});
test('refined profiles reject missing or implausible activity information',()=>{
  const profile={goal:'maintain',weightKg:80,targetKg:80,age:30,heightCm:180,equationSex:'male',activity:'active',dailyActivity:'sedentary',sessionsPerWeek:4,sessionMinutes:60,trainingKind:'strength'};
  for(const changes of [{dailyActivity:undefined},{dailyActivity:'invalid'},{sessionsPerWeek:15},{sessionsPerWeek:2.5},{sessionMinutes:0},{sessionMinutes:181},{trainingKind:undefined},{trainingKind:'invalid'},{equationSex:undefined}])assert.throws(()=>estimateCalories({...profile,...changes}));
});
test('exact weekly training count drives macros even if a legacy activity category is stale',()=>{
  const profile={goal:'gain',weightKg:80,activity:'low',sessionsPerWeek:6};
  assert.equal(macroTargets(profile,2650).protein,160);
  assert.equal(macroTargets({...profile,sessionsPerWeek:0},2650).protein,128);
});

test('l’estimation suit Mifflin–St Jeor et le sens de l’objectif', () => {
  const base = { goal: 'maintain', targetKg: 80, age: 30, heightCm: 180, weightKg: 80, activity: 'moderate', equationSex: 'male' };
  const maintenance = estimateCalories(base);
  assert.equal(maintenance.bmr, 1780);
  assert.equal(maintenance.maintenance, 2400);
  assert.equal(maintenance.target, 2400);
  assert.ok(estimateCalories({ ...base, goal: 'lose', targetKg: 75 }).target < maintenance.target);
  assert.ok(estimateCalories({ ...base, goal: 'gain', targetKg: 85 }).target > maintenance.target);
  assert.throws(() => estimateCalories({ ...base, age: 17 }));
  assert.throws(() => estimateCalories({ ...base, goal: 'lose', targetKg: 85 }));
  assert.throws(() => estimateCalories({ ...base, goal: 'maintain', targetKg: 85 }));
  assert.throws(() => estimateCalories({ ...base, goal: 'lose', targetKg: 34, weightKg: 35, heightCm: 140, age: 80, equationSex: 'female', activity: 'low' }));
});

test('target date changes the starting adjustment for the same weight gap',()=>{
  const today='2026-10-13';
  const profile={goal:'gain',weightKg:80,targetKg:84,age:25,heightCm:180,activity:'active',equationSex:'male'};
  const short=estimateCalories({...profile,goalDate:goalDateInWeeks(12,today)},today);
  const long=estimateCalories({...profile,goalDate:goalDateInWeeks(52,today)},today);
  assert.ok(short.target>long.target);
  assert.equal(short.maintenance,long.maintenance);
  assert.equal(short.timeline.daysRemaining,84);
  assert.equal(short.timeline.requestedWeeklyKg,4/12);
  assert.equal(long.timeline.limited,false);
  assert.ok(macroTargets(profile,short.target).carbs>macroTargets(profile,long.target).carbs);
  const bigger=estimateCalories({...profile,targetKg:88,goalDate:goalDateInWeeks(52,today)},today);
  assert.ok(bigger.target>long.target);
  const lose=p=>estimateCalories({...profile,goal:'lose',targetKg:76,goalDate:goalDateInWeeks(p,today)},today);
  assert.ok(lose(12).target<lose(52).target);
});

test('ambitious deadlines are flagged and cannot force extreme calorie adjustments',()=>{
  const today='2026-10-13';
  const profile={goal:'gain',weightKg:80,targetKg:100,age:25,heightCm:180,activity:'active',equationSex:'male',goalDate:goalDateInWeeks(1,today)};
  const gain=estimateCalories(profile,today);
  assert.equal(gain.timeline.limited,true);
  assert.ok(gain.adjustment<=Math.min(500,gain.maintenance*.1)+10);
  const lose=estimateCalories({...profile,goal:'lose',targetKg:60},today);
  assert.equal(lose.timeline.limited,true);
  assert.ok(lose.adjustment>=-500);
  assert.ok(lose.adjustment>=-lose.maintenance*.2-10);
  assert.ok(lose.target>=Math.max(1200,lose.bmr)-5);
});

test('absent deadlines keep legacy estimates and expired deadlines return to maintenance without catch-up',()=>{
  const today='2026-10-13';
  const profile={goal:'gain',weightKg:80,targetKg:84,age:25,heightCm:180,activity:'active',equationSex:'male'};
  const legacy=estimateCalories(profile,today);
  assert.equal(legacy.timeline,undefined);
  for(const goalDate of [today,'2026-10-01']){
    const expired=estimateCalories({...profile,goalDate},today);
    assert.equal(expired.target,legacy.maintenance);
    assert.equal(expired.timeline.expired,true);
    assert.equal(expired.timeline.requestedWeeklyKg,0);
  }
  const maintain=estimateCalories({...profile,goal:'maintain',targetKg:80,goalDate:'2026-10-01'},today);
  assert.equal(maintain.timeline,undefined);
  assert.equal(maintain.target,maintain.maintenance);
});

test('calendar deadlines are strict, bounded and DST independent',()=>{
  const profile={goal:'gain',weightKg:80,targetKg:84,age:25,heightCm:180,activity:'active',equationSex:'male'};
  for(const goalDate of ['not-a-date','2026-02-30','2026-1-20','2030-10-13'])assert.throws(()=>estimateCalories({...profile,goalDate},'2026-10-13'));
  for(const weeks of [NaN,Infinity,0,157,1.5])assert.throws(()=>goalDateInWeeks(weeks,'2026-10-13'));
  assert.equal(goalDateInWeeks(1,'2026-10-20'),'2026-10-27');
  assert.equal(goalDateInWeeks(1,'2028-02-25'),'2028-03-03');
  const date=goalDateInWeeks(12,'2026-10-13');
  const saved={...profile,goalDate:date};
  assert.equal(estimateCalories(saved,'2026-10-20').timeline.daysRemaining,77);
  assert.equal(saved.goalDate,date); // weight edits or elapsed days do not restart the deadline
});

test('monthly presets use calendar months and clamp month-end dates',()=>{
  assert.equal(goalDateInMonths(3,'2026-10-13'),'2027-01-13');
  assert.equal(goalDateInMonths(1,'2027-01-31'),'2027-02-28');
  assert.equal(goalDateInMonths(1,'2028-01-31'),'2028-02-29');
  assert.equal(goalDateInMonths(12,'2028-02-29'),'2029-02-28');
  for(const months of [0,37,1.5,NaN,Infinity])assert.throws(()=>goalDateInMonths(months,'2026-10-13'));
  const profile={goal:'gain',weightKg:80,targetKg:84,age:25,heightCm:180,activity:'active',equationSex:'male'};
  for(const months of [1,2,4,6,8,12,36]){
    const estimate=estimateCalories({...profile,goalDate:goalDateInMonths(months,'2026-10-13')},'2026-10-13');
    assert.equal(estimate.timeline.monthsRemaining,months);
    assert.equal(estimate.timeline.requestedMonthlyKg,4/months);
    assert.equal(estimate.timeline.requestedMonthlyPercent,4/months/80*100);
  }
  const end=estimateCalories({...profile,goalDate:'2027-02-28'},'2027-01-31');
  assert.equal(end.timeline.monthsRemaining,1);
  const part=estimateCalories({...profile,goalDate:'2026-10-14'},'2026-10-13');
  assert.ok(part.timeline.monthsRemaining>0 && part.timeline.monthsRemaining<1);
  assert.ok(Number.isFinite(part.timeline.requestedMonthlyKg));
});

test('les quantités de nourriture recalculent calories et macros', () => {
  const food = { name: 'Test', unit: 'g', source: 'manual', kcal100: 200, protein100: 10, carbs100: 20, fat100: 5 };
  assert.deepEqual(foodTotals(food, 150), { kcal: 300, protein: 15, carbs: 30, fat: 7.5, fiber:0 });
  assert.deepEqual(sumEntries([{ id: '1', meal: 'lunch', food, quantity: 150, addedAt: '' }, { id: '2', meal: 'snack', food, quantity: 50, addedAt: '' }]), { kcal: 400, protein: 20, carbs: 40, fat: 10, fiber:0 });
  assert.equal(foodTotals({...food,fiber100:3},150).fiber,4.5);
  assert.equal(food.fiber100,undefined); // legacy data remains unknown, not rewritten to zero
});

test('recherche par nom : accents, mots multiples et noms anglais',()=>{
  const foods=[{name:'Œuf dur',nameEn:'Boiled egg'},{name:'Riz blanc, cuit'},{name:'Riz complet, cru'},{name:'Riz complet, cuit'}];
  assert.equal(filterFoodCatalog(foods,'oeuf')[0].name,'Œuf dur');
  assert.equal(filterFoodCatalog(foods,'egg')[0].name,'Œuf dur');
  assert.equal(filterFoodCatalog(foods,'complet cuit').length,1);
  assert.equal(filterFoodCatalog(foods,'banane').length,0);
  assert.equal(filterFoodCatalog([{name:'Biscuit de riz'}],'riz cuit').length,0);
});
test('les marques sont conservées, recherchables et distinctes des aliments génériques',()=>{
  const food=normalizeOpenFoodFacts({status:1,product:{product_name:'Yaourt nature',brands:' Danone ',nutriments:{'energy-kcal_100g':62}}});
  assert.equal(food.brand,'Danone');
  assert.equal(foodBrandLabel(food),'Danone');
  assert.equal(filterFoodCatalog([food],'danone yaourt').length,1);
  assert.equal(foodBrandLabel({source:'ciqual'}),'Aliment générique · sans marque');
  assert.equal(foodBrandLabel({source:'openfoodfacts'}),'Marque non renseignée');
  assert.equal(foodBrandLabel({source:'manual'}),'Aliment personnel');
  assert.equal(normalizeOpenFoodFacts({status:1,product:{product_name:'Test',brands:'  '}}).brand,undefined);
});
test('la pertinence du nom et de la marque prime sur la complétude nutritionnelle',()=>{
  const foods=[
    {name:'Barres céréales Goût Chocolat au lait - Banane',brand:'Carrefour',source:'openfoodfacts',servingQuantity:25,kcal100:400,protein100:5,carbs100:65,fat100:15,fiber100:3},
    {name:'FRUIT & Cie POMME FRAISE',brand:'Carrefour',source:'openfoodfacts',fiber100:2},
    {name:'Bananes',brand:'Carrefour',source:'openfoodfacts',kcal100:90,protein100:null,carbs100:null,fat100:null},
    {name:'Bananes bio',brand:'Carrefour',source:'openfoodfacts'},
    {name:'Bananes',brand:'Autre marque',source:'openfoodfacts'},
  ];
  const ranked=rankFoodSearch(foods,'banane carrefour');
  assert.equal(ranked[0].name,'Bananes');assert.equal(ranked[0].brand,'Carrefour');
  assert.equal(ranked[1].name,'Bananes bio');
  assert.equal(ranked[2].name,foods[0].name);
  assert.equal(ranked.length,3); // hide unrelated flavors and other brands when exact matches exist
  assert.equal(rankFoodSearch(foods,'bananes carrefour')[0],foods[2]);
  assert.equal(foods[0].name,'Barres céréales Goût Chocolat au lait - Banane'); // does not mutate the cache
});

test('un nectar nommé Banane reste une boisson, avec son vrai nom, ses ml et ses nutriments',()=>{
  const nectar=normalizeOpenFoodFacts({status:1,product:{
    code:'3560070309146',product_name_fr:'Banane',brands:'Carrefour',
    generic_name_fr:'Nectar de banane. Teneur en fruits : 30% minimum.',
    categories_tags:['en:beverages','en:fruit-based-foods','en:banana-nectars'],
    quantity:'1 l',product_quantity_unit:'ml',
    serving_size:'200 ml (Cette bouteille de 1 L contient 5 portions de 200 ml)',
    nutriments:{'energy-kcal_100g':45,proteins_100g:0.2,carbohydrates_100g:11,fat_100g:0.1,fiber_100g:0.5},
  }});
  assert.equal(nectar.name,'Nectar de banane');assert.equal(nectar.kind,'drink');
  assert.equal(foodKindLabel(nectar),'Boisson');assert.equal(nectar.unit,'ml');
  assert.equal(nectar.description,'Nectar de banane. Teneur en fruits : 30% minimum.');
  assert.equal(nectar.servingQuantity,200);assert.equal(nectar.kcal100,45);
  assert.equal(foodTotals(nectar,200).kcal,90); // Never substitute fresh-fruit values.
  const banana=normalizeOpenFoodFacts({status:1,product:{product_name:'Bananes bio',brands:'Carrefour',categories_tags:['en:plant-based-foods-and-beverages','en:fruits','en:bananas'],product_quantity_unit:'g'}});
  assert.equal(banana.kind,'fresh-fruit');assert.equal(foodKindLabel(banana),'Fruit frais');
  const generic={id:'13005',name:'Banane, chair sans peau, crue',source:'ciqual',unit:'g',kcal100:87.6,protein100:1.06,carbs100:19.7,fat100:0.5};
  assert.equal(rankFoodSearch([nectar,generic,banana],'banane')[0],generic);
  assert.equal(rankFoodSearch([nectar,generic,banana],'banane').at(-1),nectar);
  assert.equal(rankFoodSearch([{name:'Banane plantain, crue',source:'ciqual',unit:'g'},nectar,generic,banana],'banane')[0],generic);
  assert.equal(rankFoodSearch([nectar,generic,banana],'banane carrefour')[0],banana);
  assert.equal(rankFoodSearch([nectar,generic,banana],'nectar banane')[0],nectar);
  assert.equal(normalizeOpenFoodFacts({status:1,product:{product_name:'Banane',categories_tags:['en:beverages']}}).name,'Banane — boisson');
});

test('les ml et le classement restent sûrs quand le nom ou la catégorie est incomplet',()=>{
  assert.equal(defaultPortions({name:'Banane',unit:'ml'})[0].quantity,250);
  assert.ok(!defaultPortions({name:'Banane',unit:'ml'}).some(portion=>/banane/.test(portion.label)));
  assert.ok(!defaultPortions({name:'Banane',unit:'g',kind:'drink'}).some(portion=>/banane/.test(portion.label)));
  assert.equal(defaultPortions({name:'Bananes bio',unit:'g'})[0].quantity,120);
  const oil=normalizeOpenFoodFacts({status:1,product:{product_name:'Huile d’olive',quantity:'75 cl',categories_tags:['en:plant-based-foods-and-beverages']}});
  assert.equal(oil.unit,'ml');assert.equal(oil.kind,undefined);assert.equal(foodKindLabel(oil),'Produit liquide');
  assert.equal(normalizeOpenFoodFacts({status:1,product:{product_name:'Gâteau au jus d’orange'}}).kind,undefined);
  assert.equal(normalizeOpenFoodFacts({status:1,product:{product_name:'Banane séchée',categories_tags:['en:fruits','en:dried-fruits']}}).kind,undefined);
  const solid={name:'Banane, chair crue',source:'ciqual',unit:'g'};
  assert.equal(rankFoodSearch([{name:'Banane',unit:'ml'},solid],'banane')[0],solid);
});
test('portions indicatives, portions étiquette et valeurs manquantes',()=>{
  assert.equal(defaultPortions({name:'Banane, chair crue',unit:'g'})[0].quantity,120);
  assert.equal(defaultPortions({name:'Banane sèche',unit:'g'})[0].quantity,100);
  assert.equal(defaultPortions({name:'Nectar de banane',unit:'g'})[0].quantity,100);
  assert.equal(defaultPortions({name:'Produit',unit:'g',servingQuantity:30,servingLabel:'1 barre'})[0].label,'1 barre');
  assert.equal(defaultPortions({name:'Boisson',unit:'ml'})[0].quantity,250);
  const found=normalizeOpenFoodFacts({status:1,product:{product_name:'Test',serving_size:'1 pot (125 g)',nutriments:{'energy-kcal_100g':100,proteins_100g:3,carbohydrates_100g:15,fat_100g:2,fiber_100g:0}}});
  assert.equal(found.servingQuantity,125);assert.equal(found.fiber100,0);
  assert.equal(normalizeFoodSearch({products:[{product_name:'Incomplet'}, {product_name:'Test',nutriments:{'energy-kcal_100g':100}}]}).length,2);
});
test('pas : bonus optionnel, net, au-delà du seuil et plafonné',()=>{
  const profile={heightCm:180,weightKg:80,baselineSteps:5000};
  assert.equal(stepEnergy(profile,10000).bonus,0);
  assert.equal(stepEnergy({...profile,adjustForSteps:true},5000).bonus,0);
  assert.equal(stepEnergy({...profile,adjustForSteps:true},10000).bonus,174);
  assert.equal(stepEnergy({...profile,adjustForSteps:true},100000).bonus,600);
  assert.equal(stepEnergy(profile,-10).distanceKm,0);
  assert.equal(stepEnergy(profile,NaN).bonus,0);
});
test('import Santé : date réelle, entier et taille limités',()=>{
  assert.deepEqual(parseHealthImport('{"date":"2026-10-07","steps":4170}'),{date:'2026-10-07',steps:4170});
  for(const input of ['{}','{"date":"2026-02-30","steps":10}','{"date":"2026-99-99","steps":10}','{"date":"2026-10-07","steps":-1}','{"date":"2026-10-07","steps":1.5}','{"date":"2026-10-07","steps":"123"}','{"date":"2026-10-07","steps":100001}', 'x'.repeat(501)]) assert.throws(()=>parseHealthImport(input));
});
test('proxy alimentaire : hôte fixe, taille, contrôle et ambiguïtés',async()=>{
  const searchUrl=new URL(foodUpstreamUrl(new URLSearchParams({query:'banane carrefour'})));
  assert.equal(searchUrl.hostname,'search.openfoodfacts.org');
  assert.equal(searchUrl.searchParams.get('q'),'banane carrefour');
  assert.ok(searchUrl.searchParams.get('fields').includes('generic_name_fr'));
  assert.ok(searchUrl.searchParams.get('fields').includes('categories_tags'));
  assert.equal(new URL(foodUpstreamUrl(new URLSearchParams({query:'brand:(A*) OR http://evil.test'}))).searchParams.get('q'),'brand a or http evil test');
  assert.ok(foodUpstreamUrl(new URLSearchParams({barcode:'3017620422003'})).includes('/api/v2/product/'));
  for(const params of [{query:'a'},{query:'x'.repeat(81)},{query:'bad\nquery'},{barcode:'abc'},{barcode:'3017620422003',query:'banane'},{}])assert.equal(foodUpstreamUrl(new URLSearchParams(params)),null);
  assert.equal((await GET(new Request('https://site.test/api/food?barcode=bad'))).status,400);
});
test('recherche dédiée : les noms/marques restent disponibles sans inventer de macros',async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];
  try{
    globalThis.fetch=async(url)=>{
      calls.push(String(url));
      return String(url).startsWith('https://search.openfoodfacts.org/')
        ? Response.json({hits:[{code:'6022850486371',product_name_fr:'Banane Carrefour Bio',brands:['Carrefour']}]})
        : Response.json({status:1,product:{code:'6022850486371',product_name_fr:'Banane Carrefour Bio',brands:'Carrefour'}});
    };
    const request=new Request('https://site.test/api/food?query=brand-search-fixture');
    const response=await GET(request);
    const json=await response.json();
    assert.equal(response.status,200);
    const food=normalizeFoodSearch(json)[0];
    assert.equal(food.brand,'Carrefour');assert.equal(food.name,'Banane Carrefour Bio');
    assert.equal(food.kcal100,null);
    assert.equal(calls.length,2);
    await GET(request);
    assert.equal(calls.length,2); // shared cache prevents duplicate upstream requests
    assert.ok(calls.every(url=>['search.openfoodfacts.org','world.openfoodfacts.org'].includes(new URL(url).hostname)));
  }finally{globalThis.fetch=originalFetch;}
});
test('recherche alimentaire : les erreurs HTML restent lisibles et ne sont pas mises en cache',async()=>{
  const originalFetch=globalThis.fetch;
  try{
    globalThis.fetch=async()=>new Response('<html>upstream private details</html>',{status:200});
    const response=await GET(new Request('https://site.test/api/food?query=banane'));
    assert.equal(response.status,502);
    assert.ok(!(await response.text()).includes('upstream private details'));
    await assert.rejects(searchBrandedFoods('unavailable-test'),/Recherche indisponible/);
    await assert.rejects(lookupFood('3017620422003'),/Recherche indisponible/);
    globalThis.fetch=async()=>Response.json({products:[]});
    assert.deepEqual(await searchBrandedFoods('unavailable-test'),[]);
  }finally{globalThis.fetch=originalFetch;}
});
test('catalogue CIQUAL : source, nombre et nutriments de la banane',()=>{
  const data=JSON.parse(readFileSync(new URL('../public/data/ciqual-2025.json',import.meta.url),'utf8'));
  assert.equal(data.foods.length,3484);
  const banana=data.foods.find(row=>row[0]==='13005');
  assert.equal(banana[3],87.6);assert.equal(banana[7],2.7);
  assert.ok(data.foods.some(row=>row[3]===null));
});

test('Open Food Facts signale les macros manquantes au lieu de les inventer', () => {
  const food = normalizeOpenFoodFacts({ status: 1, product: { code: '3017620422003', product_name: 'Produit test', nutriments: { 'energy-kcal_100g': 250, proteins_100g: 9, carbohydrates_100g: 30 } } });
  assert.equal(food.kcal100, 250);
  assert.equal(food.protein100, 9);
  assert.equal(food.fat100, null);
  assert.equal(normalizeOpenFoodFacts({ status: 0 }), null);
});

test('le scanner extrait un code produit des EAN, URL Open Food Facts et liens GS1', () => {
  assert.equal(foodCodeFromScan(' 3017620422003 '), '3017620422003');
  assert.equal(foodCodeFromScan('https://fr.openfoodfacts.org/produit/3017620422003/test'), '3017620422003');
  assert.equal(foodCodeFromScan('https://id.example.com/01/03017620422003/10/L123'), '03017620422003');
  assert.equal(foodCodeFromScan('(01)03017620422003(10)L123'), '03017620422003');
  assert.equal(foodCodeFromScan('https://example.com/food?gtin=3017620422003'), '3017620422003');
  assert.equal(foodCodeFromScan('https://example.com/promo/1234567890123'), null);
  assert.equal(foodCodeFromScan('https://example.com/promo'), null);
});

test('caméra : arrière de préférence, sans micro, repli uniquement si contraintes incompatibles',async()=>{
  const calls=[];
  const stream={getTracks:()=>[]};
  const devices={getUserMedia:async(constraints)=>{calls.push(constraints);if(calls.length===1)throw {name:'OverconstrainedError'};return stream;}};
  assert.equal(await requestFoodCamera(devices),stream);
  assert.equal(calls.length,2);
  assert.equal(calls[0].audio,false);
  assert.deepEqual(calls[0].video.facingMode,{ideal:'environment'});
  assert.deepEqual(calls[1],{audio:false,video:true});
  for(const name of ['NotAllowedError','NotFoundError','NotReadableError','SecurityError']){
    let attempts=0;
    await assert.rejects(requestFoodCamera({getUserMedia:async()=>{attempts++;throw new DOMException('Private device details',name);}}));
    assert.equal(attempts,1);
  }
});
test('caméra : erreurs compréhensibles, sans exposer les détails du matériel',()=>{
  assert.match(foodCameraErrorMessage({name:'NotAllowedError'}),/Accès caméra refusé/);
  assert.match(foodCameraErrorMessage({name:'NotFoundError'}),/Aucune caméra/);
  assert.match(foodCameraErrorMessage({name:'NotReadableError'}),/occupée/);
  assert.match(foodCameraErrorMessage(new Error('Private device details')),/^Caméra indisponible/);
  assert.ok(!foodCameraErrorMessage(new Error('Private device details')).includes('Private device details'));
});
