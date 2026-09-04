import type { Period } from '../types';

export const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const WEEKDAYS_FR = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
export const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Date locale -> 'YYYY-MM-DD' */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Lundi = premier jour de la semaine. */
export function startOfWeek(d: Date): Date {
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function daysBetween(a: Date, b: Date): number {
  const ms = 24 * 3600 * 1000;
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / ms);
}

/** Bornes inclusives de la période contenant `ref`. */
export function periodRange(period: Period, ref: Date): { start: Date; end: Date } {
  if (period === 'day') return { start: ref, end: ref };
  if (period === 'week') {
    const start = startOfWeek(ref);
    return { start, end: addDays(start, 6) };
  }
  return { start: startOfMonth(ref), end: endOfMonth(ref) };
}

export function periodLabel(period: Period): string {
  return period === 'day' ? "aujourd'hui" : period === 'week' ? 'cette semaine' : 'ce mois';
}

export function periodNoun(period: Period): string {
  return period === 'day' ? 'jour' : period === 'week' ? 'semaine' : 'mois';
}

/** 'lun. 4 sept.' */
export function formatShort(d: Date): string {
  return `${WEEKDAYS_FR[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_FR[d.getMonth()].slice(0, 4)}.`;
}

/** 'lundi 4 septembre 2026' */
export function formatLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Liste de clés jour entre deux dates incluses. */
export function eachDayKey(start: Date, end: Date): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(toKey(d));
  return out;
}
