import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/workoutDrafts.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { saveWorkoutDraft, readWorkoutDraft, listWorkoutDrafts, removeWorkoutDraft, applyDraftReps } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const entries = new Map();
globalThis.localStorage = {
  get length() { return entries.size; },
  key: i => [...entries.keys()][i] ?? null,
  getItem: key => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, value),
  removeItem: key => entries.delete(key),
};
const draft = { version: 1, mode: 'create', updatedAt: '2026-09-28T12:00:00Z', workout: { id: 'stable-id', name: 'Push', date: '2026-09-28', exercises: [{ id: 'bench', name: 'Bench', sets: [{ id: 'set1', weight: 80, reps: 5 }] }] }, repsInputValues: { set1: '6-8' } };

test('reprise fidèle, isolation des comptes et brouillons distincts par séance', () => {
  entries.clear();
  saveWorkoutDraft('alice', draft);
  saveWorkoutDraft('alice', { ...draft, mode: 'edit' });
  assert.deepEqual(readWorkoutDraft('alice'), draft);
  assert.equal(readWorkoutDraft('bob'), undefined);
  assert.equal(listWorkoutDrafts('alice').length, 2);
  removeWorkoutDraft('alice');
  assert.equal(readWorkoutDraft('alice'), undefined);
  assert.equal(readWorkoutDraft('alice', 'stable-id').mode, 'edit');
});

test('les répétitions non validées par une sortie du champ sont récupérées à l’enregistrement', () => {
  const result = applyDraftReps(draft.workout, draft.repsInputValues);
  assert.deepEqual(result.exercises[0].sets[0], { id: 'set1', weight: 80, reps: 0, repsMin: 6, repsMax: 8 });
  assert.equal(result.id, draft.workout.id);
  assert.equal(draft.workout.exercises[0].sets[0].reps, 5);
});

test('un brouillon corrompu ne bloque pas l’ouverture', () => {
  entries.clear();
  entries.set('mygymtracker:workout-draft:alice:new', '{invalid');
  assert.equal(readWorkoutDraft('alice'), undefined);
  assert.deepEqual(listWorkoutDrafts('alice'), []);
});
