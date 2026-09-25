import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { test } from 'node:test';
import ts from 'typescript';

globalThis.crypto ??= webcrypto;
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/strength.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { calculateWeight, createStrengthBlock, updateStrengthLoads, getStrengthWeeks, RPE_TABLE } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

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
  assert.equal(calculateWeight(45, 5, 7, 1.25, 80), 18.75);
  assert.equal(calculateWeight(10, 5, 7, 1.25, 80), 0);
});
test('bloc de 4 semaines : 32 objectifs indépendants, sans fausses performances', () => {
  const targets = { pullup: 45, bench: 100, dips: 37.5, squat: 120 };
  const block = createStrengthBlock(targets, 80);
  assert.equal(block.bodyWeight, 80);
  const rows = block.exercises.flatMap(ex => ex.prescriptions);
  assert.equal(rows.length, 32);
  assert.equal(new Set(rows.map(row => row.id)).size, 32);
  for (const ex of block.exercises) {
    assert.deepEqual(ex.prescriptions.map(row => row.rpe), [7,7,8,8,8.5,8.5,9,9]);
    assert.deepEqual(ex.prescriptions.map(row => row.reps), [5,3,5,3,5,3,5,3]);
    assert.ok(ex.prescriptions.every(row => row.weight % ex.step === 0 && row.performances.length === 0));
  }
  const next = createStrengthBlock({ ...targets, bench: 110 }, 80);
  assert.equal(block.exercises[1].target, 100);
  assert.ok(next.exercises[1].prescriptions[0].weight > block.exercises[1].prescriptions[0].weight);
});
test('modifier un 1RM recalcule uniquement cet exercice et conserve les performances', () => {
  const block = createStrengthBlock({ pullup: 45, bench: 100, dips: 37.5, squat: 120 }, 80);
  const performance = { weight: 20, reps: 5, rpe: 8, note: '', date: '2026-09-23' };
  block.exercises[0].prescriptions[0].performances.push(performance);
  const updated = updateStrengthLoads(block, 'pullup', 50, undefined);
  assert.equal(updated.exercises[0].target, 50);
  assert.ok(updated.exercises[0].prescriptions[0].weight > block.exercises[0].prescriptions[0].weight);
  assert.deepEqual(updated.exercises[0].prescriptions[0].performances, [performance]);
  assert.equal(updated.exercises[1], block.exercises[1]);
  assert.equal(updated.exercises[2], block.exercises[2]);
});
test('modifier le poids du corps recalcule dips et tractions', () => {
  const block = createStrengthBlock({ pullup: 45, bench: 100, dips: 37.5, squat: 120 }, 80);
  const updated = updateStrengthLoads(block, 'pullup', 45, 85);
  assert.equal(updated.bodyWeight, 85);
  assert.ok(updated.exercises[0].prescriptions[0].weight < block.exercises[0].prescriptions[0].weight);
  assert.ok(updated.exercises[2].prescriptions[0].weight < block.exercises[2].prescriptions[0].weight);
  assert.equal(updated.exercises[1], block.exercises[1]);
});
test('refus des objectifs et paramètres invalides', () => {
  for (const target of [0, -1, NaN, Infinity]) assert.throws(() => calculateWeight(target, 5, 7, 2.5));
  assert.throws(() => calculateWeight(100, 13, 7, 2.5));
  assert.throws(() => calculateWeight(100, 5, 4, 2.5));
  assert.throws(() => createStrengthBlock({ pullup: 45, bench: 100, dips: 37.5, squat: 120 }, 0));
});

function assertDistinctWeeks(block) {
  for (const exercise of block.exercises) for (const reps of [3, 5]) {
    const rows = exercise.prescriptions.filter(row => row.reps === reps).sort((a, b) => a.week - b.week);
    rows.forEach((row, index) => {
      assert.ok(row.weight >= 0);
      assert.ok(Math.abs(row.weight / exercise.step - Math.round(row.weight / exercise.step)) < 1e-8);
      if (index) assert.notEqual(row.weight, rows[index - 1].weight, `${exercise.id} ×${reps}, semaine ${row.week}`);
    });
  }
}

test('durée, exercices et RPE personnalisés, y compris un cycle de décharge', () => {
  const weekRpes = [7, 8, 9, 6.5, 8, 9.5];
  const block = createStrengthBlock({ deadlift: 140, muscleup: 25 }, 75, { exerciseIds: ['deadlift', 'muscleup'], weekRpes });
  assert.deepEqual(block.exercises.map(ex => ex.id), ['deadlift', 'muscleup']);
  assert.deepEqual(getStrengthWeeks(block), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(block.weekRpes, weekRpes);
  assert.ok(block.exercises.every(ex => ex.prescriptions.length === 12));
  assert.equal(block.exercises[0].prescriptions[0].weight, 110);
  assert.equal(block.exercises[1].prescriptions[0].weight, 3.75);
  assertDistinctWeeks(block);
  const legacy = { ...block }; delete legacy.weekRpes;
  assert.deepEqual(getStrengthWeeks(legacy), [1, 2, 3, 4, 5, 6]);
});

test('les doublons sont corrigés dans les deux sens sans changer les autres séries', () => {
  const rising = createStrengthBlock({ bench: 40 }, 0, { exerciseIds: ['bench'], weekRpes: [8, 8.5] });
  assert.deepEqual(rising.exercises[0].prescriptions.filter(row => row.reps === 3).map(row => row.weight), [35, 37.5]);
  const falling = createStrengthBlock({ bench: 40 }, 0, { exerciseIds: ['bench'], weekRpes: [8.5, 8] });
  assert.deepEqual(falling.exercises[0].prescriptions.filter(row => row.reps === 3).map(row => row.weight), [35, 32.5]);
  assertDistinctWeeks(rising); assertDistinctWeeks(falling);
  assert.equal(rising.bodyWeight, undefined);
});

test('RPE identiques et lest nul : pas de doublon consécutif ni de charge négative', () => {
  for (const weekRpes of [Array(24).fill(8), [10, 9, 8, 7, 6.5], [7]]) {
    const block = createStrengthBlock({ muscleup: 0 }, 80, { exerciseIds: ['muscleup'], weekRpes });
    assertDistinctWeeks(block);
    assert.equal(block.exercises[0].prescriptions.length, weekRpes.length * 2);
  }
});

test('recalcul du muscle-up et des anciens blocs : calendrier, identifiants et performances conservés', () => {
  const block = createStrengthBlock({ muscleup: 30, deadlift: 100 }, 80, { exerciseIds: ['muscleup', 'deadlift'], weekRpes: [8, 8, 8, 8, 8] });
  delete block.weekRpes;
  const performance = { weight: 5, reps: 3, rpe: 8, note: 'Test', date: '2026-09-25' };
  block.exercises[0].prescriptions[0].performances.push(performance);
  const original = structuredClone(block);
  const next = updateStrengthLoads(block, 'muscleup', 32.5, 85);
  assertDistinctWeeks(next);
  assert.deepEqual(block, original);
  assert.deepEqual(next.exercises[0].prescriptions.map(row => row.id), block.exercises[0].prescriptions.map(row => row.id));
  assert.deepEqual(next.exercises[0].prescriptions[0].performances, [performance]);
  assert.equal(next.exercises[1], block.exercises[1]);
  assert.deepEqual(getStrengthWeeks(next), [1, 2, 3, 4, 5]);
});

test('validation du calendrier, de la sélection et du poids du corps', () => {
  for (const options of [{ weekRpes: [] }, { weekRpes: Array(25).fill(8) }, { weekRpes: [7.2] }, { exerciseIds: [] }, { exerciseIds: ['bench', 'bench'] }, { exerciseIds: ['unknown'] }]) {
    assert.throws(() => createStrengthBlock({ bench: 100 }, 80, options));
  }
  assert.throws(() => createStrengthBlock({}, 80, { exerciseIds: ['deadlift'] }));
  assert.throws(() => createStrengthBlock({ muscleup: 10 }, 0, { exerciseIds: ['muscleup'] }));
  assert.throws(() => createStrengthBlock({ deadlift: 0 }, 0, { exerciseIds: ['deadlift'] }));
});
