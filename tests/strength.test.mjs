import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { test } from 'node:test';
import ts from 'typescript';

globalThis.crypto ??= webcrypto;
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/strength.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { calculateWeight, createStrengthBlock, getCurrentStrengthBlockIndex, nextCurrentStrengthRank, updateStrengthLoads, updateStrengthSets, planStrengthLoads, strengthVolumeFactor, getStrengthWeeks, RPE_TABLE } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('le bloc actuel enregistré est préféré au premier bloc et peut être changé', () => {
  const blocks = [{ version: 1, exercises: [] }, { version: 1, currentRank: 1, exercises: [] }, { version: 1, exercises: [] }];
  assert.equal(getCurrentStrengthBlockIndex([]), -1);
  assert.equal(getCurrentStrengthBlockIndex(blocks), 1);
  assert.equal(nextCurrentStrengthRank(blocks), 2);
  blocks[2] = { ...blocks[2], currentRank: nextCurrentStrengthRank(blocks) };
  assert.equal(getCurrentStrengthBlockIndex(blocks), 2);
  assert.equal(nextCurrentStrengthRank(blocks), 3);
});

test('les anciens blocs sans choix explicite restent accessibles', () => {
  const blocks = [{ version: 1, exercises: [] }, { version: 1, exercises: [] }];
  assert.equal(getCurrentStrengthBlockIndex(blocks), 0);
  assert.equal(nextCurrentStrengthRank(blocks), 1);
  assert.equal(getCurrentStrengthBlockIndex([{ version: 1, currentRank: Number.NaN, exercises: [] }, blocks[1]]), 0);
});

test('tableau de RPE 6 à 10 avec 12 colonnes de répétitions', () => {
  assert.equal(RPE_TABLE.length, 9);
  assert.ok(RPE_TABLE.every(row => row.percentages.length === 12));
  assert.equal(RPE_TABLE.find(row => row.rpe === 7).percentages[4], 78.6);
  assert.equal(RPE_TABLE.find(row => row.rpe === 9).percentages[2], 89.2);
  assert.deepEqual(RPE_TABLE.find(row => row.rpe === 6).percentages.slice(0, 11), RPE_TABLE.find(row => row.rpe === 7).percentages.slice(1));
  assert.equal(RPE_TABLE.find(row => row.rpe === 6).percentages[11], 57.2);
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
  assert.equal(calculateWeight(100, 5, 6, 2.5), 75);
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
  const weekRpes = [7, 8, 9, 6, 8, 9.5];
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

test('trois séries par défaut, cinq séries au bench abaissent la charge sans modifier le RPE', () => {
  const block = createStrengthBlock({ bench: 110, squat: 120 }, 0, { exerciseIds: ['bench', 'squat'], setsByExercise: { bench: 5 } });
  assert.equal(block.exercises[0].prescriptions[0].sets, 5);
  assert.equal(block.exercises[0].prescriptions[0].weight, 85);
  assert.equal(block.exercises[0].prescriptions[0].rpe, 7);
  assert.equal(block.exercises[1].prescriptions[0].sets, 3);
  assert.equal(block.exercises[1].prescriptions[0].weight, 95);
  assert.equal(calculateWeight(100, 5, 7, 2.5, 0, 1), 77.5);
  assert.equal(calculateWeight(100, 5, 7, 2.5, 0, 2), 77.5);
  assert.equal(calculateWeight(100, 5, 7, 2.5, 0, 5, 0), 77.5);
});

test('modifier les séries recalcule la prescription et conserve les autres charges et performances', () => {
  const block = createStrengthBlock({ bench: 100, dips: 45 }, 80, { exerciseIds: ['bench', 'dips'] });
  const performance = { weight: 77.5, reps: 5, rpe: 8, note: 'Test', date: '2026-10-05' };
  block.exercises[0].prescriptions[0].performances.push(performance);
  block.exercises[0].prescriptions[1].weight = 82.5;
  const original = structuredClone(block);
  const next = updateStrengthSets(block, 'bench', block.exercises[0].prescriptions[0].id, 5);
  assert.equal(next.exercises[0].prescriptions[0].weight, 77.5);
  assert.deepEqual(next.exercises[0].prescriptions[0].performances, [performance]);
  assert.deepEqual(next.exercises[0].prescriptions.slice(1), block.exercises[0].prescriptions.slice(1));
  assert.equal(next.exercises[1], block.exercises[1]);
  assert.deepEqual(block, original);
  const restored = updateStrengthSets(next, 'bench', next.exercises[0].prescriptions[0].id, 3);
  assert.equal(restored.exercises[0].prescriptions[0].weight, 77.5);
  // Loaded JSON keeps the new volume metadata across save/reload.
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
});

test('la réduction du volume porte sur le poids total des mouvements lestés', () => {
  assert.equal(calculateWeight(45, 5, 7, 1.25, 80, 5), 16.25);
  assert.equal(calculateWeight(0, 5, 7, 1.25, 80, 10), 0);
  const block = createStrengthBlock({ dips: 45 }, 80, { exerciseIds: ['dips'], setsByExercise: { dips: 5 } });
  const updated = updateStrengthLoads(block, 'dips', 45, undefined, 0.5);
  assert.equal(updated.exercises[0].setReductionPercent, 0.5);
  assert.ok(updated.exercises[0].prescriptions[0].weight > block.exercises[0].prescriptions[0].weight);
});

test('les anciens blocs gardent leurs charges et utilisent trois séries', () => {
  const block = createStrengthBlock({ bench: 100 }, 0, { exerciseIds: ['bench'] });
  delete block.exercises[0].setReductionPercent;
  block.exercises[0].prescriptions.forEach(row => delete row.sets);
  const recalculated = updateStrengthLoads(block, 'bench', 100, undefined);
  assert.deepEqual(recalculated.exercises[0].prescriptions.map(row => row.weight), block.exercises[0].prescriptions.map(row => row.weight));
  const updated = updateStrengthSets(block, 'bench', block.exercises[0].prescriptions[0].id, 5);
  assert.equal(updated.exercises[0].prescriptions[0].weight, 77.5);
});

test('validation des séries et de la réduction', () => {
  for (const sets of [0, -1, 1.5, 11, NaN, Infinity]) {
    assert.throws(() => createStrengthBlock({ bench: 100 }, 0, { exerciseIds: ['bench'], setsByExercise: { bench: sets } }));
  }
  for (const percent of [-1, 5.1, NaN, Infinity]) assert.throws(() => calculateWeight(100, 5, 7, 2.5, 0, 5, percent));
});

test('avec plus de trois séries, les arrondis ne réaugmentent pas la charge pour différencier les semaines', () => {
  const block = createStrengthBlock({ bench: 40 }, 0, { exerciseIds: ['bench'], weekRpes: [8, 8], setsByExercise: { bench: 5 } });
  assert.equal(block.exercises[0].prescriptions[0].weight, block.exercises[0].prescriptions[2].weight);
  const row = block.exercises[0].prescriptions[2];
  let previous = Infinity;
  for (let sets = 3; sets <= 10; sets++) {
    const next = updateStrengthSets(block, 'bench', row.id, sets);
    const weight = next.exercises[0].prescriptions[2].weight;
    assert.ok(weight <= previous, `Increasing to ${sets} sets must not increase the weight`);
    previous = weight;
  }
});

test('recalculer les charges conserve les nombres de séries personnalisés de toutes les semaines', () => {
  let block = createStrengthBlock({ bench: 100, pullup: 45, dips: 40 }, 80, { exerciseIds: ['bench', 'pullup', 'dips'] });
  for (const exercise of block.exercises) {
    exercise.prescriptions.forEach((row, index) => { row.sets = [5, 2, 7, 4][index % 4]; });
    exercise.prescriptions[0].performances.push({ weight: 20, reps: 5, rpe: 8, note: 'Conserver', date: '2026-10-05' });
  }
  const original = structuredClone(block);
  for (const [exerciseId, target, bodyWeight, reduction] of [
    ['bench', 110, undefined, 2.5],
    ['pullup', 50, 85, 1],
    ['dips', 40, undefined, 3],
  ]) {
    block = updateStrengthLoads(block, exerciseId, target, bodyWeight, reduction);
    for (const [exerciseIndex, exercise] of block.exercises.entries()) {
      assert.deepEqual(exercise.prescriptions.map(({ weight, ...row }) => row), original.exercises[exerciseIndex].prescriptions.map(({ weight, ...row }) => row));
    }
  }
  assert.notEqual(block.exercises[0].prescriptions[0].weight, original.exercises[0].prescriptions[0].weight);
});

test('la création initialise séparément les séries en ×3 et ×5 pour chaque exercice et semaine', () => {
  const block = createStrengthBlock({ bench: 100, dips: 45 }, 80, {
    exerciseIds: ['bench', 'dips'], weekRpes: [7, 8, 9],
    setsByExercise: { bench: { 3: 7, 5: 5 }, dips: { 3: 2, 5: 4 } },
  });
  for (const exercise of block.exercises) for (const row of exercise.prescriptions) {
    const expected = exercise.id === 'bench' ? (row.reps === 3 ? 7 : 5) : (row.reps === 3 ? 2 : 4);
    assert.equal(row.sets, expected);
    assert.equal(row.weight, calculateWeight(exercise.target, row.reps, row.rpe, exercise.step, exercise.weighted ? 80 : 0, expected));
  }
  const bench = block.exercises[0];
  const edited = updateStrengthSets(block, 'bench', bench.prescriptions[0].id, 6);
  assert.equal(edited.exercises[0].prescriptions[0].sets, 6);
  assert.deepEqual(edited.exercises[0].prescriptions.slice(1), bench.prescriptions.slice(1));
  const recalculated = updateStrengthLoads(edited, 'bench', 110, undefined);
  assert.deepEqual(recalculated.exercises[0].prescriptions.map(row => row.sets), [6, 7, 5, 7, 5, 7]);
  assert.deepEqual(JSON.parse(JSON.stringify(recalculated)), recalculated);
});

test('la configuration partielle garde trois séries pour le format manquant et valide chaque format', () => {
  const block = createStrengthBlock({ bench: 100 }, 0, { exerciseIds: ['bench'], setsByExercise: { bench: { 3: 7 } } });
  assert.deepEqual(block.exercises[0].prescriptions.map(row => row.sets), [3, 7, 3, 7, 3, 7, 3, 7]);
  for (const reps of [3, 5]) for (const invalid of [0, 11, 1.5, NaN, Infinity]) {
    assert.throws(() => createStrengthBlock({ bench: 100 }, 0, { exerciseIds: ['bench'], setsByExercise: { bench: { [reps]: invalid } } }));
  }
});

test('réduction à zéro : mêmes charges que le calcul historique, quel que soit le nombre de séries', () => {
  const targets = { bench: 95, squat: 120, pullup: 45, dips: 37.5, deadlift: 140, muscleup: 15 };
  const exerciseIds = Object.keys(targets);
  for (const weekRpes of [[8, 7, 8, 8.5, 9], [9, 8.5, 8, 7], Array(24).fill(8)]) {
    const baseline = createStrengthBlock(targets, 80, { exerciseIds, weekRpes });
    for (let sets = 1; sets <= 10; sets++) {
      const next = createStrengthBlock(targets, 80, { exerciseIds, weekRpes, setReductionPercent: 0, setsByExercise: Object.fromEntries(exerciseIds.map(id => [id, { 3: sets, 5: 11 - sets }])) });
      assert.deepEqual(next.exercises.map(ex => ex.prescriptions.map(row => row.weight)), baseline.exercises.map(ex => ex.prescriptions.map(row => row.weight)), `0% reduction, ${sets} sets of 3 reps`);
    }
    // Changing set counts between weeks must also leave the old rounding intact.
    for (const exercise of baseline.exercises) {
      const mixed = { ...exercise, setReductionPercent: 0, prescriptions: exercise.prescriptions.map((row, index) => ({ ...row, sets: index % 10 + 1 })) };
      assert.deepEqual(planStrengthLoads(mixed, 80).map(row => row.weight), exercise.prescriptions.map(row => row.weight));
    }
  }
});

test('réduction à zéro au bench : les arrondis retrouvent 82,5 kg en ×5 et 87,5 kg en ×3', () => {
  const block = createStrengthBlock({ bench: 95 }, 0, { exerciseIds: ['bench'], weekRpes: [8, 7, 8, 8.5, 9], setsByExercise: { bench: 4 } });
  const next = updateStrengthLoads(block, 'bench', 95, undefined, 0);
  assert.deepEqual(next.exercises[0].prescriptions.filter(row => row.week === 5).map(row => row.weight), [82.5, 87.5]);
  assert.ok(next.exercises[0].prescriptions.every(row => row.sets === 4));
});

test('la réduction par défaut est de 1 % par série supplémentaire et les réglages explicites sont conservés', () => {
  assert.equal(strengthVolumeFactor(3), 1);
  assert.equal(strengthVolumeFactor(4), 0.99);
  assert.equal(strengthVolumeFactor(5), 0.98);
  const options = { exerciseIds: ['bench'], setsByExercise: { bench: 5 } };
  const block = createStrengthBlock({ bench: 110 }, 0, options);
  assert.equal(block.exercises[0].setReductionPercent, 1);
  for (const percent of [0, 2.5]) {
    const custom = createStrengthBlock({ bench: 110 }, 0, { ...options, setReductionPercent: percent });
    assert.equal(updateStrengthLoads(custom, 'bench', 120, undefined).exercises[0].setReductionPercent, percent);
  }
});
