import { supabase } from './supabaseClient';

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
}

function checkClient() {
  if (!supabase) {
    return { success: false as const, error: 'Supabase non configuré' };
  }
  return { success: true as const, client: supabase };
}

// The confirmation page must be reachable from another device. When a user
// signs up from a local development server, using window.location.origin
// would put localhost in the e-mail and make the link unusable elsewhere.
const PRODUCTION_APP_URL = 'https://mygymtracker-five.vercel.app';

function getEmailRedirectUrl() {
  if (typeof window === 'undefined') return PRODUCTION_APP_URL;

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  return isLocalhost ? PRODUCTION_APP_URL : window.location.origin;
}

export async function signUp(email: string, password: string, username?: string) {
  const check = checkClient();
  if (!check.success) return check;

  try {
    const { data, error } = await check.client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getEmailRedirectUrl(),
      },
    });

    if (error) throw error;

    if (data.user && username) {
      await check.client.from('users').insert({
        id: data.user.id,
        email,
        username,
      });
    }

    return { success: true, user: data.user };
  } catch (error) {
    console.error('Erreur inscription:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
}

export async function signIn(email: string, password: string) {
  const check = checkClient();
  if (!check.success) return check;

  try {
    const { data, error } = await check.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return { success: true, user: data.user, session: data.session };
  } catch (error) {
    console.error('Erreur connexion:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Identifiants incorrects' };
  }
}

export async function signOut() {
  const check = checkClient();
  if (!check.success) return check;

  try {
    const { error } = await check.client.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erreur déconnexion:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
}

export async function getCurrentUser() {
  const check = checkClient();
  if (!check.success) return null;

  try {
    const { data, error } = await check.client.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Erreur récupération user:', error);
    return null;
  }
}

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  if (!supabase) {
    callback(null);
    return { data: { subscription: { unsubscribe() {} } } };
  }

  return supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email || '',
      });
    } else {
      callback(null);
    }
  });
}
