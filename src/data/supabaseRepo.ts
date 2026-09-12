import type { Entry, Habit } from '../types';
import { addMonths, toKey, today } from '../lib/dates';
import { newId, type Repo } from './repo';
import { SEED_HABITS } from './seed';
import { supabase } from './supabase';

/** Lignes SQL (supabase/schema.sql). Miroir de Habit / Entry en snake_case. */
interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  kind: string;
  unit: string;
  metric: string;
  fields: string[];
  goal: Habit['goal'] | null;
  consequence: string | null;
  options: string[] | null;
  default_option: string | null;
  allow_custom_option: boolean;
  default_count: number | null;
  default_duration: number | null;
  default_amount: number | null;
  archived: boolean;
  position: number;
  created_at: string;
}

interface EntryRow {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  at: string;
  count: number;
  duration: number | null;
  amount: number | null;
  note: string | null;
  category: string | null;
}

/** La grille n'affiche pas plus loin : on ne charge que 13 mois d'entrées. */
const HISTORY_MONTHS = 13;

let userId: string | null = null;

async function requireUser(): Promise<string> {
  if (userId) return userId;
  if (!supabase) throw new Error('Supabase non configuré');
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Pas de session : reconnecte-toi');
  userId = data.user.id;
  return userId;
}

function toHabit(r: HabitRow): Habit {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    icon: r.icon,
    color: r.color as Habit['color'],
    kind: r.kind as Habit['kind'],
    unit: r.unit,
    metric: r.metric as Habit['metric'],
    fields: (r.fields ?? []) as Habit['fields'],
    goal: r.goal ?? undefined,
    consequence: r.consequence ?? undefined,
    options: r.options ?? undefined,
    defaultOption: r.default_option ?? undefined,
    allowCustomOption: r.allow_custom_option || undefined,
    defaultCount: r.default_count == null ? undefined : Number(r.default_count),
    defaultDuration: r.default_duration == null ? undefined : Number(r.default_duration),
    defaultAmount: r.default_amount == null ? undefined : Number(r.default_amount),
    archived: r.archived,
    order: r.position,
    createdAt: r.created_at,
  };
}

function fromHabit(h: Habit, uid: string): HabitRow {
  return {
    id: h.id,
    user_id: uid,
    name: h.name,
    description: h.description ?? null,
    icon: h.icon,
    color: h.color,
    kind: h.kind,
    unit: h.unit,
    metric: h.metric,
    fields: h.fields,
    goal: h.goal ?? null,
    consequence: h.consequence ?? null,
    options: h.options ?? null,
    default_option: h.defaultOption ?? null,
    allow_custom_option: h.allowCustomOption ?? false,
    default_count: h.defaultCount ?? null,
    default_duration: h.defaultDuration ?? null,
    default_amount: h.defaultAmount ?? null,
    archived: h.archived,
    position: h.order,
    created_at: h.createdAt,
  };
}

function toEntry(r: EntryRow): Entry {
  return {
    id: r.id,
    habitId: r.habit_id,
    date: r.date,
    at: r.at,
    count: Number(r.count),
    duration: r.duration == null ? undefined : Number(r.duration),
    amount: r.amount == null ? undefined : Number(r.amount),
    note: r.note ?? undefined,
    category: r.category ?? undefined,
  };
}

function fromEntry(e: Entry, uid: string): EntryRow {
  return {
    id: e.id,
    user_id: uid,
    habit_id: e.habitId,
    date: e.date,
    at: e.at,
    count: e.count,
    duration: e.duration ?? null,
    amount: e.amount ?? null,
    note: e.note ?? null,
    category: e.category ?? null,
  };
}

function fail(action: string, error: { message: string } | null): never {
  throw new Error(`${action} : ${error?.message ?? 'erreur inconnue'}`);
}

/** Habitudes de départ (Alcool, Sport, Commandes, Doliprane, Tâches) avec des ids neufs, sans entrées. */
function starterHabits(existing: Habit[]): Habit[] {
  const names = new Set(existing.map((h) => h.name.toLowerCase()));
  const now = new Date().toISOString();
  let order = existing.length;
  return SEED_HABITS.filter((h) => !names.has(h.name.toLowerCase())).map((h) => ({ ...h, id: newId(), createdAt: now, order: order++ }));
}

export const supabaseRepo: Repo = {
  demo: false,

  async load() {
    if (!supabase) throw new Error('Supabase non configuré');
    const uid = await requireUser();
    const since = toKey(addMonths(today(), -HISTORY_MONTHS));
    const [habitsRes, entriesRes] = await Promise.all([
      supabase.from('habits').select('*').order('position'),
      supabase.from('entries').select('*').gte('date', since).order('at'),
    ]);
    if (habitsRes.error) fail('Lecture des habitudes', habitsRes.error);
    if (entriesRes.error) fail('Lecture des entrées', entriesRes.error);

    let habits = (habitsRes.data as HabitRow[]).map(toHabit);
    const entries = (entriesRes.data as EntryRow[]).map(toEntry);

    // Premier login sur un compte vide : on crée les habitudes du brief, sans fausses entrées.
    if (habits.length === 0) {
      const starters = starterHabits([]);
      const { error } = await supabase.from('habits').insert(starters.map((h) => fromHabit(h, uid)));
      if (error) fail('Création des habitudes de départ', error);
      habits = starters;
    }
    return { habits, entries };
  },

  async upsertHabit(habit) {
    const uid = await requireUser();
    const { error } = await supabase!.from('habits').upsert(fromHabit(habit, uid));
    if (error) fail('Sauvegarde de l’habitude', error);
  },

  async deleteHabit(id) {
    await requireUser();
    // Les entrées partent en cascade (on delete cascade dans le schéma).
    const { error } = await supabase!.from('habits').delete().eq('id', id);
    if (error) fail('Suppression de l’habitude', error);
  },

  async upsertEntry(entry) {
    const uid = await requireUser();
    const { error } = await supabase!.from('entries').upsert(fromEntry(entry, uid));
    if (error) fail('Sauvegarde de l’entrée', error);
  },

  async deleteEntry(id) {
    await requireUser();
    const { error } = await supabase!.from('entries').delete().eq('id', id);
    if (error) fail('Suppression de l’entrée', error);
  },

  async reset() {
    const uid = await requireUser();
    const { data, error } = await supabase!.from('habits').select('*').order('position');
    if (error) fail('Lecture des habitudes', error);
    const existing = (data as HabitRow[]).map(toHabit);
    const missing = starterHabits(existing);
    if (missing.length > 0) {
      const { error: insErr } = await supabase!.from('habits').insert(missing.map((h) => fromHabit(h, uid)));
      if (insErr) fail('Création des habitudes de départ', insErr);
    }
    return this.load();
  },
};

/** À appeler à la déconnexion pour ne pas garder l'ancien user_id en mémoire. */
export function forgetUser() {
  userId = null;
}
