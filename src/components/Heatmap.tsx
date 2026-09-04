import { useEffect, useRef, useState } from 'react';
import type { Habit } from '../types';
import { addDays, formatShort, fromKey, startOfWeek, toKey, today } from '../lib/dates';
import { formatValue, heatLevel, scaleFor } from '../lib/stats';
import { levelColor } from '../lib/colors';

interface Props {
  habit: Habit;
  /** 'YYYY-MM-DD' -> total du jour (métrique principale). */
  totals: Map<string, number>;
  cell?: number;
  gap?: number;
  /** Nombre de semaines fixe ; sinon calculé selon la largeur disponible. */
  weeks?: number;
}

/** Grille façon GitHub : une colonne par semaine (lundi en haut), la semaine courante à droite. */
export function Heatmap({ habit, totals, cell = 12, gap = 3, weeks }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(weeks ?? 20);

  useEffect(() => {
    if (weeks || !ref.current) return;
    const el = ref.current;
    const compute = () => setFit(Math.max(4, Math.floor((el.clientWidth + gap) / (cell + gap))));
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks, cell, gap]);

  const n = weeks ?? fit;
  const t = today();
  const todayKey = toKey(t);
  const firstMonday = addDays(startOfWeek(t), -7 * (n - 1));
  const scale = scaleFor(totals);

  const columns: string[][] = [];
  for (let w = 0; w < n; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) col.push(toKey(addDays(firstMonday, w * 7 + d)));
    columns.push(col);
  }

  return (
    <div ref={ref} className="heatmap" style={{ gap }}>
      {columns.map((col, i) => (
        <div key={i} className="heatmap-col" style={{ gap }}>
          {col.map((key) => {
            const v = totals.get(key) ?? 0;
            const level = heatLevel(v, scale);
            const future = key > todayKey;
            const cls = ['cell', future ? 'future' : '', key === todayKey ? 'today' : ''].join(' ');
            return (
              <div
                key={key}
                className={cls}
                title={`${formatShort(fromKey(key))}${v ? ` · ${formatValue(v, habit.metric, habit.unit)}` : ''}`}
                style={{ width: cell, height: cell, backgroundColor: levelColor(habit.color, level) }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
