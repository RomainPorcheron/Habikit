import { useState, type FormEvent } from 'react';
import { supabase } from '../data/supabase';
import { useAuth } from '../auth';
import { EnvBadge } from './EnvBadge';

/**
 * Connexion email + mot de passe. Pas d'inscription depuis l'app : le compte est créé dans le
 * dashboard Supabase (Authentication → Users → Add user) et les inscriptions y sont désactivées.
 * « Mot de passe oublié » envoie un lien qui ramène ici avec l'événement PASSWORD_RECOVERY → SetPassword.
 */
export function Login() {
  const [mode, setMode] = useState<'login' | 'forgot' | 'forgot-sent'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const redirectTo = location.origin + import.meta.env.BASE_URL;

  const login = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : error.message);
    // Succès : onAuthStateChange bascule sur l'app.
  };

  const forgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);
    if (error) setError(error.message);
    else setMode('forgot-sent');
  };

  return (
    <div className="app login">
      <header className="topbar">
        <div>
          <h1>Habikit</h1>
          <EnvBadge />
        </div>
      </header>

      {mode === 'login' && (
        <form className="login-card" onSubmit={login}>
          <p className="login-title">Connexion</p>
          <label className="field">
            <span>Email</span>
            <input type="email" inputMode="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Mot de passe</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn primary" type="submit" disabled={busy || !email || !password}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          {error && <p className="login-error">{error}</p>}
          <button type="button" className="link" onClick={() => { setMode('forgot'); setError(''); }}>Mot de passe oublié ?</button>
        </form>
      )}

      {mode === 'forgot' && (
        <form className="login-card" onSubmit={forgot}>
          <p className="login-title">Nouveau mot de passe</p>
          <p className="muted small">Un lien va être envoyé par email. Ouvre-le dans le navigateur où tu veux utiliser l'app, puis choisis un nouveau mot de passe.</p>
          <label className="field">
            <span>Email</span>
            <input type="email" inputMode="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary" type="submit" disabled={busy || !email}>{busy ? 'Envoi…' : 'Envoyer le lien'}</button>
          {error && <p className="login-error">{error}</p>}
          <button type="button" className="link" onClick={() => { setMode('login'); setError(''); }}>Retour</button>
        </form>
      )}

      {mode === 'forgot-sent' && (
        <div className="login-card">
          <p className="login-title">Lien envoyé à <b>{email}</b>.</p>
          <p className="muted">Valable une heure, une seule fois. Pense au dossier spam.</p>
          <button className="btn secondary" onClick={() => setMode('login')}>Retour à la connexion</button>
        </div>
      )}
    </div>
  );
}

/** Après le lien « mot de passe oublié » : on est déjà en session, on choisit le nouveau mot de passe. */
export function SetPassword() {
  const { finishRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else finishRecovery();
  };

  return (
    <div className="app login">
      <header className="topbar">
        <div>
          <h1>Habikit</h1>
          <EnvBadge />
        </div>
      </header>
      <form className="login-card" onSubmit={submit}>
        <p className="login-title">Choisis un nouveau mot de passe</p>
        <label className="field">
          <span>Nouveau mot de passe</span>
          <input type="password" autoComplete="new-password" minLength={8} autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          <span>Confirmer</span>
          <input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button className="btn primary" type="submit" disabled={busy || password.length < 8 || !confirm}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        {error && <p className="login-error">{error}</p>}
        <p className="muted small">8 caractères minimum.</p>
        <button type="button" className="link" onClick={() => void signOut()}>Annuler et se déconnecter</button>
      </form>
    </div>
  );
}
