import type { Entry, Habit } from '../types';
import { SEED_HABITS, buildSeedEntries } from './seed';

/**
 * Point d'accès aux données. Deux implémentations, même interface :
 * - localRepo    : localStorage + fake data (mode démo, sans backend).
 * - supabaseRepo : tables habits / entries du projet Supabase (src/data/supabaseRepo.ts).
 * Le store dispatche d'abord en mémoire (mise à jour optimiste) puis appelle l'écriture unitaire.
 */
export interface Snapshot {
  habits: Habit[];
  entries: Entry[];
}

export interface Repo {
  /** Vrai en mode démo : reset() remplace tout par la fake data. */
  readonly demo: boolean;
  load(): Promise<Snapshot>;
  upsertHabit(habit: Habit): Promise<void>;
  /** Supprime l'habitude et toutes ses entrées. */
  deleteHabit(id: string): Promise<void>;
  upsertEntry(entry: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  /** Démo : fake data complète. Backend : recrée les habitudes de départ manquantes, sans entrées. */
  reset(): Promise<Snapshot>;
}

const KEY = 'habikit:v2';

let snap: Snapshot | null = null;

function persist() {
  if (!snap) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(snap));
  } catch {
    /* quota / navigation privée : on ignore */
  }
}

export const localRepo: Repo = {
  demo: true,
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Snapshot;
        if (Array.isArray(parsed.habits) && Array.isArray(parsed.entries)) {
          snap = parsed;
          return parsed;
        }
      }
    } catch {
      /* stockage indisponible ou corrompu : on repart du seed */
    }
    return this.reset();
  },
  async upsertHabit(habit) {
    if (!snap) return;
    const i = snap.habits.findIndex((h) => h.id === habit.id);
    snap = { ...snap, habits: i < 0 ? [...snap.habits, habit] : snap.habits.map((h) => (h.id === habit.id ? habit : h)) };
    persist();
  },
  async deleteHabit(id) {
    if (!snap) return;
    snap = { habits: snap.habits.filter((h) => h.id !== id), entries: snap.entries.filter((e) => e.habitId !== id) };
    persist();
  },
  async upsertEntry(entry) {
    if (!snap) return;
    const i = snap.entries.findIndex((e) => e.id === entry.id);
    snap = { ...snap, entries: i < 0 ? [...snap.entries, entry] : snap.entries.map((e) => (e.id === entry.id ? entry : e)) };
    persist();
  },
  async deleteEntry(id) {
    if (!snap) return;
    snap = { ...snap, entries: snap.entries.filter((e) => e.id !== id) };
    persist();
  },
  async reset() {
    snap = { habits: SEED_HABITS, entries: buildSeedEntries() };
    persist();
    return snap;
  },
};

/** Identifiant unique, compatible avec les colonnes uuid de Supabase. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Repli (vieux WebView) : uuid v4 approximatif.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
