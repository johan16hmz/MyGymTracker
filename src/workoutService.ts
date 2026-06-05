import { supabase } from './supabaseClient';
import type { Workout } from './types';

function checkClient() {
  if (!supabase) {
    return { success: false as const, error: 'Supabase non configuré' };
  }
  return { success: true as const, client: supabase };
}

export async function addWorkout(userId: string, workout: Omit<Workout, 'id'>) {
  const check = checkClient();
  if (!check.success) return check;

  try {
    const { data, error } = await check.client.from('workouts').insert({
      user_id: userId,
      name: workout.name,
      date: workout.date,
      exercises: workout.exercises,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Erreur ajout séance:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
}

export async function getUserWorkouts(userId: string) {
  const check = checkClient();
  if (!check.success) return { success: false as const, error: check.error, data: [] as Workout[] };

  try {
    const { data, error } = await check.client
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) throw error;
    return { success: true, data: data as Workout[] };
  } catch (error) {
    console.error('Erreur récupération séances:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue', data: [] as Workout[] };
  }
}

export async function updateWorkout(workoutId: string, updates: Partial<Workout>) {
  const check = checkClient();
  if (!check.success) return check;

  try {
    const { data, error } = await check.client
      .from('workouts')
      .update({
        name: updates.name,
        exercises: updates.exercises,
      })
      .eq('id', workoutId);

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Erreur mise à jour séance:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
}

export async function deleteWorkout(workoutId: string) {
  const check = checkClient();
  if (!check.success) return check;

  try {
    const { error } = await check.client.from('workouts').delete().eq('id', workoutId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erreur suppression séance:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
}
