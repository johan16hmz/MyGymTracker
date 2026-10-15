import type { Workout } from './types';
import { localDate } from './nutrition.js';
import { validTrainingDate } from './trainingSessions.js';

export const TESTED_MAX_NAME = '__strength_tested_max__';
export interface TestedMax {
  version: 1;
  id: string;
  exerciseId: string;
  exercise: string;
  weighted: boolean;
  weight: number;
  date: string;
  recordedAt: string;
  note: string;
}

export function validateTestedMax(value: TestedMax, today = localDate()): void {
  if (!value || value.version !== 1 || typeof value.id !== 'string' || !value.id.trim() || typeof value.exerciseId !== 'string' || !value.exerciseId.trim() || value.exerciseId.length > 100 || typeof value.exercise !== 'string' || !value.exercise.trim() || value.exercise.length > 150 || typeof value.weighted !== 'boolean') throw new Error('Choisis un exercice de force.');
  if (!Number.isFinite(value.weight) || value.weight < 0 || value.weight > 2000 || (!value.weighted && value.weight === 0)) throw new Error('Vérifie la charge réalisée.');
  if (typeof value.date !== 'string' || !validTrainingDate(value.date) || value.date > today || typeof value.recordedAt !== 'string' || !Number.isFinite(Date.parse(value.recordedAt))) throw new Error('Choisis une date valide, aujourd’hui ou avant.');
  if (typeof value.note !== 'string' || value.note.length > 500) throw new Error('La note est limitée à 500 caractères.');
}

export const isTestedMaxRecord = (workout: Workout) => workout.name === TESTED_MAX_NAME;
export function testedMaxRecord(value: TestedMax, today = localDate()): Workout {
  validateTestedMax(value, today);
  return { id: value.id, name: TESTED_MAX_NAME, date: value.date, exercises: [{ id: value.id, name: '1RM testé', sets: [], testedMax: { ...value } }] };
}
export function testedMaxes(workouts: Workout[], today = localDate()): TestedMax[] {
  const records = new Map<string, TestedMax>();
  for (const workout of workouts) {
    if (!isTestedMaxRecord(workout)) continue;
    const value = workout.exercises?.[0]?.testedMax;
    try { if (value && value.id === workout.id) { validateTestedMax(value, today); records.set(value.id, value); } } catch { /* Ignore malformed legacy/imported records. */ }
  }
  return [...records.values()].sort((a, b) => a.date.localeCompare(b.date) || a.recordedAt.localeCompare(b.recordedAt));
}
export function testedMaxPoints(values: TestedMax[], exerciseId: string): TestedMax[] {
  const days = new Map<string, TestedMax>();
  for (const value of values.filter(item => item.exerciseId === exerciseId)) {
    const previous = days.get(value.date);
    if (!previous || value.weight > previous.weight) days.set(value.date, value);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}
