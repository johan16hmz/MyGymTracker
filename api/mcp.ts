import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Workout, Exercise } from '../src/types';
import { createStrengthBlock } from '../src/strength.js';
import type { StrengthBlock } from '../src/strength';
import { estimateCalories, NUTRITION_DAY_NAME, NUTRITION_PROFILE_NAME } from '../src/nutrition.js';
import type { FoodEntry, NutritionDay, NutritionProfile } from '../src/nutrition';
import { normalizeOpenFoodFacts } from '../src/nutritionFood.js';

export const runtime = 'nodejs';

const supabaseUrl = process.env.MYGYMTRACKER_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.MYGYMTRACKER_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

const setSchema = z.object({
  id: z.string().optional(),
  weight: z.number().min(0),
  reps: z.number().int().min(0),
  repsMin: z.number().int().min(0).optional(),
  repsMax: z.number().int().min(0).optional(),
});

const exerciseSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  sets: z.array(setSchema).default([]),
});

const workoutSchema = z.object({
  name: z.string().trim().min(1).max(150),
  date: z.string().trim().optional(),
  exercises: z.array(exerciseSchema),
});

const newId = () => crypto.randomUUID();
const json = (value: unknown) => JSON.stringify(value, null, 2);
const result = (value: unknown) => ({ content: [{ type: 'text' as const, text: json(value) }] });
const toolError = (error: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Erreur inconnue.' }] });

function cors(response: Response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Mcp-Session-Id, Last-Event-ID');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, Last-Event-ID');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function unauthorized(message: string) {
  return cors(new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' },
  }));
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim() || null;
}

function createAuthedClient(token: string) {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Variables Supabase manquantes sur Vercel.');
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function getUserFromToken(token: string) {
  const client = createAuthedClient(token);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new Error('Jeton Supabase invalide ou expiré.');
  return { client, user: data.user };
}

function strengthBlockOf(workout: Workout): StrengthBlock | undefined {
  return workout.exercises.find(exercise => exercise.strengthBlock)?.strengthBlock;
}

function normalizeWorkout(input: z.infer<typeof workoutSchema>) {
  return {
    name: input.name,
    date: input.date || new Date().toISOString().slice(0, 10),
    exercises: input.exercises.map(exercise => ({
      id: exercise.id || newId(),
      name: exercise.name,
      sets: exercise.sets.map(set => ({ ...set, id: set.id || newId() })),
    })),
  };
}

async function fetchWorkouts(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from('workouts').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Workout[]).filter(workout => workout.name !== NUTRITION_PROFILE_NAME && workout.name !== NUTRITION_DAY_NAME);
}

const nutritionProfileSchema = z.object({
  goal: z.enum(['lose', 'maintain', 'gain']), targetKg: z.number().min(25).max(400), age: z.number().int().min(18).max(100),
  heightCm: z.number().min(100).max(250), weightKg: z.number().min(25).max(400),
  activity: z.enum(['low', 'moderate', 'active', 'veryActive']), equationSex: z.enum(['female', 'male']),
  calorieOverride: z.number().min(1200).max(6000).optional(),
});
const nutritionFoodSchema = z.object({
  name: z.string().trim().min(1).max(150), brand: z.string().max(100).optional(), barcode: z.string().optional(),
  source: z.enum(['openfoodfacts', 'manual']), unit: z.enum(['g', 'ml']),
  kcal100: z.number().min(0), protein100: z.number().min(0), carbs100: z.number().min(0), fat100: z.number().min(0),
});
const nutritionDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nutritionMealSchema = z.enum(['breakfast', 'lunch', 'snack', 'dinner']);

async function nutritionRecord(client: SupabaseClient, userId: string, name: string, date?: string): Promise<Workout | undefined> {
  let query = client.from('workouts').select('*').eq('user_id', userId).eq('name', name);
  if (date) query = query.eq('date', date);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] as Workout | undefined;
}

async function writeNutritionRecord(client: SupabaseClient, userId: string, name: string, date: string, exercises: Exercise[], existing?: Workout) {
  const payload = { name, date, exercises };
  const query = existing ? client.from('workouts').update(payload).eq('id', existing.id).eq('user_id', userId) : client.from('workouts').insert({ ...payload, user_id: userId, created_at: new Date().toISOString() });
  const { data, error } = await query.select('*').single();
  if (error) throw new Error(error.message);
  return data as Workout;
}

function registerTools(server: McpServer, client: SupabaseClient, user: User) {
  server.registerTool('auth_status', {
    description: 'Vérifier le compte MyGymTracker utilisé par cette connexion MCP.',
    inputSchema: {},
  }, async () => result({ connected: true, user: { id: user.id, email: user.email } }));

  server.registerTool('profile_get', {
    description: 'Lire le profil de l’utilisateur connecté.',
    inputSchema: {},
  }, async () => {
    try {
      const { data, error } = await client.from('users').select('*').eq('id', user.id).maybeSingle();
      if (error) throw new Error(error.message);
      return result({ auth: { id: user.id, email: user.email }, profile: data });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('profile_update', {
    description: 'Modifier le pseudo du profil connecté.',
    inputSchema: { username: z.string().trim().min(1).max(100) },
  }, async ({ username }) => {
    try {
      const { data, error } = await client.from('users').update({ username }).eq('id', user.id).select('*').single();
      if (error) throw new Error(error.message);
      return result(data);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('workouts_list', {
    description: 'Lister les séances du compte connecté, avec tous les exercices et séries.',
    inputSchema: { includeStrength: z.boolean().default(true) },
  }, async ({ includeStrength }) => {
    try {
      const workouts = await fetchWorkouts(client, user.id);
      return result(includeStrength ? workouts : workouts.filter(workout => !strengthBlockOf(workout)));
    } catch (error) { return toolError(error); }
  });

  server.registerTool('workout_get', {
    description: 'Lire une séance précise.',
    inputSchema: { workoutId: z.string().min(1) },
  }, async ({ workoutId }) => {
    try {
      const { data, error } = await client.from('workouts').select('*').eq('id', workoutId).eq('user_id', user.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Séance introuvable.');
      return result(data);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('workout_create', {
    description: 'Créer et enregistrer une séance avec ses exercices, poids et répétitions.',
    inputSchema: workoutSchema.shape,
  }, async input => {
    try {
      const workout = normalizeWorkout(input);
      const { data, error } = await client.from('workouts').insert({ ...workout, user_id: user.id, created_at: new Date().toISOString() }).select('*').single();
      if (error) throw new Error(error.message);
      return result(data);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('workout_update', {
    description: 'Modifier le nom, la date ou les exercices d’une séance.',
    inputSchema: {
      workoutId: z.string().min(1),
      name: z.string().trim().min(1).max(150).optional(),
      date: z.string().trim().optional(),
      exercises: z.array(exerciseSchema).optional(),
    },
  }, async ({ workoutId, name, date, exercises }) => {
    try {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (date !== undefined) updates.date = date;
      if (exercises !== undefined) updates.exercises = normalizeWorkout({ name: name || 'séance', date, exercises }).exercises;
      if (!Object.keys(updates).length) throw new Error('Aucune modification fournie.');
      const { data, error } = await client.from('workouts').update(updates).eq('id', workoutId).eq('user_id', user.id).select('*').single();
      if (error) throw new Error(error.message);
      return result(data);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('workout_delete', {
    description: 'Supprimer une séance.',
    inputSchema: { workoutId: z.string().min(1) },
  }, async ({ workoutId }) => {
    try {
      const { error } = await client.from('workouts').delete().eq('id', workoutId).eq('user_id', user.id);
      if (error) throw new Error(error.message);
      return result({ deleted: true, workoutId });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('workout_stats', {
    description: 'Calculer les statistiques : séances, exercices, séries, volume et détail par exercice.',
    inputSchema: { includeStrength: z.boolean().default(false) },
  }, async ({ includeStrength }) => {
    try {
      const allWorkouts = await fetchWorkouts(client, user.id);
      const workouts = includeStrength ? allWorkouts : allWorkouts.filter(workout => !strengthBlockOf(workout));
      const byExercise = new Map<string, { name: string; sets: number; volumeKg: number; maxWeightKg: number; maxReps: number }>();
      let totalSets = 0;
      let volumeKg = 0;
      for (const workout of workouts) for (const exercise of workout.exercises) {
        if (exercise.strengthBlock) continue;
        const key = exercise.name.trim().toLocaleLowerCase();
        const current = byExercise.get(key) ?? { name: exercise.name, sets: 0, volumeKg: 0, maxWeightKg: 0, maxReps: 0 };
        for (const set of exercise.sets) {
          const setVolume = set.weight * set.reps;
          totalSets += 1; volumeKg += setVolume; current.sets += 1; current.volumeKg += setVolume;
          current.maxWeightKg = Math.max(current.maxWeightKg, set.weight); current.maxReps = Math.max(current.maxReps, set.reps);
        }
        byExercise.set(key, current);
      }
      const dates = workouts.map(workout => workout.date.slice(0, 10));
      return result({ workoutCount: workouts.length, exerciseCount: workouts.reduce((sum, workout) => sum + workout.exercises.filter(exercise => !exercise.strengthBlock).length, 0), totalSets, volumeKg, trainingDays: new Set(dates).size, firstDate: dates.at(-1) ?? null, lastDate: dates.at(0) ?? null, byExercise: [...byExercise.values()].sort((a, b) => b.volumeKg - a.volumeKg) });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('strength_list_blocks', {
    description: 'Lister les blocs Force enregistrés.',
    inputSchema: {},
  }, async () => {
    try {
      const workouts = await fetchWorkouts(client, user.id);
      return result(workouts.filter(workout => strengthBlockOf(workout)).map(workout => ({ id: workout.id, name: workout.name, date: workout.date, block: strengthBlockOf(workout) })));
    } catch (error) { return toolError(error); }
  });

  server.registerTool('strength_get_block', {
    description: 'Lire un bloc Force complet.',
    inputSchema: { workoutId: z.string().min(1) },
  }, async ({ workoutId }) => {
    try {
      const { data, error } = await client.from('workouts').select('*').eq('id', workoutId).eq('user_id', user.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Bloc Force introuvable.');
      const block = strengthBlockOf(data as Workout);
      if (!block) throw new Error('Cette séance n’est pas un bloc Force.');
      return result({ id: data.id, name: data.name, date: data.date, block });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('strength_create_block', {
    description: 'Générer un bloc Force personnalisé (1 à 24 semaines, RPE 6.5 à 10 par pas de 0.5, exercices au choix). Par défaut : 4 semaines, tractions, bench, dips et squat. Les charges ×3 et ×5 diffèrent entre semaines consécutives. Pour les exercices au poids du corps, targets désigne le lest et bodyWeight est requis.',
    inputSchema: {
      name: z.string().trim().min(1).max(100), bodyWeight: z.number().positive().optional(),
      targets: z.object({ pullup: z.number().nonnegative().optional(), bench: z.number().positive().optional(), dips: z.number().nonnegative().optional(), squat: z.number().positive().optional(), deadlift: z.number().positive().optional(), muscleup: z.number().nonnegative().optional() }),
      weekRpes: z.array(z.number().min(6.5).max(10).multipleOf(0.5)).min(1).max(24).optional(),
      exerciseIds: z.array(z.enum(['pullup', 'bench', 'dips', 'squat', 'deadlift', 'muscleup'])).min(1).max(6).optional(),
    },
  }, async ({ name, bodyWeight, targets, weekRpes, exerciseIds }) => {
    try {
      const block: StrengthBlock = createStrengthBlock(targets as Record<string, number>, bodyWeight ?? 0, { weekRpes, exerciseIds });
      const payload = { name, date: new Date().toISOString().slice(0, 10), exercises: [{ id: newId(), name: 'Bloc force', sets: [], strengthBlock: block }], user_id: user.id, created_at: new Date().toISOString() };
      const { data, error } = await client.from('workouts').insert(payload).select('*').single();
      if (error) throw new Error(error.message);
      return result(data);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('strength_update_block', {
    description: 'Enregistrer les modifications d’un bloc Force complet.',
    inputSchema: { workoutId: z.string().min(1), block: z.unknown() },
  }, async ({ workoutId, block }) => {
    try {
      const { data: current, error: readError } = await client.from('workouts').select('exercises').eq('id', workoutId).eq('user_id', user.id).maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!current) throw new Error('Bloc Force introuvable.');
      const first = (current.exercises as Exercise[])[0];
      const { data, error } = await client.from('workouts').update({ exercises: [{ ...first, strengthBlock: block }] }).eq('id', workoutId).eq('user_id', user.id).select('*').single();
      if (error) throw new Error(error.message);
      return result(data);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('strength_add_performance', {
    description: 'Ajouter une performance à une prescription d’un bloc Force.',
    inputSchema: { workoutId: z.string().min(1), prescriptionId: z.string().min(1), weight: z.number().min(0), reps: z.number().int().min(1), rpe: z.number().min(1).max(10), note: z.string().max(500).default('') },
  }, async ({ workoutId, prescriptionId, weight, reps, rpe, note }) => {
    try {
      const { data, error: readError } = await client.from('workouts').select('*').eq('id', workoutId).eq('user_id', user.id).maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!data) throw new Error('Bloc Force introuvable.');
      const workout = data as Workout;
      const block = strengthBlockOf(workout);
      if (!block) throw new Error('Cette séance n’est pas un bloc Force.');
      let found = false;
      const nextBlock: StrengthBlock = { ...block, exercises: block.exercises.map(exercise => ({ ...exercise, prescriptions: exercise.prescriptions.map(prescription => prescription.id === prescriptionId ? (found = true, { ...prescription, performances: [...prescription.performances, { weight, reps, rpe, note, date: new Date().toISOString() }] }) : prescription) })) };
      if (!found) throw new Error('Prescription introuvable.');
      const { data: saved, error } = await client.from('workouts').update({ exercises: workout.exercises.map(exercise => exercise.strengthBlock ? { ...exercise, strengthBlock: nextBlock } : exercise) }).eq('id', workoutId).eq('user_id', user.id).select('*').single();
      if (error) throw new Error(error.message);
      return result(saved);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('nutrition_get_profile', { description: 'Lire le profil Nutrition et les calories estimées.', inputSchema: {} }, async () => {
    try {
      const record = await nutritionRecord(client, user.id, NUTRITION_PROFILE_NAME);
      const profile = record?.exercises.find(exercise => exercise.nutritionProfile)?.nutritionProfile;
      return result(profile ? { profile, estimate: estimateCalories(profile) } : { profile: null });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('nutrition_save_profile', { description: 'Créer ou modifier le profil Nutrition du compte.', inputSchema: nutritionProfileSchema.shape }, async input => {
    try {
      const profile = input as NutritionProfile;
      const estimate = estimateCalories(profile);
      const existing = await nutritionRecord(client, user.id, NUTRITION_PROFILE_NAME);
      await writeNutritionRecord(client, user.id, NUTRITION_PROFILE_NAME, existing?.date ?? new Date().toISOString().slice(0, 10), [{ id: existing?.exercises[0]?.id ?? newId(), name: 'Nutrition profile', sets: [], nutritionProfile: profile }], existing);
      return result({ profile, estimate });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('nutrition_get_day', { description: 'Lire les quatre repas, calories et macronutriments d’une date.', inputSchema: { date: nutritionDateSchema } }, async ({ date }) => {
    try {
      const record = await nutritionRecord(client, user.id, NUTRITION_DAY_NAME, date);
      return result(record?.exercises.find(exercise => exercise.nutritionDay)?.nutritionDay ?? { date, entries: [] });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('nutrition_upsert_food', {
    description: 'Ajouter un aliment ou modifier un aliment existant dans un repas du journal Nutrition. Les valeurs sont pour 100 g ou 100 ml.',
    inputSchema: { date: nutritionDateSchema, meal: nutritionMealSchema, food: nutritionFoodSchema, quantity: z.number().positive().max(10000), entryId: z.string().optional() },
  }, async ({ date, meal, food, quantity, entryId }) => {
    try {
      const existing = await nutritionRecord(client, user.id, NUTRITION_DAY_NAME, date);
      const day: NutritionDay = existing?.exercises.find(exercise => exercise.nutritionDay)?.nutritionDay ?? { date, entries: [] };
      if (entryId && !day.entries.some(entry => entry.id === entryId)) throw new Error('Aliment introuvable dans cette journée.');
      const entry: FoodEntry = { id: entryId ?? newId(), meal, food, quantity, addedAt: day.entries.find(item => item.id === entryId)?.addedAt ?? new Date().toISOString() };
      const next: NutritionDay = { date, entries: [...day.entries.filter(item => item.id !== entry.id), entry] };
      await writeNutritionRecord(client, user.id, NUTRITION_DAY_NAME, date, [{ id: existing?.exercises[0]?.id ?? newId(), name: 'Nutrition day', sets: [], nutritionDay: next }], existing);
      return result(entry);
    } catch (error) { return toolError(error); }
  });

  server.registerTool('nutrition_remove_food', { description: 'Retirer un aliment d’une journée Nutrition.', inputSchema: { date: nutritionDateSchema, entryId: z.string().min(1) } }, async ({ date, entryId }) => {
    try {
      const existing = await nutritionRecord(client, user.id, NUTRITION_DAY_NAME, date);
      const day = existing?.exercises.find(exercise => exercise.nutritionDay)?.nutritionDay;
      if (!existing || !day || !day.entries.some(entry => entry.id === entryId)) throw new Error('Aliment introuvable dans cette journée.');
      const next: NutritionDay = { ...day, entries: day.entries.filter(entry => entry.id !== entryId) };
      await writeNutritionRecord(client, user.id, NUTRITION_DAY_NAME, date, [{ id: existing.exercises[0].id, name: 'Nutrition day', sets: [], nutritionDay: next }], existing);
      return result({ removed: true, entryId });
    } catch (error) { return toolError(error); }
  });

  server.registerTool('nutrition_lookup_barcode', { description: 'Chercher les valeurs d’un aliment dans Open Food Facts par code-barres.', inputSchema: { barcode: z.string().regex(/^\d{8,14}$/) } }, async ({ barcode }) => {
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,product_name_fr,brands,nutriments,quantity,product_quantity_unit`, { headers: { 'User-Agent': 'MyGymTracker/1.0 (https://mygymtracker-five.vercel.app)' }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Open Food Facts indisponible.');
      return result(normalizeOpenFoodFacts(await response.json()));
    } catch (error) { return toolError(error); }
  });

  server.registerTool('templates_list', {
    description: 'Lister les templates d’entraînement disponibles.',
    inputSchema: {},
  }, async () => result([{ name: 'Pull', description: 'Dos, arrière d’épaules, biceps' }, { name: 'Push', description: 'Pectoraux, épaules, triceps' }, { name: 'Legs', description: 'Jambes et mollets' }]));
}

async function handle(request: Request) {
  if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
  const token = getBearerToken(request);
  if (!token) return unauthorized('Ajoute Authorization: Bearer <jeton Supabase>. Utilise /api/mcp-login pour en obtenir un.');

  try {
    const { client, user } = await getUserFromToken(token);
    const server = new McpServer({ name: 'mygymtracker', version: '2.0.0' });
    registerTools(server, client, user);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return cors(await transport.handleRequest(request));
  } catch (error) {
    return unauthorized(error instanceof Error ? error.message : 'Authentification impossible.');
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
