import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const url = process.env.MYGYMTRACKER_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.MYGYMTRACKER_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return response({ error: 'Variables Supabase manquantes sur Vercel.' }, 500);

  try {
    const body = await request.json() as { email?: unknown; password?: unknown };
    if (typeof body.email !== 'string' || typeof body.password !== 'string') return response({ error: 'email et password sont requis.' }, 400);
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { data, error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
    if (error || !data.session || !data.user) return response({ error: error?.message ?? 'Connexion impossible.' }, 401);
    return response({ access_token: data.session.access_token, token_type: 'Bearer', expires_in: data.session.expires_in, expires_at: data.session.expires_at, user: { id: data.user.id, email: data.user.email } });
  } catch {
    return response({ error: 'Requête JSON invalide.' }, 400);
  }
}
