import type { ColorKey, Entry, Habit } from '../types';
import type { Snapshot } from './repo';

/**
 * Import d'un export JSON HabitKit (Réglages → Import / Export → Export).
 *
 * Structure observée du fichier (voir docs/IMPORT_HABITKIT.md) :
 *   habits[]      { id, name, description?, color, iconName?, archived, orderIndex }
 *   completions[] { habitId, date (ISO UTC), timezoneOffsetInMinutes, amountOfCompletions }
 *   intervals[]   { habitId, requiredNumberOfCompletionsPerDay }
 *
 * Tout est lu de façon tolérante : une clé manquante donne une valeur par défaut,
 * jamais une exception. Les ids Habikit sont dérivés des ids HabitKit (`hk_…`) :
 * ré-importer le même fichier remplace les mêmes habitudes au lieu de les dupliquer.
 */

type Json = Record<string, unknown>;

export interface HabitKitImport extends Snapshot {
  /** Habitudes archivées dans HabitKit (importées, mais masquées du dashboard). */
  archived: number;
  /** Complétions ignorées (habitude inconnue ou date illisible). */
  skipped: number;
}

export function isHabitKitExport(data: unknown): data is Json {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const d = data as Json;
  if (!Array.isArray(d.habits)) return false;
  if (Array.isArray(d.completions) || Array.isArray(d.intervals)) return true;
  return (d.habits as unknown[]).some(
    (h) => h && typeof h === 'object' && ('iconName' in (h as Json) || 'orderIndex' in (h as Json)),
  );
}

export function importHabitKit(data: Json, opts: { firstOrder?: number } = {}): HabitKitImport {
  const habitsJson = (data.habits as unknown[]).filter(isObject);
  const intervals = (Array.isArray(data.intervals) ? data.intervals : []).filter(isObject);
  const completions = (Array.isArray(data.completions) ? data.completions : []).filter(isObject);

  const perDay = new Map<string, number>();
  for (const it of intervals) {
    const id = str(it.habitId);
    const n = num(it.requiredNumberOfCompletionsPerDay);
    if (id && n != null && n > 0) perDay.set(id, Math.round(n));
  }

  const firstOrder = opts.firstOrder ?? 0;
  const ordered = habitsJson
    .map((h, i) => ({ h, order: num(h.orderIndex) ?? i, i }))
    .sort((a, b) => a.order - b.order || a.i - b.i);

  const byId = new Map<string, Habit>();
  let archived = 0;
  ordered.forEach(({ h }, idx) => {
    const hkId = str(h.id);
    if (!hkId) return;
    const isArchived = h.archived === true;
    if (isArchived) archived++;
    const target = perDay.get(hkId) ?? 1;
    const habit: Habit = {
      id: `hk_${hkId}`,
      name: (str(h.name) ?? '').trim() || 'Habitude importée',
      description: str(h.description)?.trim() || undefined,
      icon: iconFor(h.iconName),
      color: colorFor(h.color),
      kind: 'build',
      unit: 'fois',
      metric: 'count',
      fields: [],
      goal: { type: 'min', value: target, metric: 'count', period: 'day' },
      archived: isArchived,
      order: firstOrder + idx,
      createdAt: isoOr(h.createdAt) ?? new Date().toISOString(),
    };
    byId.set(hkId, habit);
  });

  const entries: Entry[] = [];
  const seen = new Map<string, number>();
  let skipped = 0;
  for (const c of completions) {
    const habit = byId.get(str(c.habitId) ?? '');
    const local = localDate(c.date, c.timezoneOffsetInMinutes);
    if (!habit || !local) {
      skipped++;
      continue;
    }
    const count = Math.max(1, Math.round(num(c.amountOfCompletions) ?? 1));
    const base = `hke_${str(c.habitId)}_${local.key}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    entries.push({
      id: n === 1 ? base : `${base}_${n}`,
      habitId: habit.id,
      date: local.key,
      at: local.at,
      count,
    });
  }

  // createdAt : au plus tôt la première complétion, sinon la grille croit l'habitude toute neuve.
  const firstAt = new Map<string, string>();
  for (const e of entries) {
    const cur = firstAt.get(e.habitId);
    if (!cur || e.at < cur) firstAt.set(e.habitId, e.at);
  }
  const habits = [...byId.values()].map((h) => {
    const first = firstAt.get(h.id);
    return first && first < h.createdAt ? { ...h, createdAt: first } : h;
  });

  return { habits, entries, archived, skipped };
}

/** Jour local de la complétion : HabitKit stocke minuit local converti en UTC + le décalage. */
function localDate(dateRaw: unknown, offsetRaw: unknown): { key: string; at: string } | null {
  if (typeof dateRaw !== 'string') return null;
  const ms = Date.parse(dateRaw);
  if (Number.isNaN(ms)) return null;
  const offset = num(offsetRaw) ?? 0;
  const shifted = new Date(ms + offset * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return { key: `${y}-${m}-${d}`, at: new Date(ms).toISOString() };
}

/** Couleurs HabitKit (noms Material ou hex) → palette Habikit, au plus proche. */
function colorFor(raw: unknown): ColorKey {
  const name = str(raw)?.toLowerCase().replace(/[\s_-]/g, '') ?? '';
  const named: Record<string, ColorKey> = {
    red: 'red', pink: 'pink', purple: 'violet', deeppurple: 'violet', indigo: 'indigo',
    blue: 'blue', lightblue: 'cyan', cyan: 'cyan', teal: 'teal', green: 'green',
    lightgreen: 'lime', lime: 'lime', yellow: 'yellow', amber: 'amber', orange: 'orange',
    deeporange: 'orange', brown: 'amber', gray: 'indigo', grey: 'indigo', bluegray: 'indigo',
    bluegrey: 'indigo', rose: 'rose', violet: 'violet',
  };
  if (named[name]) return named[name];
  const hex = parseHex(name);
  return hex ? nearestColor(hex) : 'blue';
}

function parseHex(s: string): [number, number, number] | null {
  let h = s.replace(/^#|^0x/, '');
  if (h.length === 8) h = h.slice(2); // AARRGGBB
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const PALETTE_RGB: Record<ColorKey, [number, number, number]> = {
  violet: [139, 92, 246], indigo: [99, 102, 241], blue: [59, 130, 246], cyan: [6, 182, 212],
  teal: [20, 184, 166], green: [34, 197, 94], lime: [132, 204, 22], yellow: [234, 179, 8],
  amber: [245, 158, 11], orange: [249, 115, 22], red: [239, 68, 68], rose: [244, 63, 94],
  pink: [236, 72, 153],
};

function nearestColor([r, g, b]: [number, number, number]): ColorKey {
  let best: ColorKey = 'blue';
  let bestD = Infinity;
  for (const [key, [pr, pg, pb]] of Object.entries(PALETTE_RGB) as [ColorKey, [number, number, number]][]) {
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) { bestD = d; best = key; }
  }
  return best;
}

/** Noms d'icônes HabitKit (Material / Font Awesome) → emoji. Inconnu = ✅, modifiable ensuite. */
function iconFor(raw: unknown): string {
  const name = str(raw)?.toLowerCase() ?? '';
  const rules: [RegExp, string][] = [
    [/beer|wine|glass|alcohol|drink|cocktail/, '🍺'], [/dumbbell|fitness|gym|weight/, '🏋️'],
    [/run|walk|hiking|footprints/, '🏃'], [/bike|bicycle|cycling/, '🚴'], [/yoga|meditat|spa|self/, '🧘'],
    [/book|read|library/, '📚'], [/water|drop|glass_water/, '💧'], [/smok|cigar/, '🚭'], [/coffee|cafe|mug/, '☕'],
    [/pill|medic|health|capsule/, '💊'], [/cart|shop|bag|basket/, '🛒'], [/box|package|delivery/, '📦'],
    [/bed|sleep|moon|night/, '💤'], [/broom|clean|home|house/, '🧹'], [/money|dollar|euro|coin|wallet/, '💰'],
    [/phone|mobile|screen/, '📱'], [/music|guitar|piano/, '🎸'], [/pen|edit|write|journal/, '✍️'],
    [/salad|food|apple|leaf|vegan|restaurant/, '🥗'], [/brain|psychology|study|school/, '🧠'],
    [/tooth|dental/, '🦷'], [/plant|eco|nature|flower/, '🌿'], [/target|goal|flag|bullseye/, '🎯'],
    [/fire|flame|hot/, '🔥'], [/star|favorite/, '⭐'], [/game|controller|gamepad/, '🎮'],
    [/burger|fast_food|pizza/, '🍔'], [/check|done|task/, '✅'],
  ];
  for (const [re, emoji] of rules) if (re.test(name)) return emoji;
  return '✅';
}

function isObject(v: unknown): v is Json {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function isoOr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}
