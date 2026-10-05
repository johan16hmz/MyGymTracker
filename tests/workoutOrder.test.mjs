import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/workoutOrder.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { stampWorkoutExercises, sortWorkoutsByLastModified } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const workout = (id, date) => ({ id, name: id, date, exercises: [{ id: `ex-${id}`, name: 'Bench', sets: [] }] });

test('modifier une ancienne séance la place en premier, même après rechargement', () => {
  const old = workout('old', '2025-01-01');
  const recent = workout('recent', '2026-10-01');
  assert.deepEqual(sortWorkoutsByLastModified([old, recent]).map(row => row.id), ['recent', 'old']);
  const modified = { ...old, exercises: stampWorkoutExercises(old.exercises, '2026-10-05T12:00:00Z') };
  const reloaded = JSON.parse(JSON.stringify([recent, modified]));
  assert.deepEqual(sortWorkoutsByLastModified(reloaded).map(row => row.id), ['old', 'recent']);
  assert.equal(old.exercises[0].workoutUpdatedAt, undefined);
});

test('la date de création et les anciennes séances sans métadonnées restent utilisables', () => {
  const created = { ...workout('created', '2025-01-01'), created_at: '2026-10-05T12:30:00Z' };
  const old = workout('old', '2026-10-01');
  old.exercises[0].workoutUpdatedAt = 'invalid';
  const records = [old, created];
  assert.deepEqual(sortWorkoutsByLastModified(records).map(row => row.id), ['created', 'old']);
  assert.equal(records[0].id, 'old');
});
