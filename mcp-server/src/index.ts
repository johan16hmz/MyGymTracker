import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(serverDirectory, '../..');
loadEnv({ path: path.join(projectRoot, '.env.local') });
loadEnv();

const supabaseUrl = process.env.MYGYMTRACKER_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.MYGYMTRACKER_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
let session: Session | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

type Set = {
  id: string;
  weight: number;
  reps: number;
  repsMin?: number;
  repsMax?: number;
};

type Exercise = {
  id: string;
  name: string;
  sets: Set[];
  strengthBlock?: StrengthBlock;
};

type Workout = {
  id: string;
  name: string;
  date: string;
  exercises: Exercise[];
  created_at?: string;
};

type StrengthPerformance = {
  weight: number;
  reps: number;
  rpe: number;
  note: string;
  date: string;
};

type StrengthPrescription = {
  id: string;
  week: number;
  reps: number;
  rpe: number;
  weight: number;
  performances: StrengthPerformance[];
};

type StrengthExercise = {
  id: string;
  name: string;
  target: number;
  step: number;
  weighted: boolean;
  prescriptions: StrengthPrescription[];
};

type StrengthBlock = {
  version: 1;
  exercises: StrengthExercise[];
};

const id = () => crypto.randomUUID();

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

const workoutInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  date: z.string().trim().optional(),
  exercises: z.array(exerciseSchema),
});

const json = (value: unknown) => JSON.stringify(value, null, 2);

function result(value: unknown) {
  return { content: [{ type: 'text' as const, text: json(value) }] };
}

function errorResult(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase non configuré. Définis VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local.');
  }
  return supabase;
}

async function requireAuth() {
  const client = requireSupabase();
  if (!session) throw new Error('Non connecté. Utilise d’abord l’outil auth_login.');

  if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 30) {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) {
      session = null;
      throw new Error('Session expirée. Utilise de nouveau auth_login.');
    }
    session = refreshed.data.session;
  }

  return { client, userId: session.user.id, user: session.user };
}

function normalizeWorkout(input: z.infer<typeof workoutInputSchema>): Omit<Workout, 'id'> {
  return {
    name: input.name,
    date: input.date || new Date().toISOString().slice(0, 10),
    exercises: input.exercises.map(exercise => ({
      id: exercise.id || id(),
      name: exercise.name,
      sets: exercise.sets.map(set => ({ ...set, id: set.id || id() })),
    })),
  };
}

function getStrengthBlock(workout: Workout): StrengthBlock | undefined {
  return workout.exercises.find(exercise => exercise.strengthBlock)?.strengthBlock;
}

async function fetchWorkouts() {
  const { client, userId } = await requireAuth();
  const { data, error } = await client.from('workouts').select('*').eq('user_id', userId).order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Workout[];
}

const RPE_TABLE = [
  { rpe: 10, percentages: [100,95.5,92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68] },
  { rpe: 9.5, percentages: [97.8,93.9,90.7,87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7] },
  { rpe: 9, percentages: [95.5,92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68,65.3] },
  { rpe: 8.5, percentages: [93.9,90.7,87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64] },
  { rpe: 8, percentages: [92.2,89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68,65.3,62.6] },
  { rpe: 7.5, percentages: [90.7,87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64,61.3] },
  { rpe: 7, percentages: [89.2,86.3,83.7,81.1,78.6,76.2,73.9,70.7,68,65.3,62.6,59.9] },
  { rpe: 6.5, percentages: [87.8,85,82.4,79.9,77.4,75.1,72.3,69.4,66.7,64,61.3,58.6] },
];

const strengthExercises = [
  { id: 'pullup', name: 'Tractions', target: 45, step: 1.25, weighted: true },
  { id: 'bench', name: 'Bench', target: 100, step: 2.5, weighted: false },
  { id: 'dips', name: 'Dips', target: 37.5, step: 1.25, weighted: true },
  { id: 'squat', name: 'Squat', target: 120, step: 2.5, weighted: false },
] as const;

function calculateWeight(target: number, reps: number, rpe: number, step: number) {
  const percentage = RPE_TABLE.find(row => row.rpe === rpe)?.percentages[reps - 1];
  if (!percentage || target <= 0 || step <= 0) throw new Error('Paramètres de calcul invalides.');
  return Math.round(target * percentage / 100 / step) * step;
}

function createStrengthBlock(targets: Record<string, number>): StrengthBlock {
  return {
    version: 1,
    exercises: strengthExercises.map(exercise => ({
      ...exercise,
      target: targets[exercise.id],
      prescriptions: [7, 8, 8.5, 9].flatMap((rpe, index) => [5, 3].map(reps => ({
        id: id(), week: index + 1, reps, rpe,
        weight: calculateWeight(targets[exercise.id], reps, rpe, exercise.step),
        performances: [],
      }))),
    })),
  };
}

const mcp = new McpServer({ name: 'mygymtracker', version: '1.0.0' });

mcp.registerTool('auth_login', {
  description: 'Se connecter à MyGymTracker avec le compte Supabase de l’application. Le mot de passe reste en mémoire du serveur MCP et n’est jamais renvoyé.',
  inputSchema: { email: z.string().email(), password: z.string().min(1) },
}, async ({ email, password }) => {
  try {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) throw new Error(error?.message || 'Connexion impossible.');
    session = data.session;
    return result({ connected: true, user: { id: data.user.id, email: data.user.email }, expiresAt: data.session.expires_at });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Connexion impossible.');
  }
});

mcp.registerTool('auth_status', {
  description: 'Voir l’état de connexion du serveur MCP.',
  inputSchema: {},
}, async () => {
  try {
    if (!session) return result({ connected: false });
    const { user } = await requireAuth();
    return result({ connected: true, user: { id: user.id, email: user.email }, expiresAt: session.expires_at });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Session indisponible.');
  }
});

mcp.registerTool('auth_logout', {
  description: 'Se déconnecter du compte MyGymTracker utilisé par ce serveur MCP.',
  inputSchema: {},
}, async () => {
  try {
    if (supabase) await supabase.auth.signOut();
    session = null;
    return result({ connected: false });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Déconnexion impossible.');
  }
});

mcp.registerTool('profile_get', {
  description: 'Lire le profil de l’utilisateur connecté.',
  inputSchema: {},
}, async () => {
  try {
    const { client, userId, user } = await requireAuth();
    const { data, error } = await client.from('users').select('*').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    return result({ auth: { id: user.id, email: user.email }, profile: data });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Profil indisponible.');
  }
});

mcp.registerTool('profile_update', {
  description: 'Modifier le pseudo du profil connecté.',
  inputSchema: { username: z.string().trim().min(1).max(100) },
}, async ({ username }) => {
  try {
    const { client, userId } = await requireAuth();
    const { data, error } = await client.from('users').update({ username }).eq('id', userId).select('*').single();
    if (error) throw new Error(error.message);
    return result(data);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Profil non modifié.');
  }
});

mcp.registerTool('workouts_list', {
  description: 'Lister toutes les séances du compte connecté. Les blocs Force sont inclus.',
  inputSchema: { includeStrength: z.boolean().default(true) },
}, async ({ includeStrength }) => {
  try {
    const workouts = await fetchWorkouts();
    return result(includeStrength ? workouts : workouts.filter(workout => !getStrengthBlock(workout)));
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Séances indisponibles.');
  }
});

mcp.registerTool('workout_get', {
  description: 'Lire une séance précise avec tous ses exercices et séries.',
  inputSchema: { workoutId: z.string().min(1) },
}, async ({ workoutId }) => {
  try {
    const { client, userId } = await requireAuth();
    const { data, error } = await client.from('workouts').select('*').eq('id', workoutId).eq('user_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Séance introuvable.');
    return result(data);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Séance indisponible.');
  }
});

mcp.registerTool('workout_create', {
  description: 'Créer et enregistrer une séance. Utilise des exercices avec leurs séries, poids et répétitions.',
  inputSchema: workoutInputSchema.shape,
}, async input => {
  try {
    const { client, userId } = await requireAuth();
    const workout = normalizeWorkout(input);
    const { data, error } = await client.from('workouts').insert({ ...workout, user_id: userId, created_at: new Date().toISOString() }).select('*').single();
    if (error) throw new Error(error.message);
    return result(data);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Séance non créée.');
  }
});

mcp.registerTool('workout_update', {
  description: 'Modifier le nom, la date ou le contenu complet d’une séance existante.',
  inputSchema: {
    workoutId: z.string().min(1),
    name: z.string().trim().min(1).max(150).optional(),
    date: z.string().trim().optional(),
    exercises: z.array(exerciseSchema).optional(),
  },
}, async ({ workoutId, name, date, exercises }) => {
  try {
    const { client, userId } = await requireAuth();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (date !== undefined) updates.date = date;
    if (exercises !== undefined) updates.exercises = exercises.map(exercise => ({ id: exercise.id || id(), name: exercise.name, sets: exercise.sets.map(set => ({ ...set, id: set.id || id() })) }));
    if (!Object.keys(updates).length) throw new Error('Aucune modification fournie.');
    const { data, error } = await client.from('workouts').update(updates).eq('id', workoutId).eq('user_id', userId).select('*').single();
    if (error) throw new Error(error.message);
    return result(data);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Séance non modifiée.');
  }
});

mcp.registerTool('workout_delete', {
  description: 'Supprimer une séance du compte connecté.',
  inputSchema: { workoutId: z.string().min(1) },
}, async ({ workoutId }) => {
  try {
    const { client, userId } = await requireAuth();
    const { error } = await client.from('workouts').delete().eq('id', workoutId).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return result({ deleted: true, workoutId });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Séance non supprimée.');
  }
});

mcp.registerTool('workout_stats', {
  description: 'Calculer les statistiques d’entraînement du compte : séances, exercices, séries, volume, jours et détail par exercice.',
  inputSchema: { includeStrength: z.boolean().default(false) },
}, async ({ includeStrength }) => {
  try {
    const allWorkouts = await fetchWorkouts();
    const workouts = includeStrength ? allWorkouts : allWorkouts.filter(workout => !getStrengthBlock(workout));
    const byExercise = new Map<string, { name: string; sets: number; volumeKg: number; maxWeightKg: number; maxReps: number }>();
    let totalSets = 0;
    let volumeKg = 0;
    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        if (exercise.strengthBlock) continue;
        const key = exercise.name.trim().toLocaleLowerCase();
        const current = byExercise.get(key) ?? { name: exercise.name, sets: 0, volumeKg: 0, maxWeightKg: 0, maxReps: 0 };
        for (const set of exercise.sets) {
          totalSets += 1;
          const setVolume = set.weight * set.reps;
          volumeKg += setVolume;
          current.sets += 1;
          current.volumeKg += setVolume;
          current.maxWeightKg = Math.max(current.maxWeightKg, set.weight);
          current.maxReps = Math.max(current.maxReps, set.reps);
        }
        byExercise.set(key, current);
      }
    }
    const dates = workouts.map(workout => workout.date.slice(0, 10));
    return result({
      workoutCount: workouts.length,
      exerciseCount: workouts.reduce((sum, workout) => sum + workout.exercises.filter(exercise => !exercise.strengthBlock).length, 0),
      totalSets,
      volumeKg,
      trainingDays: new Set(dates).size,
      firstDate: dates.at(-1) ?? null,
      lastDate: dates.at(0) ?? null,
      byExercise: [...byExercise.values()].sort((a, b) => b.volumeKg - a.volumeKg),
    });
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Statistiques indisponibles.');
  }
});

mcp.registerTool('strength_list_blocks', {
  description: 'Lister les blocs Force enregistrés.',
  inputSchema: {},
}, async () => {
  try {
    const workouts = await fetchWorkouts();
    return result(workouts.filter(workout => getStrengthBlock(workout)).map(workout => ({ id: workout.id, name: workout.name, date: workout.date, block: getStrengthBlock(workout) })));
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Blocs Force indisponibles.');
  }
});

mcp.registerTool('strength_create_block', {
  description: 'Générer et enregistrer un bloc Force de 4 semaines pour tractions, bench, dips et squat.',
  inputSchema: {
    name: z.string().trim().min(1).max(100),
    targets: z.object({ pullup: z.number().positive(), bench: z.number().positive(), dips: z.number().positive(), squat: z.number().positive() }),
  },
}, async ({ name, targets }) => {
  try {
    const { client, userId } = await requireAuth();
    const block = createStrengthBlock(targets);
    const payload = { name, date: new Date().toISOString().slice(0, 10), exercises: [{ id: id(), name: 'Bloc force', sets: [], strengthBlock: block }], user_id: userId, created_at: new Date().toISOString() };
    const { data, error } = await client.from('workouts').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return result(data);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Bloc Force non créé.');
  }
});

mcp.registerTool('strength_update_block', {
  description: 'Enregistrer les modifications d’un bloc Force (charges prévues ou performances). Fournis le bloc complet retourné par strength_list_blocks ou strength_get_block.',
  inputSchema: { workoutId: z.string().min(1), block: z.unknown() },
}, async ({ workoutId, block }) => {
  try {
    const { client, userId } = await requireAuth();
    const { data: workout, error: readError } = await client.from('workouts').select('exercises').eq('id', workoutId).eq('user_id', userId).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!workout) throw new Error('Bloc Force introuvable.');
    const exercises = [{ ...(workout.exercises as Exercise[])[0], strengthBlock: block }];
    const { data, error } = await client.from('workouts').update({ exercises }).eq('id', workoutId).eq('user_id', userId).select('*').single();
    if (error) throw new Error(error.message);
    return result(data);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Bloc Force non enregistré.');
  }
});

mcp.registerTool('strength_add_performance', {
  description: 'Ajouter une performance réalisée à une prescription d’un bloc Force.',
  inputSchema: {
    workoutId: z.string().min(1),
    prescriptionId: z.string().min(1),
    weight: z.number().min(0),
    reps: z.number().int().min(1),
    rpe: z.number().min(1).max(10),
    note: z.string().max(500).default(''),
  },
}, async ({ workoutId, prescriptionId, weight, reps, rpe, note }) => {
  try {
    const { client, userId } = await requireAuth();
    const { data: workout, error: readError } = await client.from('workouts').select('*').eq('id', workoutId).eq('user_id', userId).maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!workout) throw new Error('Bloc Force introuvable.');
    const current = workout as Workout;
    const block = getStrengthBlock(current);
    if (!block) throw new Error('Cette séance n’est pas un bloc Force.');
    let found = false;
    const nextBlock: StrengthBlock = { ...block, exercises: block.exercises.map(exercise => ({ ...exercise, prescriptions: exercise.prescriptions.map(prescription => {
      if (prescription.id !== prescriptionId) return prescription;
      found = true;
      return { ...prescription, performances: [...prescription.performances, { weight, reps, rpe, note, date: new Date().toISOString() }] };
    }) })) };
    if (!found) throw new Error('Prescription introuvable.');
    const exercises = current.exercises.map(exercise => exercise.strengthBlock ? { ...exercise, strengthBlock: nextBlock } : exercise);
    const { data, error } = await client.from('workouts').update({ exercises }).eq('id', workoutId).eq('user_id', userId).select('*').single();
    if (error) throw new Error(error.message);
    return result(data);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : 'Performance non enregistrée.');
  }
});

mcp.registerTool('templates_list', {
  description: 'Lister les templates d’entraînement disponibles dans l’application.',
  inputSchema: {},
}, async () => result([
  { name: 'Pull', description: 'Dos, arrière d’épaules, biceps' },
  { name: 'Push', description: 'Pectoraux, épaules, triceps' },
  { name: 'Legs', description: 'Jambes et mollets' },
]));

mcp.registerTool('exercise_suggestions', {
  description: 'Lister les exercices connus par l’interface MyGymTracker pour aider à composer une séance.',
  inputSchema: {},
}, async () => result([
  'Tractions lestées', 'Tirage vertical prise grand rond', 'Iso-lateral high row', 'Pullover poulie',
  'Tirage horizontal machine unilatérale (row)', 'Tirage horizontal machine (low row)', 'Tirage horizontal poulie',
  'Trapèze horizontal (low row)', 'Shrugs machine', 'Curl pupitre', 'Bayesian curl', 'Reverse fly', 'Upper back',
  'Vertical traction (pull down)', 'Front lat pulldown', 'T-bar row', 'Curl marteau haltères', 'Curl marteau uni poulie',
  'Développé couché machine', 'Pec fly', 'Chest presse', 'Développé incliné machine hammer strength', 'Smith machine incliné',
  'Dips corps en avant', 'Développé militaire', 'Développé militaire machine', 'Machine élévation latérale',
  'Élévation latérale poulie', 'Élévation frontale poulie', 'Tirage triceps poulie basse corde', 'Tirage triceps poulie haute corde',
  'Tirage triceps poulie basse triangle', 'Tirage triceps poulie haute triangle', 'Développé incliné machine',
  'Wide chest press bas des pecs', 'Barre au front', 'Hack squat', 'Hammer V squat', 'Deadlift machine', 'Presse incline',
  'Presse ultra incliné', 'Squat belt', 'Fentes bulgares machine', 'Machine leg extension', 'Leg curl allongé',
  'Leg curl assis', 'Leg curl debout', 'Mollet machine assis', 'Mollet presse ultra incliné', 'Mollet presse horizontal',
]));

const transport = new StdioServerTransport();
await mcp.connect(transport);
