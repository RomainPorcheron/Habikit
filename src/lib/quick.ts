import type { Entry, Habit } from '../types';
import { formatValue } from './stats';

/**
 * Le +1 rapide (tap sur la carte ou sur un jour du calendrier) n'est possible que si tout ce qui
 * est à saisir a une valeur par défaut. Sinon on ouvre la fiche.
 */
export function needsSheet(habit: Habit): boolean {
  return (
    (habit.fields.includes('duration') && habit.defaultDuration == null) ||
    (habit.fields.includes('amount') && habit.defaultAmount == null)
  );
}

/** L'entrée créée par un +1 rapide, à partir des valeurs par défaut de l'habitude. */
export function quickEntry(habit: Habit, date: string, at: Date): Omit<Entry, 'id'> {
  return {
    habitId: habit.id,
    date,
    at: at.toISOString(),
    count: habit.defaultCount ?? 1,
    duration: habit.fields.includes('duration') ? habit.defaultDuration : undefined,
    amount: habit.fields.includes('amount') ? habit.defaultAmount : undefined,
    category: habit.defaultOption,
  };
}

/** Libellé du +1 rapide : « +1 Bière », « +1 Vélo · 1h », « +1 commandes · 20 € ». */
export function quickLabel(habit: Habit): string {
  const parts = [`+${habit.defaultCount ?? 1} ${habit.defaultOption ?? habit.unit}`.trim()];
  if (habit.fields.includes('duration') && habit.defaultDuration != null) parts.push(formatValue(habit.defaultDuration, 'duration'));
  if (habit.fields.includes('amount') && habit.defaultAmount != null) parts.push(formatValue(habit.defaultAmount, 'amount'));
  return parts.join(' · ');
}
