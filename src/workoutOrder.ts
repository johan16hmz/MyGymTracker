import type { Exercise, Workout } from './types';

// Keep modification metadata in the existing JSON column, without a SQL migration.
export function stampWorkoutExercises(exercises: Exercise[], timestamp = new Date().toISOString()): Exercise[] {
  return exercises.map(exercise => ({ ...exercise, workoutUpdatedAt: timestamp }));
}

function timestamp(value?: string): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortWorkoutsByLastModified(workouts: Workout[]): Workout[] {
  const modifiedAt = (workout: Workout) => Math.max(0, ...workout.exercises.map(exercise => timestamp(exercise.workoutUpdatedAt))) || timestamp(workout.created_at) || timestamp(workout.date);
  return [...workouts].sort((a, b) => modifiedAt(b) - modifiedAt(a) || timestamp(b.date) - timestamp(a.date));
}
