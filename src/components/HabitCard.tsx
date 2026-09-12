import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Entry, Habit } from '../types';
import { periodNoun, toKey, today } from '../lib/dates';
import { currentStreak, dailyTotals, formatValue, goalProgress } from '../lib/stats';
import { PALETTE } from '../lib/colors';
import { Heatmap } from './Heatmap';

interface Props {
  habit: Habit;
  entries: Entry[];
  onOpen(): void;
  onQuickLog(): void;
  onDetailedLog(): void;
}

const LONG_PRESS_MS = 450;

/**
 * Après un appui long, certains navigateurs mobiles envoient quand même un `click` au relâchement,
 * ciblé sur ce qui se trouve alors sous le doigt (la fiche qui vient de s'ouvrir, un chip, « Enregistrer »…).
 * On avale ce clic fantôme en phase de capture, avant que React ne le voie.
 */
function swallowNextClick() {
  const stop = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  document.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => document.removeEventListener('click', stop, { capture: true }), 600);
}

export function HabitCard({ habit, entries, onOpen, onQuickLog, onDetailedLog }: Props) {
  const totals = useMemo(() => dailyTotals(entries, habit.metric), [entries, habit.metric]);
  const todayKey = toKey(today());
  const todayValue = totals.get(todayKey) ?? 0;
  const todayCount = useMemo(() => entries.reduce((n, e) => (e.date === todayKey ? n + e.count : n), 0), [entries, todayKey]);
  const progress = goalProgress(habit, entries);
  const streak = currentStreak(habit, entries);
  const color = PALETTE[habit.color];

  // Retour visuel : dès que le total du jour augmente (tap +1 ou fiche enregistrée), le bouton « pop »,
  // la carte flashe dans sa couleur et la pastille « auj. » se remonte. `pulse` sert de clé pour relancer
  // l'animation à chaque ajout, même rapproché.
  const prevToday = useRef(todayValue);
  const [pulse, setPulse] = useState(0);
  const checkRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (todayValue > prevToday.current) {
      setPulse((p) => p + 1);
      checkRef.current?.animate(
        [
          { transform: 'scale(1)', boxShadow: '0 0 0 0 var(--c)' },
          { transform: 'scale(1.25)', boxShadow: '0 0 0 6px transparent', offset: 0.35 },
          { transform: 'scale(1)', boxShadow: '0 0 0 12px transparent' },
        ],
        { duration: 550, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
      cardRef.current?.animate(
        [{ backgroundColor: 'color-mix(in srgb, var(--c) 22%, var(--card))' }, { backgroundColor: 'var(--card)' }],
        { duration: 900, easing: 'ease-out' },
      );
    }
    prevToday.current = todayValue;
  }, [todayValue]);
  const justLogged = pulse > 0;

  // Bouton principal.
  // - Habitude avec durée / montant à saisir (Sport, Commandes) : un tap ouvre la fiche, point. Pas d'appui long.
  // - Sinon : tap = +1 direct, appui long = fiche détaillée.
  // L'action est déclenchée sur `click`, jamais sur `pointerup` : sur mobile, ouvrir la fiche au pointerup faisait
  // atterrir le click synthétique de la même tape sur l'overlay, qui refermait aussitôt la fiche.
  const needsSheet = habit.fields.includes('duration') || habit.fields.includes('amount');
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);
  const clearTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };
  const onDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (needsSheet || e.button !== 0) return;
    longFired.current = false;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      longFired.current = true;
      swallowNextClick();
      if (navigator.vibrate) navigator.vibrate(15);
      onDetailedLog();
    }, LONG_PRESS_MS);
  };
  const onClick = () => {
    clearTimer();
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    if (needsSheet) {
      onDetailedLog();
    } else {
      if (navigator.vibrate) navigator.vibrate(10);
      onQuickLog();
    }
  };

  const ring = progress?.status === 'exceeded' || progress?.status === 'missed' ? 'ring-danger' : progress?.status === 'warning' ? 'ring-warning' : '';
  const doneToday = habit.kind === 'build' && todayValue > 0;
  const hint = needsSheet
    ? 'Ouvrir la fiche'
    : `+1${habit.defaultOption ? ` ${habit.defaultOption}` : ''} · appui long pour préciser`;

  return (
    <article ref={cardRef} className={`card ${ring}`} style={{ ['--c' as string]: color }}>
      <div className="card-head">
        <button className="card-main" onClick={onOpen}>
          <span className="icon" style={{ background: color + '26' }}>{habit.icon}</span>
          <span className="card-title">
            <span className="name">{habit.name}</span>
            {habit.description && <span className="muted small">{habit.description}</span>}
          </span>
        </button>
        <button
          ref={checkRef}
          className={`check ${doneToday ? 'done' : ''} ${habit.kind} ${needsSheet ? 'opens-sheet' : ''}`}
          aria-label={needsSheet ? `Ajouter · ${habit.name}` : habit.kind === 'build' ? 'Marquer comme fait' : 'Ajouter +1'}
          title={hint}
          onPointerDown={onDown}
          onPointerUp={clearTimer}
          onPointerLeave={clearTimer}
          onPointerCancel={clearTimer}
          onClick={onClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          {habit.kind === 'build' ? '✓' : '+'}
          {todayCount > 0 && <span key={pulse} className={`check-badge ${justLogged ? 'pop' : ''}`} aria-hidden="true">{todayCount}</span>}
        </button>
      </div>

      <Heatmap habit={habit} totals={totals} />

      <div className="card-foot">
        {progress && (
          <span className={`chip status-${progress.status}`}>
            {progress.metric === 'count'
              ? `${progress.current} / ${progress.target} ${habit.unit}`
              : `${formatValue(progress.current, progress.metric)} / ${formatValue(progress.target, progress.metric)}`}
            {' · '}
            {periodNoun(progress.period)}
          </span>
        )}
        <span className="muted small">
          {habit.kind === 'quit' ? `${streak} j sans` : `🔥 ${streak} j`}
        </span>
        {todayValue > 0 && (
          <span key={pulse} className={`chip today-chip ${justLogged ? 'pop' : ''}`}>
            auj. {formatValue(todayValue, habit.metric, habit.metric === 'count' ? habit.unit : undefined)}
          </span>
        )}
      </div>
    </article>
  );
}
