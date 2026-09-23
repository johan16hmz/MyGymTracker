import { supabase } from './supabaseClient';
import type { Workout } from './types';
import type { NutritionDay, NutritionProfile } from './nutrition';
import { localDate, NUTRITION_DAY_NAME, NUTRITION_PROFILE_NAME } from './nutrition';

export function isNutritionRecord(workout: Workout) {
  return workout.name === NUTRITION_PROFILE_NAME || workout.name === NUTRITION_DAY_NAME || workout.exercises.some(exercise => !!exercise.nutritionProfile || !!exercise.nutritionDay);
}

function client() {
  if (!supabase) throw new Error('Connexion à la base indisponible.');
  return supabase;
}

async function findRecord(userId: string, name: string, date?: string): Promise<Workout | undefined> {
  let query = client().from('workouts').select('*').eq('user_id', userId).eq('name', name);
  if (date) query = query.eq('date', date);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(error.message);
  return (data?.[0] as Workout | undefined);
}

async function saveRecord(userId: string, name: string, date: string, exercises: Workout['exercises'], existing?: Workout) {
  const payload = { name, date, exercises };
  const query = existing
    ? client().from('workouts').update(payload).eq('id', existing.id).eq('user_id', userId)
    : client().from('workouts').insert({ ...payload, user_id: userId, created_at: new Date().toISOString() });
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  return data as Workout;
}

export async function loadNutritionProfile(userId: string) {
  const record = await findRecord(userId, NUTRITION_PROFILE_NAME);
  return { record, profile: record?.exercises.find(exercise => exercise.nutritionProfile)?.nutritionProfile };
}

export async function saveNutritionProfile(userId: string, profile: NutritionProfile, existing?: Workout) {
  return saveRecord(userId, NUTRITION_PROFILE_NAME, existing?.date ?? localDate(), [{
    id: existing?.exercises[0]?.id ?? crypto.randomUUID(), name: 'Nutrition profile', sets: [], nutritionProfile: profile,
  }], existing);
}

export async function loadNutritionDay(userId: string, date: string) {
  const record = await findRecord(userId, NUTRITION_DAY_NAME, date);
  return { record, day: record?.exercises.find(exercise => exercise.nutritionDay)?.nutritionDay ?? { date, entries: [] } };
}

export async function saveNutritionDay(userId: string, day: NutritionDay, existing?: Workout) {
  return saveRecord(userId, NUTRITION_DAY_NAME, day.date, [{
    id: existing?.exercises[0]?.id ?? crypto.randomUUID(), name: 'Nutrition day', sets: [], nutritionDay: day,
  }], existing);
}
