import { useMemo, useState } from 'react';
import type { Entry, Habit } from '../types';
import {
  MONTHS_FR, addDays, addMonths, formatLong, formatTime, fromKey, periodNoun, periodRange, startOfWeek, toKey, today,
} from '../lib/dates';
import { bestStreak, currentStreak, dailyTotals, entriesByDay, entryValue, formatValue, goalProgress, sumEntries, totalInRange } from '../lib/stats';
import { PALETTE } from '../lib/colors';
import { Heatmap } from './Heatmap';
import { MonthCalendar } from './MonthCalendar';

interface Props {
  habit: Habit;
  entries: Entry[];
  onBack(): void;
  onEdit(): void;
  onAddEntry(date: string): void;
  onEditEntry(entry: Entry): void;
  onDeleteEntry(id: string): void;
}

export function HabitDetail({ habit, entries, onBack, onEdit, onAddEntry, onEditEntry, onDeleteEntry }: Props) {
  const t = today();
  const [month, setMonth] = useState(() => new Date(t.getFullYear(), t.getMonth(), 1));
  const [selected, setSelected] = useState<string | null>(toKey(t));

  const totals = useMemo(() => dailyTotals(entries, habit.metric), [entries, habit.metric]);
  const byDay = useMemo(() => entriesByDay(entries), [entries]);
  const color = PALETTE[habit.color];
  const unit = habit.metric === 'count' ? habit.unit : undefined;

  const week = periodRange('week', t);
  const monthRange = periodRange('month', t);
  const weekTotal = totalInRange(entries, habit.metric, week.start, week.end);
  const monthTotal = totalInRange(entries, habit.metric, monthRange.start, monthRange.end);
  const shownMonthTotal = totalInRange(entries, habit.metric, month, addDays(addMonths(month, 1), -1));
  const streak = currentStreak(habit, entries);
  const best = bestStreak(habit, entries);
  const progress = goalProgress(habit, entries);

  // 12 dernières semaines, pour voir d'un coup d'œil "combien cette semaine vs les autres".
  const weekly = useMemo(() => {
    const out: { label: string; value: number; current: boolean }[] = [];
    const thisMonday = startOfWeek(t);
    for (let i = 11; i >= 0; i--) {
      const start = addDays(thisMonday, -7 * i);
      const end = addDays(start, 6);
      out.push({ label: `${start.getDate()}/${start.getMonth() + 1}`, value: totalInRange(entries, habit.metric, start, end), current: i === 0 });
    }
    return out;
  }, [entries, habit.metric, t]);
  const weeklyMax = Math.max(1, ...weekly.map((w) => w.value));

  const selectedEntries = selected ? byDay.get(selected) ?? [] : [];

  // Répartition par type sur le mois affiché (Bière / Vin…, Vélo / Escalade…).
  const byCategory = useMemo(() => {
    if (!habit.options?.length && !habit.allowCustomOption) return [];
    const s = toKey(month);
    const e = toKey(addDays(addMonths(month, 1), -1));
    const m = new Map<string, number>();
    for (const x of entries) {
      if (x.date < s || x.date > e) continue;
      const k = x.category ?? 'Non précisé';
      m.set(k, (m.get(k) ?? 0) + entryValue(x, habit.metric));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries, habit, month]);

  return (
    <div className="detail" style={{ ['--c' as string]: color }}>
      <header className="detail-head">
        <button className="ghost" onClick={onBack} aria-label="Retour">‹</button>
        <span className="icon" style={{ background: color + '26' }}>{habit.icon}</span>
        <div className="detail-title">
          <h2>{habit.name}</h2>
          {habit.description && <span className="muted small">{habit.description}</span>}
        </div>
        <button className="ghost" onClick={onEdit} aria-label="Modifier">✎</button>
      </header>

      <section className="card">
        <Heatmap habit={habit} totals={totals} />
      </section>

      <section className="stats">
        <Stat label="Cette semaine" value={formatValue(weekTotal, habit.metric)} sub={unit} />
        <Stat label="Ce mois" value={formatValue(monthTotal, habit.metric)} sub={unit} />
        <Stat label={habit.kind === 'quit' ? 'Jours sans' : 'Série'} value={String(streak)} sub="jours" />
        <Stat label="Record" value={String(best)} sub="jours" />
      </section>

      {progress && habit.goal && (
        <section className="card goal">
          <div className="goal-row">
            <span>
              {habit.goal.type === 'max' ? 'Limite' : 'Objectif'} : {habit.goal.type === 'max' ? 'max' : 'min'}{' '}
              {formatValue(habit.goal.value, habit.goal.metric, habit.goal.metric === 'count' ? habit.unit : undefined)} / {periodNoun(habit.goal.period)}
            </span>
            <span className={`chip status-${progress.status}`}>
              {formatValue(progress.current, progress.metric, progress.metric === 'count' ? habit.unit : undefined)}
            </span>
          </div>
          <div className="bar">
            <div className={`bar-fill status-${progress.status}`} style={{ width: `${Math.min(100, progress.ratio * 100)}%` }} />
          </div>
          {habit.consequence && <div className="muted small">Si raté : {habit.consequence}</div>}
        </section>
      )}

      <section className="card">
        <div className="section-title">12 dernières semaines</div>
        <div className="bars">
          {weekly.map((w) => (
            <div key={w.label} className="bar-col" title={`Semaine du ${w.label} · ${formatValue(w.value, habit.metric, unit)}`}>
              <span className="bar-val">{w.value > 0 ? formatValue(w.value, habit.metric) : ''}</span>
              <div className={`bar-v ${w.current ? 'current' : ''}`} style={{ height: `${(w.value / weeklyMax) * 100}%` }} />
              <span className="bar-label">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      <MonthCalendar
        habit={habit}
        month={month}
        totals={totals}
        selected={selected}
        onSelect={(k) => setSelected(k === selected ? null : k)}
        onPrev={() => setMonth(addMonths(month, -1))}
        onNext={() => setMonth(addMonths(month, 1))}
        monthTotal={shownMonthTotal}
      />

      {byCategory.length > 0 && (
        <section className="card">
          <div className="section-title">Par type · {MONTHS_FR[month.getMonth()]}</div>
          <div className="chips">
            {byCategory.map(([k, v]) => (
              <span key={k} className="chip cat">
                {k} <strong>{formatValue(v, habit.metric)}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="card entries">
        <div className="section-title">
          {selected ? formatLong(fromKey(selected)) : 'Sélectionne un jour'}
          {selected && selectedEntries.length > 0 && (
            <span className="muted small"> · {formatValue(sumEntries(selectedEntries, habit.metric), habit.metric, unit)}</span>
          )}
        </div>
        {selected && selectedEntries.length === 0 && <div className="muted small">Rien ce jour-là.</div>}
        {selectedEntries.map((e) => (
          <div key={e.id} className="entry">
            <button className="entry-main" onClick={() => onEditEntry(e)}>
              <span className="entry-time">{formatTime(e.at)}</span>
              <span className="entry-body">
                <span className="entry-vals">
                  {e.category && <span>{e.category}</span>}
                  {(habit.metric === 'count' || e.count !== 1) && <span>{e.count} {habit.unit}</span>}
                  {e.duration != null && <span>{formatValue(e.duration, 'duration')}</span>}
                  {e.amount != null && <span>{formatValue(e.amount, 'amount')}</span>}
                </span>
                {e.note && <span className="muted small">{e.note}</span>}
              </span>
            </button>
            <button className="ghost danger" onClick={() => onDeleteEntry(e.id)} aria-label="Supprimer">×</button>
          </div>
        ))}
        {selected && (
          <button className="btn secondary" onClick={() => onAddEntry(selected)}>+ Ajouter une entrée</button>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
      <span className="stat-label">{label}</span>
    </div>
  );
}
