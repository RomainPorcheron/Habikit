import type { Alert, Entry, GoalProgress, Habit, Metric } from '../types';
import { addDays, daysBetween, eachDayKey, fromKey, periodLabel, periodRange, toKey, today } from './dates';

export function entryValue(e: Entry, metric: Metric): number {
  if (metric === 'duration') return e.duration ?? 0;
  if (metric === 'amount') return e.amount ?? 0;
  return e.count;
}

export function sumEntries(entries: Entry[], metric: Metric): number {
  return entries.reduce((acc, e) => acc + entryValue(e, metric), 0);
}

export function entriesOf(entries: Entry[], habitId: string): Entry[] {
  return entries.filter((e) => e.habitId === habitId);
}

/** Map 'YYYY-MM-DD' -> total du jour pour la métrique. */
export function dailyTotals(entries: Entry[], metric: Metric): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + entryValue(e, metric));
  return m;
}

export function entriesByDay(entries: Entry[]): Map<string, Entry[]> {
  const m = new Map<string, Entry[]>();
  for (const e of entries) {
    const list = m.get(e.date) ?? [];
    list.push(e);
    m.set(e.date, list);
  }
  for (const list of m.values()) list.sort((a, b) => a.at.localeCompare(b.at));
  return m;
}

export function totalInRange(entries: Entry[], metric: Metric, start: Date, end: Date): number {
  const s = toKey(start);
  const e = toKey(end);
  return sumEntries(entries.filter((x) => x.date >= s && x.date <= e), metric);
}

export function goalProgress(habit: Habit, entries: Entry[], ref: Date = today()): GoalProgress | null {
  const goal = habit.goal;
  if (!goal) return null;
  const { start, end } = periodRange(goal.period, ref);
  const current = totalInRange(entries, goal.metric, start, end);
  const ratio = goal.value > 0 ? current / goal.value : 0;
  const periodOver = end < today();
  let status: GoalProgress['status'];
  if (goal.type === 'max') {
    status = current > goal.value ? 'exceeded' : ratio >= 0.75 ? 'warning' : 'ok';
  } else {
    status = current >= goal.value ? 'done' : periodOver ? 'missed' : 'pending';
  }
  return { current, target: goal.value, ratio, status, period: goal.period, metric: goal.metric };
}

/**
 * Série en cours, en jours.
 * build : jours consécutifs (jusqu'à aujourd'hui ou hier) avec au moins une entrée.
 * quit  : jours consécutifs sans entrée, jusqu'à aujourd'hui.
 */
export function currentStreak(habit: Habit, entries: Entry[], ref: Date = today()): number {
  const days = new Set(entries.map((e) => e.date));
  if (habit.kind === 'quit') {
    let n = 0;
    for (let d = ref; !days.has(toKey(d)); d = addDays(d, -1)) {
      n++;
      if (n > 3650) break;
    }
    return n;
  }
  let d = days.has(toKey(ref)) ? ref : addDays(ref, -1);
  let n = 0;
  while (days.has(toKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(habit: Habit, entries: Entry[], ref: Date = today()): number {
  if (entries.length === 0) return habit.kind === 'quit' ? currentStreak(habit, entries, ref) : 0;
  const sorted = [...new Set(entries.map((e) => e.date))].sort();
  const keys = eachDayKey(fromKey(sorted[0]), ref);
  const days = new Set(sorted);
  let best = 0;
  let run = 0;
  for (const k of keys) {
    const hit = days.has(k);
    const good = habit.kind === 'quit' ? !hit : hit;
    run = good ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Valeur "pleine" pour colorer une case : le max journalier observé (ou 1). */
export function scaleFor(totals: Map<string, number>): number {
  let max = 0;
  for (const v of totals.values()) max = Math.max(max, v);
  return max > 0 ? max : 1;
}

export function heatLevel(value: number, scale: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 0) return 0;
  const l = Math.ceil((value / scale) * 4);
  return Math.min(4, Math.max(1, l)) as 1 | 2 | 3 | 4;
}

export function formatValue(v: number, metric: Metric, unit?: string): string {
  if (metric === 'amount') return `${v.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
  if (metric === 'duration') {
    const h = Math.floor(v);
    const m = Math.round((v - h) * 60);
    return m === 0 ? `${h}h` : h === 0 ? `${m}min` : `${h}h${String(m).padStart(2, '0')}`;
  }
  return unit ? `${v} ${unit}` : String(v);
}

/** Alertes à afficher en haut du dashboard. "Il se passe quelque chose" = ceci, pour l'instant. */
export function alertsFor(habits: Habit[], entries: Entry[], ref: Date = today()): Alert[] {
  const out: Alert[] = [];
  for (const h of habits) {
    if (h.archived || !h.goal) continue;
    const own = entriesOf(entries, h.id);
    const p = goalProgress(h, own, ref)!;
    const cur = formatValue(p.current, p.metric, h.unit);
    const tgt = formatValue(p.target, p.metric, h.unit);
    if (p.status === 'exceeded') {
      out.push({
        habitId: h.id,
        level: 'danger',
        title: `${h.name} : limite dépassée`,
        detail: `${cur} sur ${tgt} max ${periodLabel(p.period)}.` + (h.consequence ? ` Conséquence : ${h.consequence}` : ''),
      });
    } else if (p.status === 'warning') {
      out.push({
        habitId: h.id,
        level: 'warning',
        title: `${h.name} : presque à la limite`,
        detail: `${cur} sur ${tgt} ${periodLabel(p.period)}.`,
      });
    } else if (p.status === 'pending' && h.goal.type === 'min') {
      const { end } = periodRange(p.period, ref);
      const daysLeft = daysBetween(ref, end);
      const missing = p.target - p.current;
      const late = p.period === 'day' ? new Date().getHours() >= 18 : daysLeft < missing;
      if (late) {
        out.push({
          habitId: h.id,
          level: p.period === 'day' ? 'warning' : 'danger',
          title: `${h.name} : pas encore fait ${periodLabel(p.period)}`,
          detail:
            `${cur} sur ${tgt} min.` +
            (p.period !== 'day' ? ` ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}.` : '') +
            (h.consequence ? ` Sinon : ${h.consequence}` : ''),
        });
      }
    }
    // Objectif "min" raté hier (période jour) : on le signale.
    if (h.goal.type === 'min' && h.goal.period === 'day') {
      const y = addDays(ref, -1);
      const py = goalProgress(h, own, y)!;
      if (py.status === 'missed') {
        out.push({
          habitId: h.id,
          level: 'info',
          title: `${h.name} : raté hier`,
          detail: h.consequence ? `Conséquence : ${h.consequence}` : undefined,
        });
      }
    }
  }
  return out.sort((a, b) => rank(a.level) - rank(b.level));
}

const rank = (l: Alert['level']) => (l === 'danger' ? 0 : l === 'warning' ? 1 : 2);
