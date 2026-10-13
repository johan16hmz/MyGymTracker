import type { StrengthBlock } from './strength';
import type { NutritionDay, NutritionProfile } from './nutrition';

export interface Set {
  id: string;
  weight: number;
  reps: number;
  repsMin?: number; // Tranche min (ex: 6 pour 6-8)
  repsMax?: number; // Tranche max (ex: 8 pour 6-8)
}

export interface Exercise {
  trainingSession?: TrainingSession;
  workoutUpdatedAt?: string;
  strengthBlock?: StrengthBlock;
  nutritionProfile?: NutritionProfile;
  nutritionDay?: NutritionDay;
  id: string;
  name: string;
  sets: Set[];
}

export interface TrainingSession {
  version: 1;
  id: string;
  source: 'workout' | 'strength';
  sourceId: string;
  name: string;
  date: string;
  recordedAt: string;
  note: string;
  bodyWeightKg?: number;
  week?: number;
  exercises: {
    id: string;
    name: string;
    weighted: boolean;
    sets: { weight: number; reps: number; rpe?: number; prescriptionId?: string }[];
  }[];
}

export interface Workout {
  created_at?: string;
  id: string;
  name: string;
  date: string;
  exercises: Exercise[];
}
