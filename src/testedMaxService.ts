import { supabase } from './supabaseClient';
import { testedMaxRecord, TESTED_MAX_NAME } from './testedMaxes';
import type { TestedMax } from './testedMaxes';
import type { Workout } from './types';

export async function saveTestedMax(userId: string, value: TestedMax): Promise<Workout> {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  const record = testedMaxRecord(value);
  const { data, error } = await supabase.from('workouts').upsert({ ...record, user_id: userId }, { onConflict: 'id' }).select('*').eq('user_id', userId).abortSignal(AbortSignal.timeout(15000)).single();
  if (error || !data) throw new Error('Enregistrement impossible. Tes saisies sont conservées ; réessaie.');
  return data as Workout;
}
export async function removeTestedMax(userId: string, id: string): Promise<void> {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  const { error } = await supabase.from('workouts').delete().eq('id', id).eq('user_id', userId).eq('name', TESTED_MAX_NAME).abortSignal(AbortSignal.timeout(15000));
  if (error) throw new Error('Suppression impossible. Réessaie.');
}
