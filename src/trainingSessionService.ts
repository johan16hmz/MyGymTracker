import { supabase } from './supabaseClient';
import type { TrainingSession, Workout } from './types';
import { trainingSessionRecord, TRAINING_SESSION_NAME } from './trainingSessions';

// Separate owner-protected rows retain history even when a reusable plan changes.
// The caller keeps the event ID across retries; upsert never adds a second event.
export async function saveTrainingSession(userId: string, session: TrainingSession): Promise<Workout> {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  const record = trainingSessionRecord(session);
  const {data,error} = await supabase.from('workouts').upsert({...record,user_id:userId},{onConflict:'id'}).select('*').eq('user_id',userId).abortSignal(AbortSignal.timeout(15000)).single();
  if(error || !data) throw new Error('Enregistrement impossible. Tes saisies sont conservées ; réessaie.');
  return data as Workout;
}

export async function removeTrainingSession(userId: string, id: string): Promise<void> {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  const {error} = await supabase.from('workouts').delete().eq('id',id).eq('user_id',userId).eq('name',TRAINING_SESSION_NAME).abortSignal(AbortSignal.timeout(15000));
  if(error) throw new Error('Suppression impossible. Réessaie.');
}
