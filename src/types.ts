import type { StrengthBlock } from './strength';

export interface Set {
  id: string;
  weight: number;
  reps: number;
  repsMin?: number; // Tranche min (ex: 6 pour 6-8)
  repsMax?: number; // Tranche max (ex: 8 pour 6-8)
}

export interface Exercise {
  strengthBlock?: StrengthBlock;
  id: string;
  name: string;
  sets: Set[];
}

export interface Workout {
  id: string;
  name: string;
  date: string;
  exercises: Exercise[];
}
