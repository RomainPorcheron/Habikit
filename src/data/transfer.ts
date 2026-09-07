import type { Entry, Habit } from '../types';
import type { Snapshot } from './repo';
import { importHabitKit, isHabitKitExport } from './importHabitKit';

/**
 * Export / import JSON. Deux formats acceptés à l'import :
 * - export Habikit (`{ app: 'habikit', habits, entries }`), tel que produit par `serializeSnapshot` ;
 * - export HabitKit (voir importHabitKit.ts).
 */

export const EXPORT_VERSION = 1;

export interface ImportResult extends Snapshot {
  source: 'habikit' | 'habitkit';
  archived: number;
  skipped: number;
}

export function serializeSnapshot(snapshot: Snapshot): string {
  return JSON.stringify(
    { app: 'habikit', version: EXPORT_VERSION, exportedAt: new Date().toISOString(), habits: snapshot.habits, entries: snapshot.entries },
    null,
    2,
  );
}

export function exportFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `habikit-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** Déclenche le téléchargement d'un fichier texte dans le navigateur. */
export function downloadText(name: string, text: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lit un fichier d'export. `firstOrder` = ordre de la première habitude importée (après les existantes). */
export function parseImport(text: string, opts: { firstOrder?: number } = {}): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas un JSON valide.');
  }
  if (isHabikitExport(data)) {
    const habits = data.habits.filter(isHabit);
    const ids = new Set(habits.map((h) => h.id));
    const entries = data.entries.filter(isEntry).filter((e) => ids.has(e.habitId));
    return { source: 'habikit', habits, entries, archived: habits.filter((h) => h.archived).length, skipped: data.entries.length - entries.length };
  }
  if (isHabitKitExport(data)) {
    return { source: 'habitkit', ...importHabitKit(data, opts) };
  }
  throw new Error('Format non reconnu : attendu un export Habikit ou HabitKit (JSON).');
}

/** Fusion : les habitudes / entrées de même id sont remplacées, les autres ajoutées. */
export function mergeSnapshots(current: Snapshot, incoming: Snapshot): Snapshot {
  const habits = new Map(current.habits.map((h) => [h.id, h]));
  for (const h of incoming.habits) habits.set(h.id, h);
  const entries = new Map(current.entries.map((e) => [e.id, e]));
  for (const e of incoming.entries) entries.set(e.id, e);
  return { habits: [...habits.values()], entries: [...entries.values()] };
}

function isHabikitExport(data: unknown): data is { habits: unknown[]; entries: unknown[] } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.app === 'habikit' && Array.isArray(d.habits) && Array.isArray(d.entries);
}

function isHabit(v: unknown): v is Habit {
  const h = v as Habit;
  return !!h && typeof h === 'object' && typeof h.id === 'string' && typeof h.name === 'string' && typeof h.order === 'number';
}

function isEntry(v: unknown): v is Entry {
  const e = v as Entry;
  return !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.habitId === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date ?? '');
}
