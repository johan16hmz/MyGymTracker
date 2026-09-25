export const RPE_TABLE = [
  { rpe: 10, percentages: [100,95.5,92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68] },
  { rpe: 9.5, percentages: [97.8,93.9,90.7,87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7] },
  { rpe: 9, percentages: [95.5,92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68,65.3] },
  { rpe: 8.5, percentages: [93.9,90.7,87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64] },
  { rpe: 8, percentages: [92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68,65.3,62.6] },
  { rpe: 7.5, percentages: [90.7,87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64,61.3] },
  { rpe: 7, percentages: [89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68,65.3,62.6,59.9] },
  { rpe: 6.5, percentages: [87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64,61.3,58.6] },
];

export const STRENGTH_EXERCISES = [
  { id: 'pullup', name: 'Tractions', target: 45, step: 1.25, weighted: true },
  { id: 'bench', name: 'Bench', target: 100, step: 2.5, weighted: false },
  { id: 'dips', name: 'Dips', target: 37.5, step: 1.25, weighted: true },
  { id: 'squat', name: 'Squat', target: 120, step: 2.5, weighted: false },
  { id: 'deadlift', name: 'Soulevé de terre', target: 140, step: 2.5, weighted: false },
  { id: 'muscleup', name: 'Muscle-up', target: 15, step: 1.25, weighted: true },
] as const;
export type StrengthExerciseId = typeof STRENGTH_EXERCISES[number]['id'];
export const DEFAULT_STRENGTH_EXERCISES: StrengthExerciseId[] = ['pullup', 'bench', 'dips', 'squat'];
export const MAX_BLOCK_WEEKS = 24;
export const WEEK_RPES = [7, 8, 8.5, 9];
export const formatNumber = (value: number) => value.toLocaleString('fr-FR');

export function calculateWeight(target: number, reps: number, rpe: number, step: number, bodyWeight = 0) {
  const percentage = RPE_TABLE.find(row => row.rpe === rpe)?.percentages[reps - 1];
  if (!Number.isFinite(target) || target < 0 || (target === 0 && bodyWeight === 0) || !Number.isInteger(reps) || !percentage || !Number.isFinite(step) || step <= 0 || !Number.isFinite(bodyWeight) || bodyWeight < 0) {
    throw new Error('Paramètres de calcul invalides.');
  }
  // For weighted bodyweight exercises, the percentage applies to the total load.
  // Only the external load is prescribed; it cannot be negative.
  return Math.max(0, Math.round(((target + bodyWeight) * percentage / 100 - bodyWeight) / step) * step);
}

export interface StrengthPerformance {
  weight: number;
  reps: number;
  rpe: number;
  note: string;
  date: string;
}
export interface StrengthPrescription {
  id: string;
  week: number;
  reps: number;
  rpe: number;
  weight: number;
  performances: StrengthPerformance[];
}
export interface StrengthExercise {
  id: string;
  name: string;
  target: number;
  step: number;
  weighted: boolean;
  prescriptions: StrengthPrescription[];
}
export interface StrengthBlock {
  version: 1;
  bodyWeight?: number;
  weekRpes?: number[];
  exercises: StrengthExercise[];
}

// Use saved prescriptions for legacy blocks and for display, never a fixed four-week calendar.
export function getStrengthWeeks(block: StrengthBlock): number[] {
  return [...new Set(block.exercises.flatMap(exercise => exercise.prescriptions.map(row => row.week)))].sort((a, b) => a - b);
}

export function planStrengthLoads(exercise: StrengthExercise, bodyWeight = 0): StrengthPrescription[] {
  const planned = new Map<string, number>();
  const previousByReps = new Map<number, { week: number; rpe: number; weight: number }>();
  for (const row of [...exercise.prescriptions].sort((a, b) => a.week - b.week)) {
    let weight = calculateWeight(exercise.target, row.reps, row.rpe, exercise.step, exercise.weighted ? bodyWeight : 0);
    const previous = previousByReps.get(row.reps);
    if (previous?.week === row.week - 1 && Math.abs(previous.weight - weight) < 1e-8) {
      // Prefer the RPE's direction when rounding produces a duplicate. At zero,
      // the only available alternative is one positive increment.
      const direction = row.rpe < previous.rpe && weight >= exercise.step ? -1 : 1;
      weight = Number((weight + direction * exercise.step).toFixed(8));
    }
    planned.set(row.id, weight);
    previousByReps.set(row.reps, { week: row.week, rpe: row.rpe, weight });
  }
  return exercise.prescriptions.map(row => ({ ...row, weight: planned.get(row.id)! }));
}

export function createStrengthBlock(targets: Record<string, number>, bodyWeight: number, options: {
  weekRpes?: number[];
  exerciseIds?: StrengthExerciseId[];
} = {}): StrengthBlock {
  const weekRpes = options.weekRpes ?? WEEK_RPES;
  const exerciseIds = options.exerciseIds ?? DEFAULT_STRENGTH_EXERCISES;
  if (!weekRpes.length || weekRpes.length > MAX_BLOCK_WEEKS || weekRpes.some(rpe => !RPE_TABLE.some(row => row.rpe === rpe))) throw new Error('Choisis de 1 à 24 semaines et un RPE valide pour chaque semaine.');
  if (!exerciseIds.length || new Set(exerciseIds).size !== exerciseIds.length || exerciseIds.some(id => !STRENGTH_EXERCISES.some(ex => ex.id === id))) throw new Error('Choisis au moins un exercice valide.');
  const exercises = exerciseIds.map(id => STRENGTH_EXERCISES.find(ex => ex.id === id)!);
  const needsBodyWeight = exercises.some(ex => ex.weighted);
  if (needsBodyWeight && (!Number.isFinite(bodyWeight) || bodyWeight <= 0)) throw new Error('Poids du corps invalide.');
  return {
    version: 1,
    ...(needsBodyWeight ? { bodyWeight } : {}),
    weekRpes: [...weekRpes],
    exercises: exercises.map(exercise => {
      const next: StrengthExercise = {
        ...exercise,
        target: targets[exercise.id],
        prescriptions: weekRpes.flatMap((rpe, index) => [5, 3].map(reps => ({
          id: crypto.randomUUID(), week: index + 1, reps, rpe, weight: 0, performances: [],
        }))),
      };
      return { ...next, prescriptions: planStrengthLoads(next, bodyWeight) };
    }),
  };
}

export function updateStrengthLoads(block: StrengthBlock, exerciseId: string, target: number, bodyWeight: number | undefined): StrengthBlock {
  if (bodyWeight !== undefined && (!Number.isFinite(bodyWeight) || bodyWeight <= 0)) throw new Error('Poids du corps invalide.');
  const bodyWeightChanged = bodyWeight !== undefined && bodyWeight !== block.bodyWeight;
  return {
    ...block,
    bodyWeight: bodyWeight ?? block.bodyWeight,
    exercises: block.exercises.map(exercise => {
      if (exercise.id !== exerciseId && !(bodyWeightChanged && exercise.weighted)) return exercise;
      const nextTarget = exercise.id === exerciseId ? target : exercise.target;
      return {
        ...exercise,
        target: nextTarget,
        prescriptions: planStrengthLoads({ ...exercise, target: nextTarget }, bodyWeight ?? block.bodyWeight ?? 0),
      };
    }),
  };
}
