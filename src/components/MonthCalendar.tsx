import { useRef } from 'react';
import type { Habit } from '../types';
import { MONTHS_FR, WEEKDAYS_SHORT, endOfMonth, startOfMonth, toKey, today } from '../lib/dates';
import { formatValue, heatLevel, scaleFor } from '../lib/stats';
import { levelColor } from '../lib/colors';

interface Props {
  habit: Habit;
  month: Date;
  totals: Map<string, number>;
  selected: string | null;
  /** Tap : sélectionner le jour (ses entrées et les boutons d'ajout s'affichent en dessous). */
  onSelect(key: string): void;
  /** Appui long sur un jour passé : raccourci +1 direct. */
  onQuickAdd(key: string): void;
  /** Astuce affichée sous la grille. */
  hint: string;
  onPrev(): void;
  onNext(): void;
  monthTotal: number;
}

export function MonthCalendar({ habit, month, totals, selected, onSelect, onQuickAdd, hint, onPrev, onNext, monthTotal }: Props) {
  // Tap = sélectionner le jour (jamais d'ajout : on doit pouvoir consulter une journée sans rien modifier).
  // Appui long sur un jour passé = raccourci +1 direct.
  const timer = useRef<number | null>(null);
  const longFired = useRef(false);
  const down = (key: string, past: boolean) => {
    longFired.current = false;
    if (!past) return;
    timer.current = window.setTimeout(() => {
      longFired.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      onQuickAdd(key);
    }, 420);
  };
  const up = (key: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!longFired.current) onSelect(key);
  };
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
  };

  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const lead = (first.getDay() + 6) % 7;
  const todayKey = toKey(today());
  const scale = scaleFor(totals);
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));

  return (
    <section className="calendar">
      <div className="calendar-head">
        <button className="ghost" onClick={onPrev} aria-label="Mois précédent">‹</button>
        <div className="calendar-title">
          <strong>{MONTHS_FR[month.getMonth()]} {month.getFullYear()}</strong>
          <span className="muted small">{formatValue(monthTotal, habit.metric, habit.metric === 'count' ? habit.unit : undefined)}</span>
        </div>
        <button className="ghost" onClick={onNext} aria-label="Mois suivant">›</button>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS_SHORT.map((w, i) => (
          <div key={i} className="calendar-dow">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`b${i}`} />;
          const key = toKey(d);
          const v = totals.get(key) ?? 0;
          const level = heatLevel(v, scale);
          const cls = ['calendar-day', key === todayKey ? 'today' : '', key === selected ? 'selected' : '', key > todayKey ? 'future' : ''].join(' ');
          return (
            <button
              key={key}
              className={cls}
              style={{ backgroundColor: levelColor(habit.color, level) }}
              onPointerDown={() => down(key, key <= todayKey)}
              onPointerUp={() => up(key)}
              onPointerLeave={cancel}
              onPointerCancel={cancel}
              onContextMenu={(e) => e.preventDefault()}
            >
              <span className="day-num">{d.getDate()}</span>
              {v > 0 && <span className="day-val">{formatValue(v, habit.metric)}</span>}
            </button>
          );
        })}
      </div>
      <div className="muted small calendar-hint">{hint}</div>
    </section>
  );
}
