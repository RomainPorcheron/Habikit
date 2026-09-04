import type { Entry, Habit } from '../types';
import { SEED_HABITS, buildSeedEntries } from './seed';

/**
 * Point d'accès aux données. Aujourd'hui : localStorage + fake data.
 * Demain : même interface, implémentation Supabase/Firebase/API.
 */
export interface Snapshot {
  habits: Habit[];
  entries: Entry[];
}

export interface Repo {
  load(): Promise<Snapshot>;
  save(snapshot: Snapshot): Promise<void>;
  reset(): Promise<Snapshot>;
}

const KEY = 'habikit:v2';

export const localRepo: Repo = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Snapshot;
        if (Array.isArray(parsed.habits) && Array.isArray(parsed.entries)) return parsed;
      }
    } catch {
      /* stockage indisponible ou corrompu : on repart du seed */
    }
    return this.reset();
  },
  async save(snapshot) {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      /* quota / navigation privée : on ignore */
    }
  },
  async reset() {
    const snap: Snapshot = { habits: SEED_HABITS, entries: buildSeedEntries() };
    await this.save(snap);
    return snap;
  },
};

export function newId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
