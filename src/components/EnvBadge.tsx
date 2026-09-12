import { useEffect, useState } from 'react';
import { APP_ENV } from '../config';
import { pingSupabase, type SupabaseStatus } from '../data/supabase';

/**
 * Pastille d'environnement dans l'en-tête : « dev » / « local » + état du backend.
 * Masquée en prod quand tout va bien, pour ne pas polluer l'écran de tous les jours.
 * Tap = relance la vérification et affiche le détail de l'erreur éventuelle.
 */
export function EnvBadge() {
  const [status, setStatus] = useState<SupabaseStatus>('checking');
  const [detail, setDetail] = useState<string | undefined>();
  const [showDetail, setShowDetail] = useState(false);

  const check = () => {
    setStatus('checking');
    void pingSupabase().then((r) => {
      setStatus(r.status);
      setDetail(r.detail);
    });
  };

  useEffect(check, []);

  if (APP_ENV === 'prod' && (status === 'ok' || status === 'checking')) return null;

  const label: Record<SupabaseStatus, string> = {
    none: 'sans backend',
    checking: 'connexion…',
    ok: 'Supabase OK',
    error: 'Supabase KO',
  };

  return (
    <>
      <button
        type="button"
        className={`env-badge env-${APP_ENV} status-${status}`}
        onClick={() => { setShowDetail((v) => !v); check(); }}
        title="Environnement · tap pour revérifier"
      >
        <b>{APP_ENV}</b> · {label[status]}
      </button>
      {showDetail && detail && <div className="env-detail">{detail}</div>}
    </>
  );
}
