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

const { estimateCalories, foodTotals, sumEntries } = await load('../src/nutrition.ts');
const { normalizeOpenFoodFacts } = await load('../src/nutritionFood.ts');
const { foodCodeFromScan } = await load('../src/nutritionScan.ts');

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

test('les quantités de nourriture recalculent calories et macros', () => {
  const food = { name: 'Test', unit: 'g', source: 'manual', kcal100: 200, protein100: 10, carbs100: 20, fat100: 5 };
  assert.deepEqual(foodTotals(food, 150), { kcal: 300, protein: 15, carbs: 30, fat: 7.5 });
  assert.deepEqual(sumEntries([{ id: '1', meal: 'lunch', food, quantity: 150, addedAt: '' }, { id: '2', meal: 'snack', food, quantity: 50, addedAt: '' }]), { kcal: 400, protein: 20, carbs: 40, fat: 10 });
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
