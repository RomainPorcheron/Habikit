# FUNCTIONS — Habikit

## src/lib/dates.ts

| Fonction | Signature | Rôle |
|---|---|---|
| `toKey` | `(d: Date) => string` | Date locale → `YYYY-MM-DD`. Clé de jour utilisée partout. |
| `fromKey` | `(key: string) => Date` | Inverse de `toKey`, en heure locale. |
| `today` | `() => Date` | Aujourd'hui à minuit local. |
| `addDays` / `addMonths` | `(d, n) => Date` | Arithmétique de dates sans mutation. |
| `startOfWeek` | `(d) => Date` | Lundi de la semaine de `d`. |
| `periodRange` | `(period, ref) => {start, end}` | Bornes inclusives du jour / semaine / mois contenant `ref`. |
| `eachDayKey` | `(start, end) => string[]` | Toutes les clés jour entre deux dates. |
| `formatShort` / `formatLong` / `formatTime` | | Formats FR (« lun. 4 sept. », « vendredi 4 septembre 2026 », « 20:15 »). |

## src/lib/stats.ts

| Fonction | Signature | Rôle |
|---|---|---|
| `entryValue` | `(e: Entry, metric) => number` | Valeur d'une entrée pour une métrique (count / duration / amount). |
| `dailyTotals` | `(entries, metric) => Map<string, number>` | Total par jour. Base de la heatmap et du calendrier. |
| `entriesByDay` | `(entries) => Map<string, Entry[]>` | Entrées groupées par jour, triées par heure. |
| `totalInRange` | `(entries, metric, start, end) => number` | Somme sur une plage de jours. |
| `goalProgress` | `(habit, entries, ref?) => GoalProgress \| null` | Avancement de l'objectif sur la période de `ref` + statut. |
| `currentStreak` | `(habit, entries, ref?) => number` | Série en cours (jours faits pour build, jours sans pour quit). |
| `bestStreak` | `(habit, entries, ref?) => number` | Meilleure série depuis la première entrée. |
| `scaleFor` | `(totals) => number` | Valeur « pleine » pour la colorisation = max journalier observé. |
| `heatLevel` | `(value, scale) => 0..4` | Niveau de couleur d'une case. |
| `formatValue` | `(v, metric, unit?) => string` | « 3 verres », « 1h30 », « 34 € ». |
| `alertsFor` | `(habits, entries, ref?) => Alert[]` | Alertes du dashboard, triées danger > warning > info. |

Exemple :

```ts
const own = entriesOf(state.entries, habit.id);
const p = goalProgress(habit, own);        // { current: 5, target: 4, status: 'exceeded', ... }
const streak = currentStreak(habit, own);  // 3 (jours sans, pour une habitude quit)
```

## src/store.tsx

| Fonction | Rôle |
|---|---|
| `StoreProvider` | Charge le snapshot via `localRepo`, expose `state` et `actions`, persiste à chaque changement. |
| `useStore()` | Hook d'accès : `{ state: { habits, entries, loaded }, actions }`. |
| `actions.addHabit(h)` | Crée une habitude (id, createdAt, order générés). |
| `actions.updateHabit(id, patch)` / `deleteHabit(id)` | Supprimer une habitude supprime ses entrées. |
| `actions.addEntry(e)` / `updateEntry(id, patch)` / `deleteEntry(id)` | CRUD des logs. |
| `actions.reset()` | Recharge la fake data. |

## src/data/repo.ts

| Élément | Rôle |
|---|---|
| `Repo` (interface) | `load()`, `save(snapshot)`, `reset()`. Le seul point à réimplémenter pour un backend. |
| `localRepo` | Implémentation localStorage, clé `habikit:v2`, seed si vide ou corrompu. |
| `newId(prefix)` | Id court `prefix_<time><rand>`. À remplacer par des uuid côté serveur. |

## src/data/seed.ts

| Élément | Rôle |
|---|---|
| `SEED_HABITS` | Les 5 habitudes de Romain. |
| `buildSeedEntries()` | 220 jours d'entrées déterministes (PRNG mulberry32, seed 42). Force un dépassement alcool cette semaine et aucun sport aujourd'hui pour montrer les alertes. |

## Composants

| Composant | Props clés | Rôle |
|---|---|---|
| `Heatmap` | `habit, totals, cell?, gap?, weeks?` | Grille GitHub, colonnes = semaines, s'adapte à la largeur (ResizeObserver). |
| `HabitCard` | `habit, entries, onOpen, onQuickLog, onDetailedLog` | Carte du dashboard. Tap bouton = +1 (ou fiche si durée / montant à saisir), appui long (450 ms) = fiche. Pastille = nombre d'ajouts du jour, animation quand le total du jour augmente. |
| `HabitDetail` | `habit, entries, onBack, onEdit, onAddEntry, onEditEntry, onDeleteEntry` | Écran de détail. |
| `MonthCalendar` | `habit, month, totals, selected, onSelect, onPrev, onNext, monthTotal` | Calendrier mensuel coloré avec valeur par jour. |
| `LogSheet` | `habit, date?, entry?, onSave, onDelete?, onClose` | Fiche de saisie / édition d'une entrée. Chips `habit.options` + « Autre… » (texte libre) → `entry.category`. |
| `HabitForm` | `habit?, onSave, onDelete?, onClose` | Création / édition d'une habitude. Les choix se saisissent séparés par des virgules, avec un défaut et l'option « Autre ». |
| `AlertsBanner` | `alerts, onOpen` | Bandeau d'alertes cliquables. |

## src/App.tsx

| Élément | Rôle |
|---|---|
| `describeEntry(habit, entry)` | Résumé court d'une entrée pour le toast : « +1 Bière », « Vélo · 1h30 », « 34 € · Amazon ». |
| Toast | Après `quickLog` ou enregistrement d'une nouvelle entrée : confirmation en bas, bouton **Annuler** = `deleteEntry`, disparaît après 4 s. |
