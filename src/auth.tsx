import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './data/supabase';
import { forgetUser } from './data/supabaseRepo';
import { Login, SetPassword } from './components/Login';

/**
 * Session Supabase (email + mot de passe). Sans backend configuré (mode local), on est « connecté » d'office.
 * - loading    : lecture du localStorage / de l'URL de retour (lien « mot de passe oublié »).
 * - session    : null = écran de connexion, sinon l'app.
 * - recovering : on arrive par le lien de réinitialisation → écran « nouveau mot de passe » avant l'app.
 */
interface AuthState {
  loading: boolean;
  session: Session | null;
  recovering: boolean;
  /** Vrai quand il n'y a pas de backend : pas de login, pas de logout. */
  local: boolean;
  signOut(): Promise<void>;
  finishRecovery(): void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(!!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      // Le retour d'un lien laisse #access_token=… dans l'URL : on nettoie.
      if ((event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') && (location.search || location.hash)) {
        history.replaceState(null, '', location.pathname);
      }
      if (event === 'SIGNED_OUT') {
        forgetUser();
        setRecovering(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    forgetUser();
  };

  const value: AuthState = { loading, session, recovering, local: !supabase, signOut, finishRecovery: () => setRecovering(false) };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}

/** Affiche l'écran de connexion tant qu'il n'y a pas de session (uniquement avec un backend). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, session, recovering, local } = useAuth();
  if (local) return <>{children}</>;
  if (loading) return <div className="app"><p className="muted">Connexion…</p></div>;
  if (session && recovering) return <SetPassword />;
  if (session) return <>{children}</>;
  return <Login />;
}
