import { useState, type FormEvent } from 'react';
import { supabase } from '../data/supabase';
import { EnvBadge } from './EnvBadge';

/**
 * Connexion par magic link : on saisit l'email, Supabase envoie un lien, le lien ouvre l'app connectée.
 * Le lien doit être ouvert sur le même appareil et le même navigateur que la demande (flux PKCE).
 */
export function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !email) return;
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL },
    });
    if (error) {
      setError(error.message);
      setState('error');
    } else {
      setState('sent');
    }
  };

  return (
    <div className="app login">
      <header className="topbar">
        <div>
          <h1>Habikit</h1>
          <EnvBadge />
        </div>
      </header>

      {state === 'sent' ? (
        <div className="login-card">
          <p className="login-title">Lien envoyé à <b>{email}</b>.</p>
          <p className="muted">Ouvre-le depuis ce téléphone, avec ce navigateur. Pense au dossier spam si rien n'arrive.</p>
          <button className="btn secondary" onClick={() => setState('idle')}>Changer d'adresse</button>
        </div>
      ) : (
        <form className="login-card" onSubmit={submit}>
          <p className="login-title">Connexion</p>
          <label className="field">
            <span>Email</span>
            <input type="email" inputMode="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="toi@exemple.fr" />
          </label>
          <button className="btn primary" type="submit" disabled={state === 'sending' || !email}>
            {state === 'sending' ? 'Envoi…' : 'Recevoir le lien de connexion'}
          </button>
          {state === 'error' && <p className="login-error">{error}</p>}
          <p className="muted small">Pas de mot de passe : un lien par email, valable une fois.</p>
        </form>
      )}
    </div>
  );
}
