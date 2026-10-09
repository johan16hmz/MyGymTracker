import { supabase } from './supabaseClient';
import { NUTRITION_PROFILE_NAME, NUTRITION_DAY_NAME } from './nutrition';
import type { Workout } from './types';
import type { StatsSource } from './statistics';

export async function loadStatistics(userId: string): Promise<StatsSource> {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  // Paginate so Supabase's response limit does not hide older performances.
  const records: Workout[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('workouts').select('*').eq('user_id', userId).order('id', { ascending: true }).range(offset, offset + 499).abortSignal(AbortSignal.timeout(15000));
    if (error) throw new Error('Impossible de charger tes statistiques. Réessaie.');
    records.push(...(data ?? []) as Workout[]);
    if (!data || data.length < 500) break;
  }
  return {
    workouts: records.filter(row => row.name !== NUTRITION_PROFILE_NAME && row.name !== NUTRITION_DAY_NAME),
    profile: records.flatMap(row => row.exercises).find(ex => ex.nutritionProfile)?.nutritionProfile,
    days: records.flatMap(row => row.exercises).flatMap(ex => ex.nutritionDay ? [ex.nutritionDay] : []),
  };
}
