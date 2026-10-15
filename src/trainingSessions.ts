import type { TrainingSession, Workout } from './types';
import { localDate } from './nutrition.js';

export const TRAINING_SESSION_NAME = '__training_session__';

export function validTrainingDate(date: string): boolean {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0,10) === date;
}

export function isTrainingSessionRecord(workout: Workout): boolean {
  return workout.name === TRAINING_SESSION_NAME || workout.exercises.some(ex => !!ex.trainingSession);
}

export function validateTrainingSession(session: TrainingSession, today = localDate()): void {
  if (session.version !== 1 || !session.id || !session.sourceId || !session.name.trim() || !validTrainingDate(session.date) || session.date > today || !['workout','strength'].includes(session.source)) throw new Error('Vérifie la date et les informations de l’entraînement.');
  if (session.source === 'workout' && session.exercises.length) throw new Error('Les charges des modèles de séances ne sont pas des performances Force.');
  if (session.source === 'strength') {
    if (!session.exercises.length || session.exercises.some(ex => !ex.id || !ex.name || !ex.sets.length)) throw new Error('Sélectionne au moins une série réalisée.');
    for (const exercise of session.exercises) for (const set of exercise.sets) {
      if (!Number.isFinite(set.weight) || set.weight < 0 || set.weight > 2000 || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 1000 || (set.rpe !== undefined && (!Number.isFinite(set.rpe) || set.rpe < 1 || set.rpe > 10 || !Number.isInteger(set.rpe * 2)))) throw new Error('Vérifie les charges, les répétitions et le RPE.');
    }
  }
  if (typeof session.recordedAt !== 'string' || !Number.isFinite(Date.parse(session.recordedAt)) || typeof session.note !== 'string' || session.note.length > 500) throw new Error('Vérifie les informations de l’entraînement et la note.');
  if (session.bodyWeightKg !== undefined && (!Number.isFinite(session.bodyWeightKg) || session.bodyWeightKg < 25 || session.bodyWeightKg > 400)) throw new Error('Vérifie le poids du corps à la date de l’entraînement.');
  if (session.week !== undefined && (!Number.isInteger(session.week) || session.week<1)) throw new Error('Vérifie la semaine du bloc.');
}

export function getTrainingSession(workout: Workout, today = localDate()): TrainingSession | undefined {
  const session = workout.exercises.find(ex => ex.trainingSession)?.trainingSession;
  if (!session || session.id !== workout.id) return undefined;
  try { validateTrainingSession(session, today); return session; } catch { return undefined; }
}

export function trainingSessions(workouts: Workout[], today = localDate()): TrainingSession[] {
  const unique = new Map<string, TrainingSession>();
  for (const workout of workouts) { const session = getTrainingSession(workout, today); if (session) unique.set(session.id, session); }
  return [...unique.values()].sort((a,b)=>b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));
}

export function trainingSessionRecord(session: TrainingSession): Workout {
  validateTrainingSession(session);
  return { id:session.id, name:TRAINING_SESSION_NAME, date:session.date, created_at:session.recordedAt, exercises:[{id:session.id,name:'Entraînement réalisé',sets:[],trainingSession:structuredClone(session)}] };
}
