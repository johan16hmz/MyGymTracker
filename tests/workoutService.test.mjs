import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

let response;
const payloads = [];
const query = {
  upsert(payload) { payloads.push(payload); return this; },
  update() { return this; }, eq() { return this; }, select() { return this; },
  abortSignal() { return this; }, single() { return Promise.resolve(response); },
};
globalThis.draftTestClient = { from: () => query };
const source = readFileSync(new URL('../src/workoutService.ts', import.meta.url), 'utf8')
  .replace("import { supabase } from './supabaseClient';", 'const supabase = globalThis.draftTestClient;')
  .replace("import { isNutritionRecord } from './nutritionService';", 'const isNutritionRecord = () => false;');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { addWorkout, updateWorkout } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

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
