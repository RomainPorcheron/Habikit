# ARCHITECTURE — Habikit

## Vue d'ensemble

Application React monopage, sans routeur : l'écran courant est un état local dans `App.tsx` (`dashboard` | `detail`). Les fiches (saisie, formulaire) sont des overlays au-dessus de l'écran courant.

```
main.tsx
 └─ StoreProvider (store.tsx)          état global + persistance
     └─ App.tsx                        navigation, overlays
         ├─ AlertsBanner               alertes calculées (lib/stats.alertsFor)
         ├─ HabitCard × N              carte = Heatmap + bouton + chip
         ├─ HabitDetail                stats, histogramme, MonthCalendar, entrées
         ├─ LogSheet                   ajout / édition d'une entrée
         └─ HabitForm                  création / édition d'une habitude
```

## Modèle de données

Deux entités seulement, plates, pensées pour devenir deux tables SQL.

- **Habit** : configuration (nom, icône, couleur, type build/quit, unité, métrique affichée, champs à saisir, objectif, conséquence).
- **Entry** : un log. `date` (jour local) + `at` (horodatage) + `count` (défaut 1) + `duration` / `amount` / `note` optionnels.

Plusieurs `Entry` par jour et par habitude : c'est ce qui permet le compteur et les détails. Tous les agrégats (total du jour, de la semaine, série…) sont **dérivés** à l'affichage, jamais stockés.

### Choix : métrique par habitude
Une habitude déclare une `metric` (`count` | `duration` | `amount`) : c'est ce que la grille colore et ce que les stats additionnent. L'objectif a sa propre métrique (Sport : grille en heures, objectif « 1 séance / jour » en count).

### Choix : options par habitude
Une habitude peut déclarer `options` (liste de choix), `defaultOption` et `allowCustomOption`. L'entrée stocke le choix retenu dans `category`. C'est un seul mécanisme pour deux besoins : le type de boisson (Bière par défaut, donc le +1 rapide log une bière) et l'activité sportive (liste + « Autre » en texte libre). Le détail agrège par `category` sur le mois affiché.

### Choix : build vs quit
`kind` change uniquement la sémantique de la série (jours faits vs jours sans) et le style du bouton. La grille colore toujours les jours où il y a eu quelque chose : pour l'alcool, une case pleine = un jour où on a bu, ce que Romain veut voir d'un regard.

## Flux de données

1. `StoreProvider` charge un `Snapshot` via `Repo.load()` (localStorage, seed si vide).
2. Les composants lisent `state` et appellent `actions.*` (reducer synchrone).
3. Chaque changement d'état est sauvé via `Repo.save()` (effet).

Brancher un backend = fournir une autre implémentation de `Repo` (voir ci-dessous). Les composants ne changent pas.

## Calculs (lib/stats.ts)

- `dailyTotals` : Map jour → total pour une métrique. Base de la grille et du calendrier.
- `goalProgress` : total de la période courante vs objectif → statut `ok | warning | exceeded | pending | done | missed`.
- `currentStreak` / `bestStreak` : séries en jours, sémantique selon `kind`.
- `heatLevel` : 0..4 selon `value / scale`, où `scale` = max journalier observé (auto-adaptatif, pas de réglage).
- `alertsFor` : produit les alertes du dashboard. C'est ici que « il se passe quelque chose » est décidé ; une future notification push partira du même calcul, côté serveur.

## Semaine = lundi

Toutes les périodes hebdomadaires commencent le lundi (`lib/dates.startOfWeek`). Les clés de jour sont en heure locale (`YYYY-MM-DD`) pour éviter les décalages UTC à minuit.

## Backend (proposé)

Supabase, deux projets (dev et prod, voir PLAN.md), deux tables (`habits`, `entries`) + RLS `user_id = auth.uid()`. Schéma dans `supabase/schema.sql`.

Implémentation prévue : `src/data/supabaseRepo.ts`
- `load()` : select habits + entries des 13 derniers mois (la grille n'affiche pas plus), reste à la demande.
- Écritures unitaires (`upsert` par entrée) plutôt que `save(snapshot)` complet : le store passera à des actions asynchrones avec mise à jour optimiste.
- Offline : file d'attente des écritures en localStorage, rejouée à la reconnexion (phase 2).

Notifications : **abandonnées** (décision du 2026-09-04). Les alertes restent calculées côté client à l'affichage. La table `push_subscriptions` du schéma est facultative et peut être ignorée.

## PWA

`vite-plugin-pwa` en mode `generateSW`, `registerType: 'autoUpdate'` : le service worker précache le build et se met à jour tout seul au prochain chargement. Manifest et icônes (`public/icon-*.png`, `favicon.svg`) sont générés par un script Python ponctuel, pas de dépendance à l'exécution. Le service worker n'est pas actif en `npm run dev` (`devOptions.enabled: false`) ; le tester avec `npm run build && npm run preview`.
