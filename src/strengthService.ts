import { supabase } from './supabaseClient';
import type { Workout } from './types';
import type { StrengthBlock } from './strength';

// Les blocs utilisent le JSON des séances pour bénéficier du stockage et des
// permissions du compte existant, sans nécessiter de migration de la base.
export function getStrengthBlock(workout: Workout) {
  return workout.exercises.find(exercise => exercise.strengthBlock)?.strengthBlock;
}

export async function saveStrengthBlock(userId: string, name: string, block: StrengthBlock, existing?: Workout): Promise<Workout> {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  const exercises = [{ id: existing?.exercises[0]?.id ?? crypto.randomUUID(), name: 'Bloc force', sets: [], strengthBlock: block }];
  const payload = { name, exercises };
  const query = existing
    ? supabase.from('workouts').update(payload).eq('id', existing.id).eq('user_id', userId)
    : supabase.from('workouts').insert({ ...payload, user_id: userId, date: new Date().toLocaleDateString('en-CA'), created_at: new Date().toISOString() });
  const { data, error } = await query.select('*').single();
  if (error) throw new Error('Enregistrement impossible. Tes saisies sont conservées à l’écran ; réessaie.');
  return data as Workout;
}
