import type { StrengthBlock } from './strength';
import type { NutritionDay, NutritionProfile, SavedMeal } from './nutrition';
import type { TestedMax } from './testedMaxes';

export interface Set {
  id: string;
  weight: number;
  reps: number;
  repsMin?: number; // Tranche min (ex: 6 pour 6-8)
  repsMax?: number; // Tranche max (ex: 8 pour 6-8)
}

export interface Exercise {
  testedMax?: TestedMax;
  // The active variant remains at the top level for legacy readers/counters.
  activeVariantId?: string;
  alternatives?: ExerciseVariant[];
  trainingSession?: TrainingSession;
  workoutUpdatedAt?: string;
  strengthBlock?: StrengthBlock;
  nutritionProfile?: NutritionProfile;
  nutritionDay?: NutritionDay;
  nutritionMeal?: SavedMeal;
  id: string;
  name: string;
  sets: Set[];
}

export interface ExerciseVariant {
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
  // Model content at validation time, not a record of actual Force sets.
  workoutSnapshot?: { id: string; name: string; sets: Set[] }[];
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
