import { useRef, useState } from 'react';
import type { Entry, Habit } from '../types';
import { fromKey, pad, toKey, today } from '../lib/dates';

interface Props {
  habit: Habit;
  /** Jour pré-rempli (défaut aujourd'hui). */
  date?: string;
  /** Entrée existante à modifier. */
  entry?: Entry;
  onSave(e: Omit<Entry, 'id'>): void;
  onDelete?(): void;
  onClose(): void;
}

const OTHER = '__other__';

const nowTime = () => {
  const n = new Date();
  return `${pad(n.getHours())}:${pad(n.getMinutes())}`;
};

export function LogSheet({ habit, date, entry, onSave, onDelete, onClose }: Props) {
  const [day, setDay] = useState(entry?.date ?? date ?? toKey(today()));
  const [time, setTime] = useState(entry ? `${pad(new Date(entry.at).getHours())}:${pad(new Date(entry.at).getMinutes())}` : nowTime());
  const [count, setCount] = useState(entry?.count ?? 1);
  const [duration, setDuration] = useState<string>(entry?.duration != null ? String(entry.duration) : '');
  const [amount, setAmount] = useState<string>(entry?.amount != null ? String(entry.amount) : '');
  const [note, setNote] = useState(entry?.note ?? '');
  const options = habit.options ?? [];
  const initialCategory = entry?.category ?? habit.defaultOption ?? '';
  const initialIsCustom = initialCategory !== '' && !options.includes(initialCategory);
  const [category, setCategory] = useState(initialIsCustom ? OTHER : initialCategory);
  const [customCategory, setCustomCategory] = useState(initialIsCustom ? initialCategory : '');
  const hasOptions = options.length > 0 || !!habit.allowCustomOption;

  const hasDuration = habit.fields.includes('duration');
  const hasAmount = habit.fields.includes('amount');
  const hasNote = habit.fields.includes('note');

  const submit = () => {
    const d = fromKey(day);
    const [hh, mm] = time.split(':').map(Number);
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh || 0, mm || 0).toISOString();
    onSave({
      habitId: habit.id,
      date: day,
      at,
      count: Math.max(0, count),
      duration: hasDuration && duration !== '' ? Number(duration.replace(',', '.')) : undefined,
      amount: hasAmount && amount !== '' ? Number(amount.replace(',', '.')) : undefined,
      note: hasNote && note.trim() ? note.trim() : undefined,
      category: !hasOptions ? undefined : category === OTHER ? customCategory.trim() || undefined : category || undefined,
    });
  };

  // Fermeture au tap sur le fond uniquement si l'appui a commencé sur le fond (ignore un clic fantôme après appui long).
  const downOnOverlay = useRef(false);

  return (
    <div
      className="overlay"
      onPointerDown={(e) => { downOnOverlay.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && downOnOverlay.current) onClose(); }}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="icon small-icon">{habit.icon}</span>
          <strong>{entry ? 'Modifier' : 'Ajouter'} · {habit.name}</strong>
        </div>

        <div className="row2">
          <label className="field">
            <span>Jour</span>
            <input type="date" value={day} max={toKey(today())} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="field">
            <span>Heure</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        {hasOptions && (
          <div className="field">
            <span>Type</span>
            <div className="chips">
              {options.map((o) => (
                <button key={o} className={`chip ${category === o ? 'active' : ''}`} onClick={() => setCategory(o)}>{o}</button>
              ))}
              {habit.allowCustomOption && (
                <button className={`chip ${category === OTHER ? 'active' : ''}`} onClick={() => setCategory(OTHER)}>Autre…</button>
              )}
            </div>
            {category === OTHER && (
              <input type="text" autoFocus placeholder="Précise…" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
            )}
          </div>
        )}

        <div className="field">
          <span>{habit.unit || 'Quantité'}</span>
          <div className="stepper">
            <button className="ghost" onClick={() => setCount((c) => Math.max(0, c - 1))}>−</button>
            <input type="number" min={0} value={count} onChange={(e) => setCount(Number(e.target.value))} />
            <button className="ghost" onClick={() => setCount((c) => c + 1)}>+</button>
          </div>
        </div>

        {hasDuration && (
          <div className="field">
            <span>Durée (heures)</span>
            <input type="text" inputMode="decimal" placeholder="1.5" value={duration} onChange={(e) => setDuration(e.target.value)} />
            <div className="chips">
              {[0.5, 0.75, 1, 1.5, 2].map((v) => (
                <button key={v} className={`chip ${duration === String(v) ? 'active' : ''}`} onClick={() => setDuration(String(v))}>
                  {v < 1 ? `${v * 60}min` : `${v}h`}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasAmount && (
          <label className="field">
            <span>Montant (€)</span>
            <input type="text" inputMode="decimal" placeholder="29.90" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
        )}

        {hasNote && (
          <label className="field">
            <span>Détail</span>
            <input type="text" placeholder="Course 5 km, Apéro, Amazon…" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        )}

        <div className="sheet-actions">
          {entry && onDelete && <button className="btn danger-btn" onClick={onDelete}>Supprimer</button>}
          <span style={{ flex: 1 }} />
          <button className="btn secondary" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={submit}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
