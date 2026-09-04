/** Modèle de données Habikit. Volontairement plat : facile à mapper sur des tables SQL. */

export type Period = 'day' | 'week' | 'month';

/** build = habitude à construire (sport, tâches). quit = comportement à limiter (alcool, commandes). */
export type HabitKind = 'build' | 'quit';

/** Ce qu'on additionne pour la heatmap, les stats et l'objectif. */
export type Metric = 'count' | 'duration' | 'amount';

/** Champs optionnels saisis à chaque log. `count` est toujours présent. */
export type FieldKey = 'duration' | 'amount' | 'note';

export interface Goal {
  /** min = il faut atteindre au moins `value` ; max = ne pas dépasser `value`. */
  type: 'min' | 'max';
  value: number;
  metric: Metric;
  period: Period;
}

export interface Habit {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: ColorKey;
  kind: HabitKind;
  /** Libellé de l'unité affichée ("verres", "h", "€", "fois"). */
  unit: string;
  metric: Metric;
  fields: FieldKey[];
  goal?: Goal;
  /** Ce qui "se passe" quand l'objectif est raté / la limite dépassée. Texte libre pour l'instant. */
  consequence?: string;
  /** Choix proposés à chaque saisie (type de boisson, activité sportive…). */
  options?: string[];
  /** Choix pré-sélectionné, utilisé aussi par le +1 rapide. */
  defaultOption?: string;
  /** Autoriser « Autre » avec texte libre. */
  allowCustomOption?: boolean;
  archived: boolean;
  order: number;
  createdAt: string;
}

export interface Entry {
  id: string;
  habitId: string;
  /** Jour local, YYYY-MM-DD. Plusieurs entrées par jour sont possibles. */
  date: string;
  /** Horodatage ISO de la saisie. */
  at: string;
  /** Nombre (verres, comprimés, commandes, séances…). Défaut 1. */
  count: number;
  /** Durée en heures décimales. */
  duration?: number;
  /** Montant en euros. */
  amount?: number;
  note?: string;
  /** Choix retenu parmi `habit.options` (ou texte libre si « Autre »). */
  category?: string;
}

export type ColorKey =
  | 'violet' | 'indigo' | 'blue' | 'cyan' | 'teal' | 'green' | 'lime'
  | 'yellow' | 'amber' | 'orange' | 'red' | 'rose' | 'pink';

export type GoalStatus = 'ok' | 'warning' | 'exceeded' | 'pending' | 'done' | 'missed';

export interface GoalProgress {
  current: number;
  target: number;
  ratio: number;
  status: GoalStatus;
  period: Period;
  metric: Metric;
}

export interface Alert {
  habitId: string;
  level: 'danger' | 'warning' | 'info';
  title: string;
  detail?: string;
}
