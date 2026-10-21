import { supabase } from './supabaseClient';
import type { Workout } from './types';
import type { DatedWeight, NutritionDay, NutritionProfile, SavedMeal } from './nutrition';
import { localDate, NUTRITION_DAY_NAME, NUTRITION_PROFILE_NAME, NUTRITION_MEAL_NAME } from './nutrition';
import { validateSavedMeal } from './nutritionMeals';
import { profileWithWeightHistory } from './statistics';
import type { FoodHistoryEntry } from './nutritionHistory';

export function isNutritionRecord(workout: Workout) {
  return workout.name === NUTRITION_PROFILE_NAME || workout.name === NUTRITION_DAY_NAME || workout.name === NUTRITION_MEAL_NAME || workout.exercises.some(exercise => !!exercise.nutritionProfile || !!exercise.nutritionDay || !!exercise.nutritionMeal);
}

export async function loadSavedMeals(userId: string): Promise<SavedMeal[]> {
  const meals: SavedMeal[] = [];
  for(let offset=0;;offset+=500){
    const {data,error}=await client().from('workouts').select('id,exercises').eq('user_id',userId).eq('name',NUTRITION_MEAL_NAME).order('id',{ascending:true}).range(offset,offset+499).abortSignal(AbortSignal.timeout(15000));
    if(error)throw new Error('Impossible de charger les repas enregistrés. Réessaie.');
    for(const record of data ?? []){
      const meal = (record.exercises as Workout['exercises']).find(exercise=>exercise.nutritionMeal)?.nutritionMeal;
      if(!meal)continue;
      const saved={...meal,id:record.id};
      validateSavedMeal(saved);
      meals.push(saved);
    }
    if(!data || data.length<500)break;
  }
  return meals.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSavedMeal(userId: string, meal: SavedMeal): Promise<void> {
  validateSavedMeal(meal);
  const {data:existing,error:readError}=await client().from('workouts').select('id').eq('user_id',userId).eq('name',NUTRITION_MEAL_NAME).eq('id',meal.id).abortSignal(AbortSignal.timeout(15000)).limit(1);
  if(readError)throw new Error('Impossible de vérifier le repas enregistré. Réessaie.');
  const payload={name:NUTRITION_MEAL_NAME,date:localDate(),exercises:[{id:meal.id,name:meal.name,sets:[],nutritionMeal:structuredClone(meal)}]};
  const query=existing?.length
    ? client().from('workouts').update(payload).eq('id',meal.id).eq('user_id',userId).eq('name',NUTRITION_MEAL_NAME)
    : client().from('workouts').insert({...payload,id:meal.id,user_id:userId,created_at:new Date().toISOString()});
  const {data,error}=await query.select('id').abortSignal(AbortSignal.timeout(15000)).single();
  if(error || !data)throw new Error('Enregistrement du repas impossible. Tes saisies sont conservées.');
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
  const latest = await loadNutritionProfile(userId);
  const current = latest.record ?? existing;
  const tracked = profileWithWeightHistory(profile, latest.profile);
  return saveRecord(userId, NUTRITION_PROFILE_NAME, current?.date ?? localDate(), [{
    id: current?.exercises[0]?.id ?? crypto.randomUUID(), name: 'Nutrition profile', sets: [], nutritionProfile: tracked,
  }], current);
}

export async function loadNutritionDay(userId: string, date: string) {
  const record = await findRecord(userId, NUTRITION_DAY_NAME, date);
  const day: NutritionDay = record?.exercises.find(exercise => exercise.nutritionDay)?.nutritionDay ?? { date, entries: [] };
  const {data,error}=await client().from('health_step_totals').select('count,updated_at').eq('user_id',userId).eq('date',date).maybeSingle();
  // Optional migration: nutrition keeps working before Health sync is installed.
  if(error && !['PGRST205','42P01'].includes(error.code)) throw new Error('Impossible de charger les pas. Réessaie avant de modifier la journée.');
  if(data && (!day.steps || Date.parse(data.updated_at) > Date.parse(day.steps.updatedAt))) {
    return {record,day:{...day,steps:{count:data.count,source:'apple-shortcuts' as const,updatedAt:data.updated_at}}};
  }
  return { record, day };
}

export async function loadNutritionHistory(userId:string):Promise<{entries:FoodHistoryEntry[];weights:DatedWeight[]}> {
  const entries:FoodHistoryEntry[]=[];
  const weights:DatedWeight[]=[];
  // Owner filtering on every page; no 14-day cut-off or database row-limit loss.
  for(let offset=0;;offset+=500){
    const {data,error}=await client().from('workouts').select('id,date,exercises').eq('user_id',userId).eq('name',NUTRITION_DAY_NAME).order('date',{ascending:false}).order('id',{ascending:false}).range(offset,offset+499).abortSignal(AbortSignal.timeout(15000));
    if(error)throw new Error('Impossible de charger l’historique alimentaire. Réessaie.');
    for(const record of data ?? [])for(const exercise of record.exercises as Workout['exercises']){
      const day=exercise.nutritionDay;
      if(day?.weightKg!==undefined)weights.push({date:record.date,weightKg:day.weightKg});
      for(const entry of day?.entries ?? [])entries.push({...entry,diaryDate:record.date});
    }
    if(!data || data.length<500)break;
  }
  return {entries,weights};
}

export async function loadRecentFoods(userId:string):Promise<FoodHistoryEntry[]> {
  return (await loadNutritionHistory(userId)).entries;
}

export async function healthSyncStatus() {
  const {data,error}=await client().rpc('health_sync_status');
  if(error)throw new Error('La synchronisation Santé doit être activée sur le serveur.');
  return data as string|null;
}
export async function enableHealthSync(token:string) {
  const {data,error}=await client().rpc('health_sync_enable',{p_token:token});
  if(error)throw new Error('Activation impossible. Vérifie la configuration du serveur.');
  return data as string;
}
export async function revokeHealthSync() {
  const {error}=await client().rpc('health_sync_revoke');
  if(error)throw new Error('Impossible de révoquer la connexion. Réessaie.');
}

export async function saveNutritionDay(userId: string, day: NutritionDay, existing?: Workout) {
  return saveRecord(userId, NUTRITION_DAY_NAME, day.date, [{
    id: existing?.exercises[0]?.id ?? crypto.randomUUID(), name: 'Nutrition day', sets: [], nutritionDay: day,
  }], existing);
}
