import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

let response;
const payloads = [];
const query = {
  upsert(payload) { payloads.push(payload); return this; },
  update(payload) { payloads.push(payload); return this; }, eq() { return this; }, select() { return this; },
  order() { return Promise.resolve(response); },
  abortSignal() { return this; }, single() { return Promise.resolve(response); },
};
globalThis.draftTestClient = { from: () => query };
const source = readFileSync(new URL('../src/workoutService.ts', import.meta.url), 'utf8')
  .replace("import { sortWorkoutsByLastModified, stampWorkoutExercises } from './workoutOrder';", readFileSync(new URL('../src/workoutOrder.ts', import.meta.url), 'utf8').replace("import type { Exercise, Workout } from './types';", ''))
  .replace("import { supabase } from './supabaseClient';", 'const supabase = globalThis.draftTestClient;')
  .replace("import { isNutritionRecord } from './nutritionService';", 'const isNutritionRecord = () => false;');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { addWorkout, updateWorkout, getUserWorkouts } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('une tentative après coupure conserve le même identifiant et retourne la ligne confirmée', async context => {
  context.mock.method(console, 'error', () => {});
  const workout = { id: 'draft-uuid', name: 'Push', date: '2026-09-28', exercises: [] };
  response = { data: null, error: new Error('Network error') };
  assert.equal((await addWorkout('alice', workout)).success, false);
  response = { data: workout, error: null };
  assert.deepEqual((await addWorkout('alice', workout)).data, workout);
  assert.deepEqual(payloads.map(value => value.id), ['draft-uuid', 'draft-uuid']);
});

test('une mise à jour refusée ne peut pas être annoncée comme enregistrée', async context => {
  context.mock.method(console, 'error', () => {});
  response = { data: null, error: new Error('No row returned') };
  assert.equal((await updateWorkout('missing', { name: 'Push' })).success, false);
});

test('une modification enregistre sa date dans le JSON existant sans changer la date de séance', async () => {
  const exercises = [{ id: 'ex', name: 'Bench', sets: [{ id: 's', weight: 80, reps: 5 }] }];
  response = { data: { id: 'old', exercises }, error: null };
  assert.equal((await updateWorkout('old', { name: 'Push', exercises })).success, true);
  const payload = payloads.at(-1);
  assert.ok(Number.isFinite(Date.parse(payload.exercises[0].workoutUpdatedAt)));
  assert.deepEqual(payload.exercises[0].sets, exercises[0].sets);
  assert.equal(payload.date, undefined);
  assert.equal(exercises[0].workoutUpdatedAt, undefined);
});

test('le chargement trie aussi les anciennes séances modifiées en tête', async () => {
  const recent = { id: 'recent', name: 'Recent', date: '2026-10-01', exercises: [] };
  const modified = { id: 'modified', name: 'Modified', date: '2025-01-01', exercises: [{ id: 'ex', name: 'Bench', sets: [], workoutUpdatedAt: '2026-10-05T12:00:00Z' }] };
  response = { data: [recent, modified], error: null };
  assert.deepEqual((await getUserWorkouts('alice')).data.map(row => row.id), ['modified', 'recent']);
});
