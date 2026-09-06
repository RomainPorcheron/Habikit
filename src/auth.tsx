import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './data/supabase';
import { forgetUser } from './data/supabaseRepo';
import { Login } from './components/Login';

/**
 * Session Supabase. Sans backend configuré (mode local), on est « connecté » d'office.
 * - loading : on ne sait pas encore (lecture du localStorage / de l'URL de retour du magic link).
 * - session : null = écran de connexion, sinon l'app.
 */
interface AuthState {
  loading: boolean;
  session: Session | null;
  /** Vrai quand il n'y a pas de backend : pas de login, pas de logout. */
  local: boolean;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(!!supabase);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      // Le retour du magic link laisse ?code=… ou #access_token=… dans l'URL : on nettoie.
      if (event === 'SIGNED_IN' && (location.search || location.hash)) {
        history.replaceState(null, '', location.pathname);
      }
      if (event === 'SIGNED_OUT') forgetUser();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    forgetUser();
  };

  return <Ctx.Provider value={{ loading, session, local: !supabase, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}

/** Affiche l'écran de connexion tant qu'il n'y a pas de session (uniquement avec un backend). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, local } = useAuth();
  if (local || session) return <>{children}</>;
  if (loading) return <div className="app"><p className="muted">Connexion…</p></div>;
  return <Login />;
}
