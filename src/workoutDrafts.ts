import type { Workout } from './types';

export interface WorkoutDraft {
  version: 1;
  mode: 'create' | 'edit';
  workout: Workout;
  repsInputValues: Record<string, string>;
  updatedAt: string;
}

const prefix = (userId: string) => `mygymtracker:workout-draft:${encodeURIComponent(userId)}:`;
const key = (userId: string, id?: string) => `${prefix(userId)}${id ?? 'new'}`;

function decode(raw: string | null): WorkoutDraft | undefined {
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    const workout = draft?.workout;
    if (draft.version !== 1 || typeof draft.updatedAt !== 'string' || !['create', 'edit'].includes(draft.mode) || typeof workout?.id !== 'string' || typeof workout.name !== 'string' || typeof workout.date !== 'string' || !Array.isArray(workout.exercises)) return;
    if (!workout.exercises.every((ex: any) => typeof ex?.id === 'string' && typeof ex.name === 'string' && Array.isArray(ex.sets) && ex.sets.every((set: any) => typeof set?.id === 'string' && Number.isFinite(set.weight) && Number.isFinite(set.reps)))) return;
    if (!draft.repsInputValues || typeof draft.repsInputValues !== 'object' || !Object.values(draft.repsInputValues).every(value => typeof value === 'string')) return;
    return draft;
  } catch { return; }
}

export function readWorkoutDraft(userId: string, id?: string): WorkoutDraft | undefined {
  try { return decode(localStorage.getItem(key(userId, id))); } catch { return; }
}

export function listWorkoutDrafts(userId: string): WorkoutDraft[] {
  try {
    const drafts: WorkoutDraft[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(prefix(userId))) continue;
      const draft = decode(localStorage.getItem(storageKey));
      if (draft) drafts.push(draft);
    }
    return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch { return []; }
}

export function saveWorkoutDraft(userId: string, draft: WorkoutDraft) {
  localStorage.setItem(key(userId, draft.mode === 'edit' ? draft.workout.id : undefined), JSON.stringify(draft));
}

export function removeWorkoutDraft(userId: string, id?: string) {
  localStorage.removeItem(key(userId, id));
}

export function applyDraftReps(workout: Workout, values: Record<string, string>): Workout {
  return { ...workout, exercises: workout.exercises.map(ex => ({ ...ex, sets: ex.sets.map(set => {
    const raw = values[set.id];
    if (raw === undefined) return set;
    const parts = raw.trim().split('-').map(value => parseInt(value.trim(), 10) || 0);
    return parts.length > 1
      ? { ...set, reps: 0, repsMin: parts[0], repsMax: parts[1] }
      : { ...set, reps: parts[0], repsMin: 0, repsMax: 0 };
  }) })) };
}
