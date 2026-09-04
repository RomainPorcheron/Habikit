import { useMemo, useRef } from 'react';
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

export function HabitCard({ habit, entries, onOpen, onQuickLog, onDetailedLog }: Props) {
  const totals = useMemo(() => dailyTotals(entries, habit.metric), [entries, habit.metric]);
  const todayKey = toKey(today());
  const todayValue = totals.get(todayKey) ?? 0;
  const progress = goalProgress(habit, entries);
  const streak = currentStreak(habit, entries);
  const color = PALETTE[habit.color];

  // Le bouton principal : +1 direct si rien d'autre à saisir, sinon fiche détaillée. Appui long = toujours la fiche.
  const needsSheet = habit.fields.includes('duration') || habit.fields.includes('amount');
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);
  const onDown = () => {
    longFired.current = false;
    timer.current = window.setTimeout(() => {
      longFired.current = true;
      onDetailedLog();
    }, 420);
  };
  const onUp = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!longFired.current) (needsSheet ? onDetailedLog : onQuickLog)();
  };
  const onCancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
  };

  const ring = progress?.status === 'exceeded' || progress?.status === 'missed' ? 'ring-danger' : progress?.status === 'warning' ? 'ring-warning' : '';
  const doneToday = habit.kind === 'build' && todayValue > 0;

  return (
    <article className={`card ${ring}`} style={{ ['--c' as string]: color }}>
      <div className="card-head">
        <button className="card-main" onClick={onOpen}>
          <span className="icon" style={{ background: color + '26' }}>{habit.icon}</span>
          <span className="card-title">
            <span className="name">{habit.name}</span>
            {habit.description && <span className="muted small">{habit.description}</span>}
          </span>
        </button>
        <button
          className={`check ${doneToday ? 'done' : ''} ${habit.kind}`}
          aria-label={habit.kind === 'build' ? 'Marquer comme fait' : 'Ajouter +1'}
          title={needsSheet ? 'Ouvrir la fiche' : `+1${habit.defaultOption ? ` ${habit.defaultOption}` : ''} · appui long pour préciser`}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerLeave={onCancel}
          onPointerCancel={onCancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {habit.kind === 'build' ? '✓' : '+'}
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
          <span className="muted small">
            auj. {formatValue(todayValue, habit.metric, habit.metric === 'count' ? habit.unit : undefined)}
          </span>
        )}
      </div>
    </article>
  );
}
