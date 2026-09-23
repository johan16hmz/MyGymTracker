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
] as const;
export const WEEK_RPES = [7, 8, 8.5, 9];
export const formatNumber = (value: number) => value.toLocaleString('fr-FR');

export function calculateWeight(target: number, reps: number, rpe: number, step: number, bodyWeight = 0) {
  const percentage = RPE_TABLE.find(row => row.rpe === rpe)?.percentages[reps - 1];
  if (!Number.isFinite(target) || target <= 0 || !percentage || !Number.isFinite(step) || step <= 0 || !Number.isFinite(bodyWeight) || bodyWeight < 0) {
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
  exercises: StrengthExercise[];
}

export function createStrengthBlock(targets: Record<string, number>, bodyWeight: number): StrengthBlock {
  if (!Number.isFinite(bodyWeight) || bodyWeight <= 0) throw new Error('Poids du corps invalide.');
  return {
    version: 1,
    bodyWeight,
    exercises: STRENGTH_EXERCISES.map(exercise => ({
      ...exercise,
      target: targets[exercise.id],
      prescriptions: WEEK_RPES.flatMap((rpe, index) => [5, 3].map(reps => ({
        id: crypto.randomUUID(), week: index + 1, reps, rpe,
        weight: calculateWeight(targets[exercise.id], reps, rpe, exercise.step, exercise.weighted ? bodyWeight : 0),
        performances: [],
      }))),
    })),
  };
}

export function updateStrengthLoads(block: StrengthBlock, exerciseId: string, target: number, bodyWeight: number | undefined): StrengthBlock {
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
        prescriptions: exercise.prescriptions.map(row => ({
          ...row,
          weight: calculateWeight(nextTarget, row.reps, row.rpe, exercise.step, exercise.weighted ? (bodyWeight ?? block.bodyWeight ?? 0) : 0),
        })),
      };
    }),
  };
}
