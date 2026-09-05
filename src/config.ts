/**
 * Configuration d'environnement, lue au build (variables VITE_*).
 * - local : `npm run dev` sans .env, ou .env.development sans Supabase → localStorage seul.
 * - dev   : https://romainporcheron.github.io/Habikit/dev/  → projet Supabase « Habikit-dev ».
 * - prod  : https://romainporcheron.github.io/Habikit/      → projet Supabase « Habikit-prod ».
 * Voir .env.example et .github/workflows/deploy.yml.
 */
export type AppEnv = 'local' | 'dev' | 'prod';

const raw = import.meta.env.VITE_APP_ENV;
export const APP_ENV: AppEnv = raw === 'dev' || raw === 'prod' ? raw : 'local';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** Vrai quand URL + clé sont renseignées : le client Supabase peut être créé. */
export const HAS_SUPABASE = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
