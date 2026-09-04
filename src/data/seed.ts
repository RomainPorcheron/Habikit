import type { Entry, Habit } from '../types';
import { addDays, startOfWeek, toKey, today } from '../lib/dates';

/** PRNG déterministe : la fake data est la même à chaque reset. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
let idCounter = 1;
const nextId = (p: string) => `${p}_${(idCounter++).toString(36)}`;

const NOW = new Date();
const createdAt = addDays(today(), -220).toISOString();

export const SEED_HABITS: Habit[] = [
  {
    id: 'h_alcool',
    name: 'Alcool',
    description: 'Verres bus. Max 4 par semaine.',
    icon: '🍺',
    color: 'amber',
    kind: 'quit',
    unit: 'verres',
    metric: 'count',
    fields: ['note'],
    options: ['Bière', 'Vin', 'Cocktail', 'Fort'],
    defaultOption: 'Bière',
    allowCustomOption: true,
    goal: { type: 'max', value: 4, metric: 'count', period: 'week' },
    consequence: 'Semaine suivante à zéro',
    archived: false,
    order: 0,
    createdAt,
  },
  {
    id: 'h_sport',
    name: 'Sport',
    description: 'Muscu, course, vélo…',
    icon: '🏋️',
    color: 'green',
    kind: 'build',
    unit: 'séances',
    metric: 'duration',
    fields: ['duration'],
    options: ['Vélo', 'Escalade', 'Badminton', 'Marche', 'Rando', 'Salle de sport'],
    allowCustomOption: true,
    goal: { type: 'min', value: 1, metric: 'count', period: 'day' },
    consequence: '30 min de marche le lendemain',
    archived: false,
    order: 1,
    createdAt,
  },
  {
    id: 'h_commandes',
    name: 'Commandes',
    description: 'Achats en ligne. Budget 150 € / mois.',
    icon: '📦',
    color: 'blue',
    kind: 'quit',
    unit: 'commandes',
    metric: 'amount',
    fields: ['amount', 'note'],
    goal: { type: 'max', value: 150, metric: 'amount', period: 'month' },
    consequence: 'Plus aucune commande avant le mois prochain',
    archived: false,
    order: 2,
    createdAt,
  },
  {
    id: 'h_doliprane',
    name: 'Doliprane',
    description: 'Comprimés pris.',
    icon: '💊',
    color: 'rose',
    kind: 'quit',
    unit: 'comprimés',
    metric: 'count',
    fields: [],
    goal: { type: 'max', value: 6, metric: 'count', period: 'week' },
    archived: false,
    order: 3,
    createdAt,
  },
  {
    id: 'h_taches',
    name: 'Tâches',
    description: 'Ménage, admin, courses…',
    icon: '✅',
    color: 'violet',
    kind: 'build',
    unit: 'tâches',
    metric: 'count',
    fields: ['note'],
    goal: { type: 'min', value: 10, metric: 'count', period: 'week' },
    archived: false,
    order: 4,
    createdAt,
  },
];

function at(day: Date, hour: number, minute = between(0, 59)): string {
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
  return d.toISOString();
}

function entry(habitId: string, day: Date, hour: number, extra: Partial<Entry> = {}): Entry {
  return { id: nextId('e'), habitId, date: toKey(day), at: at(day, hour), count: 1, ...extra };
}

export function buildSeedEntries(): Entry[] {
  const out: Entry[] = [];
  const t = today();
  const DAYS = 220;
  const weekStart = startOfWeek(t);

  for (let i = DAYS; i >= 0; i--) {
    const day = addDays(t, -i);
    const dow = (day.getDay() + 6) % 7; // 0 = lundi
    const isToday = i === 0;
    const thisWeek = day >= weekStart;

    // Alcool : surtout vendredi / samedi. Cette semaine on force un dépassement (5 verres) pour montrer l'alerte.
    if (!thisWeek) {
      const p = dow >= 4 ? 0.65 : 0.12;
      if (rand() < p) {
        const n = dow >= 4 ? between(1, 4) : between(1, 2);
        const notes = ['Apéro', 'Soirée', 'Resto', 'Bar avec les potes', ''];
        const drinks = ['Bière', 'Bière', 'Bière', 'Vin', 'Vin', 'Cocktail', 'Fort'];
        for (let k = 0; k < n; k++) {
          out.push(entry('h_alcool', day, between(18, 23), { category: pick(drinks), note: k === 0 ? pick(notes) || undefined : undefined }));
        }
      }
    }

    // Sport : ~60 % des jours, 0.5-2h. Pas aujourd'hui (pour montrer l'alerte "pas encore fait").
    if (!isToday && rand() < 0.6) {
      const activities = ['Vélo', 'Escalade', 'Badminton', 'Marche', 'Rando', 'Salle de sport', 'Salle de sport', 'Natation'];
      const activity = pick(activities);
      const duration = activity === 'Rando' ? pick([2.5, 3, 4]) : activity === 'Marche' ? pick([0.5, 0.75, 1]) : pick([0.75, 1, 1, 1.25, 1.5, 2]);
      out.push(entry('h_sport', day, between(7, 20), { duration, category: activity }));
    }

    // Commandes : ~12 % des jours, 8-90 €.
    if (rand() < 0.12) {
      const shops = ['Amazon', 'Uber Eats', 'Vinted', 'Zalando', 'Leroy Merlin', 'Fnac', 'Decathlon'];
      out.push(entry('h_commandes', day, between(9, 22), { amount: between(8, 90), note: pick(shops) }));
    }

    // Doliprane : ~10 % des jours, 1-2 comprimés.
    if (rand() < 0.1) {
      const n = between(1, 2);
      for (let k = 0; k < n; k++) out.push(entry('h_doliprane', day, between(8, 22)));
    }

    // Tâches : ~55 % des jours, 1-3 tâches.
    if (rand() < 0.55) {
      const tasks = ['Ménage', 'Courses', 'Paperasse', 'Lessive', 'Vaisselle', 'Admin impôts', 'Ranger le bureau', 'Poubelles'];
      const n = between(1, 3);
      for (let k = 0; k < n; k++) out.push(entry('h_taches', day, between(8, 21), { note: pick(tasks) }));
    }
  }

  // Cette semaine, alcool : 5 verres répartis (dépasse la limite de 4).
  const dowToday = (t.getDay() + 6) % 7;
  const drinkDays = dowToday >= 1 ? [addDays(weekStart, 0), addDays(weekStart, Math.min(dowToday, 1))] : [t];
  out.push(entry('h_alcool', drinkDays[0], 20, { category: 'Bière', note: 'Apéro' }));
  out.push(entry('h_alcool', drinkDays[0], 21, { category: 'Bière' }));
  out.push(entry('h_alcool', drinkDays[1], 19, { category: 'Bière', note: 'Bar avec les potes' }));
  out.push(entry('h_alcool', drinkDays[1], 20, { category: 'Cocktail' }));
  out.push(entry('h_alcool', drinkDays[1], 22, { category: 'Bière' }));

  // Aujourd'hui : une tâche et une commande, pour que le jour ne soit pas vide.
  out.push(entry('h_taches', t, Math.max(8, NOW.getHours() - 1), { note: 'Courses' }));
  out.push(entry('h_commandes', t, Math.max(9, NOW.getHours() - 2), { amount: 34, note: 'Amazon' }));

  return out.sort((a, b) => a.at.localeCompare(b.at));
}
