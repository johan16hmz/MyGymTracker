import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { test } from 'node:test';
import ts from 'typescript';

globalThis.crypto ??= webcrypto;
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/strength.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { calculateWeight, createStrengthBlock, RPE_TABLE } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('tableau fourni : 8 RPE et 12 colonnes de répétitions', () => {
  assert.equal(RPE_TABLE.length, 8);
  assert.ok(RPE_TABLE.every(row => row.percentages.length === 12));
  assert.equal(RPE_TABLE.find(row => row.rpe === 7).percentages[4], 78.6);
  assert.equal(RPE_TABLE.find(row => row.rpe === 9).percentages[2], 89.2);
});
test('charges calculées depuis le tableau et arrondies au pas de chaque exercice', () => {
  assert.equal(calculateWeight(100, 5, 7, 2.5), 77.5);
  assert.equal(calculateWeight(100, 3, 9, 2.5), 90);
  assert.equal(calculateWeight(120, 5, 7, 2.5), 95);
  assert.equal(calculateWeight(45, 5, 7, 1.25), 35);
  assert.equal(calculateWeight(37.5, 3, 9, 1.25), 33.75);
  assert.equal(calculateWeight(101.25, 1, 10, 2.5), 102.5);
});
test('bloc de 4 semaines : 32 objectifs indépendants, sans fausses performances', () => {
  const targets = { pullup: 45, bench: 100, dips: 37.5, squat: 120 };
  const block = createStrengthBlock(targets);
  const rows = block.exercises.flatMap(ex => ex.prescriptions);
  assert.equal(rows.length, 32);
  assert.equal(new Set(rows.map(row => row.id)).size, 32);
  for (const ex of block.exercises) {
    assert.deepEqual(ex.prescriptions.map(row => row.rpe), [7,7,8,8,8.5,8.5,9,9]);
    assert.deepEqual(ex.prescriptions.map(row => row.reps), [5,3,5,3,5,3,5,3]);
    assert.ok(ex.prescriptions.every(row => row.weight % ex.step === 0 && row.performances.length === 0));
  }
  const next = createStrengthBlock({ ...targets, bench: 110 });
  assert.equal(block.exercises[1].target, 100);
  assert.ok(next.exercises[1].prescriptions[0].weight > block.exercises[1].prescriptions[0].weight);
});
test('refus des objectifs et paramètres invalides', () => {
  for (const target of [0, -1, NaN, Infinity]) assert.throws(() => calculateWeight(target, 5, 7, 2.5));
  assert.throws(() => calculateWeight(100, 13, 7, 2.5));
  assert.throws(() => calculateWeight(100, 5, 4, 2.5));
});
