import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

/**
 * Client Supabase partagé. `null` quand l'environnement n'a pas de backend
 * (local sans .env) : l'app reste alors en localStorage.
 */
export const supabase: SupabaseClient | null = HAS_SUPABASE
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export type SupabaseStatus = 'none' | 'checking' | 'ok' | 'error';

/**
 * Vérifie que l'URL et la clé pointent bien sur un projet joignable et que le
 * schéma est en place. Sans session, la RLS renvoie 0 ligne mais un 200 : c'est
 * suffisant pour valider la config depuis le téléphone. Une table absente → 'error'.
 */
export async function pingSupabase(): Promise<{ status: SupabaseStatus; detail?: string }> {
  if (!supabase) return { status: 'none' };
  try {
    const { error } = await supabase.from('habits').select('id', { count: 'exact', head: true });
    if (error) return { status: 'error', detail: error.message };
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', detail: e instanceof Error ? e.message : String(e) };
  }
}
