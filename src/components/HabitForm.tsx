import { useRef, useState } from 'react';
import type { ColorKey, FieldKey, Goal, Habit, HabitKind, Metric, Period } from '../types';
import { COLOR_KEYS, EMOJIS, PALETTE } from '../lib/colors';

interface Props {
  habit?: Habit;
  onSave(h: Omit<Habit, 'id' | 'createdAt' | 'order' | 'archived'>): void;
  onDelete?(): void;
  onClose(): void;
}

const METRIC_LABEL: Record<Metric, string> = { count: 'Nombre', duration: 'Durée', amount: 'Montant' };
const PERIOD_LABEL: Record<Period, string> = { day: 'par jour', week: 'par semaine', month: 'par mois' };

export function HabitForm({ habit, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(habit?.name ?? '');
  const [description, setDescription] = useState(habit?.description ?? '');
  const [icon, setIcon] = useState(habit?.icon ?? '✅');
  const [color, setColor] = useState<ColorKey>(habit?.color ?? 'violet');
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? 'build');
  const [unit, setUnit] = useState(habit?.unit ?? 'fois');
  const [fields, setFields] = useState<FieldKey[]>(habit?.fields ?? ['note']);
  const [metric, setMetric] = useState<Metric>(habit?.metric ?? 'count');
  const [hasGoal, setHasGoal] = useState(!!habit?.goal);
  const [goal, setGoal] = useState<Goal>(habit?.goal ?? { type: kind === 'quit' ? 'max' : 'min', value: 1, metric: 'count', period: 'day' });
  const [consequence, setConsequence] = useState(habit?.consequence ?? '');
  const [optionsText, setOptionsText] = useState((habit?.options ?? []).join(', '));
  const [defaultOption, setDefaultOption] = useState(habit?.defaultOption ?? '');
  const [allowCustomOption, setAllowCustomOption] = useState(habit?.allowCustomOption ?? false);
  const [defaultCount, setDefaultCount] = useState(habit?.defaultCount != null ? String(habit.defaultCount) : '1');
  const [defaultDuration, setDefaultDuration] = useState(habit?.defaultDuration != null ? String(habit.defaultDuration) : '');
  const [defaultAmount, setDefaultAmount] = useState(habit?.defaultAmount != null ? String(habit.defaultAmount) : '');
  // '' ou non numérique → pas de valeur par défaut.
  const num = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined; };
  const quickDirect = (!fields.includes('duration') || num(defaultDuration) != null) && (!fields.includes('amount') || num(defaultAmount) != null);
  const parsedOptions = optionsText.split(',').map((o) => o.trim()).filter(Boolean);

  const toggleField = (f: FieldKey) => {
    setFields((cur) => {
      const next = cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f];
      // Si on retire le champ qui sert de métrique, on retombe sur le nombre.
      if (f === metric && !next.includes(f)) setMetric('count');
      if (f === goal.metric && !next.includes(f)) setGoal({ ...goal, metric: 'count' });
      return next;
    });
  };
  const availableMetrics: Metric[] = ['count', ...(fields.includes('duration') ? ['duration' as const] : []), ...(fields.includes('amount') ? ['amount' as const] : [])];

  const submit = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      icon: icon || '✅',
      color,
      kind,
      unit: unit.trim() || 'fois',
      metric,
      fields,
      goal: hasGoal ? { ...goal, value: Math.max(0, Number(goal.value) || 0) } : undefined,
      consequence: consequence.trim() || undefined,
      options: parsedOptions.length ? parsedOptions : undefined,
      defaultOption: parsedOptions.includes(defaultOption) ? defaultOption : undefined,
      allowCustomOption: allowCustomOption || undefined,
      defaultCount: num(defaultCount) != null && num(defaultCount) !== 1 ? num(defaultCount) : undefined,
      defaultDuration: fields.includes('duration') ? num(defaultDuration) : undefined,
      defaultAmount: fields.includes('amount') ? num(defaultAmount) : undefined,
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
      <div className="sheet form" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <strong>{habit ? 'Modifier l’habitude' : 'Nouvelle habitude'}</strong>
        </div>

        <label className="field">
          <span>Nom</span>
          <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alcool, Sport, Lecture…" />
        </label>
        <label className="field">
          <span>Description</span>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionnel" />
        </label>

        <div className="field">
          <span>Type</span>
          <div className="segmented">
            <button className={kind === 'build' ? 'active' : ''} onClick={() => { setKind('build'); setGoal({ ...goal, type: 'min' }); }}>À faire</button>
            <button className={kind === 'quit' ? 'active' : ''} onClick={() => { setKind('quit'); setGoal({ ...goal, type: 'max' }); }}>À limiter</button>
          </div>
          <span className="muted small">{kind === 'build' ? 'La série compte les jours faits.' : 'La série compte les jours sans.'}</span>
        </div>

        <div className="field">
          <span>Icône</span>
          <div className="emoji-grid">
            {EMOJIS.map((e) => (
              <button key={e} className={`emoji ${icon === e ? 'active' : ''}`} onClick={() => setIcon(e)}>{e}</button>
            ))}
            <input type="text" className="emoji-input" value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <span>Couleur</span>
          <div className="swatches">
            {COLOR_KEYS.map((c) => (
              <button key={c} className={`swatch ${color === c ? 'active' : ''}`} style={{ background: PALETTE[c] }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>

        <label className="field">
          <span>Unité</span>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="verres, séances, commandes…" />
        </label>

        <div className="field">
          <span>À saisir à chaque fois</span>
          <div className="chips">
            <button className={`chip ${fields.includes('duration') ? 'active' : ''}`} onClick={() => toggleField('duration')}>Durée</button>
            <button className={`chip ${fields.includes('amount') ? 'active' : ''}`} onClick={() => toggleField('amount')}>Montant €</button>
            <button className={`chip ${fields.includes('note') ? 'active' : ''}`} onClick={() => toggleField('note')}>Détail texte</button>
          </div>
          <span className="muted small">
            {quickDirect
              ? 'Le bouton de la carte ajoute directement avec les valeurs par défaut. Appui long = fiche complète.'
              : 'Sans valeur par défaut pour la durée / le montant, le bouton de la carte ouvre la fiche.'}
          </span>
        </div>

        <div className="field">
          <span>Valeurs par défaut</span>
          <div className="row3">
            <label className="field">
              <span>{unit.trim() || 'Quantité'}</span>
              <input type="number" min={0} step="any" value={defaultCount} onChange={(e) => setDefaultCount(e.target.value)} />
            </label>
            {fields.includes('duration') && (
              <label className="field">
                <span>Durée (h)</span>
                <input type="text" inputMode="decimal" value={defaultDuration} onChange={(e) => setDefaultDuration(e.target.value)} placeholder="1" />
              </label>
            )}
            {fields.includes('amount') && (
              <label className="field">
                <span>Montant (€)</span>
                <input type="text" inputMode="decimal" value={defaultAmount} onChange={(e) => setDefaultAmount(e.target.value)} placeholder="20" />
              </label>
            )}
          </div>
          <span className="muted small">Pré-remplies dans la fiche et utilisées par le +1 rapide.</span>
        </div>

        <div className="field">
          <span>Choix proposés à chaque saisie</span>
          <input type="text" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Bière, Vin, Cocktail… (séparés par des virgules)" />
          {parsedOptions.length > 0 && (
            <div className="row2">
              <label className="field">
                <span>Par défaut (pour le +1 rapide)</span>
                <select value={defaultOption} onChange={(e) => setDefaultOption(e.target.value)}>
                  <option value="">Aucun</option>
                  {parsedOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="toggle-row" style={{ alignSelf: 'end', paddingBottom: 10 }}>
                <input type="checkbox" checked={allowCustomOption} onChange={(e) => setAllowCustomOption(e.target.checked)} />
                <span>Autoriser « Autre »</span>
              </label>
            </div>
          )}
        </div>

        {availableMetrics.length > 1 && (
          <div className="field">
            <span>Ce que la grille affiche</span>
            <div className="segmented">
              {availableMetrics.map((m) => (
                <button key={m} className={metric === m ? 'active' : ''} onClick={() => setMetric(m)}>{METRIC_LABEL[m]}</button>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label className="toggle-row">
            <input type="checkbox" checked={hasGoal} onChange={(e) => setHasGoal(e.target.checked)} />
            <span>{kind === 'quit' ? 'Fixer une limite' : 'Fixer un objectif'}</span>
          </label>
          {hasGoal && (
            <div className="goal-form">
              <div className="segmented">
                <button className={goal.type === 'min' ? 'active' : ''} onClick={() => setGoal({ ...goal, type: 'min' })}>Au moins</button>
                <button className={goal.type === 'max' ? 'active' : ''} onClick={() => setGoal({ ...goal, type: 'max' })}>Au plus</button>
              </div>
              <div className="row3">
                <input type="number" min={0} step="any" value={goal.value} onChange={(e) => setGoal({ ...goal, value: Number(e.target.value) })} />
                <select value={goal.metric} onChange={(e) => setGoal({ ...goal, metric: e.target.value as Metric })}>
                  {availableMetrics.map((m) => (
                    <option key={m} value={m}>{m === 'count' ? unit || 'fois' : m === 'duration' ? 'heures' : '€'}</option>
                  ))}
                </select>
                <select value={goal.period} onChange={(e) => setGoal({ ...goal, period: e.target.value as Period })}>
                  {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
                    <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
                  ))}
                </select>
              </div>
              <label className="field">
                <span>Ce qui se passe si c’est raté</span>
                <input type="text" value={consequence} onChange={(e) => setConsequence(e.target.value)} placeholder="Ex : 30 min de marche, pas de dessert…" />
              </label>
            </div>
          )}
        </div>

        <div className="sheet-actions">
          {habit && onDelete && <button className="btn danger-btn" onClick={onDelete}>Supprimer</button>}
          <span style={{ flex: 1 }} />
          <button className="btn secondary" onClick={onClose}>Annuler</button>
          <button className="btn primary" onClick={submit} disabled={!name.trim()}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}
