# ARCHITECTURE — Habikit

## Vue d'ensemble

Application React monopage, sans routeur : l'écran courant est un état local dans `App.tsx` (`dashboard` | `detail`). Les fiches (saisie, formulaire) sont des overlays au-dessus de l'écran courant.

```
main.tsx
 └─ AuthProvider (auth.tsx)            session Supabase (ou « local » sans backend)
     └─ AuthGate                       écran Login tant qu'il n'y a pas de session
         └─ StoreProvider (store.tsx)  état global + écritures via Repo
             └─ App.tsx                navigation, overlays
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

Une habitude peut aussi porter des valeurs par défaut (`defaultCount`, `defaultDuration`, `defaultAmount`). Elles pré-remplissent la fiche et alimentent le +1 rapide : tant qu'une durée ou un montant à saisir n'a pas de valeur par défaut, le tap ouvre la fiche (`needsSheet` dans `src/lib/quick.ts`) ; sinon il ajoute directement (Sport · Vélo · 1h).

### Choix : build vs quit
`kind` change uniquement la sémantique de la série (jours faits vs jours sans) et le style du bouton. La grille colore toujours les jours où il y a eu quelque chose : pour l'alcool, une case pleine = un jour où on a bu, ce que Romain veut voir d'un regard.

## Flux de données

1. `AuthProvider` lit la session Supabase (localStorage, ou retour du lien « mot de passe oublié » dans l'URL). Sans backend configuré, on est « local » et connecté d'office.
2. `StoreProvider` charge un `Snapshot` via `repo.load()` : `supabaseRepo` si le client existe, sinon `localRepo` (localStorage, seed si vide).
3. Les composants lisent `state` et appellent `actions.*`. Chaque action **dispatche d'abord** dans le reducer (mise à jour optimiste, l'UI ne bloque jamais) **puis** appelle l'écriture unitaire correspondante (`upsertHabit`, `upsertEntry`, `deleteEntry`…).
4. Une écriture qui échoue remonte dans `syncError` : bandeau rouge « Sauvegarde échouée » avec un bouton Recharger (`actions.reload()` rejoue `repo.load()`).

Les composants ne savent pas quel backend tourne. `useStore().demo` sert juste à adapter le libellé du bouton ↺.

## Identifiants

`newId()` génère des uuid v4 côté client (`crypto.randomUUID`). Le même id sert de clé en localStorage et de clé primaire dans Postgres : pas de remapping, une entrée créée hors ligne pourra être rejouée telle quelle (phase 2).

## Calculs (lib/stats.ts)

- `dailyTotals` : Map jour → total pour une métrique. Base de la grille et du calendrier.
- `goalProgress` : total de la période courante vs objectif → statut `ok | warning | exceeded | pending | done | missed`.
- `currentStreak` / `bestStreak` : séries en jours, sémantique selon `kind`.
- `heatLevel` : 0..4 selon `value / scale`, où `scale` = max journalier observé (auto-adaptatif, pas de réglage).
- `alertsFor` : produit les alertes du dashboard. C'est ici que « il se passe quelque chose » est décidé ; une future notification push partira du même calcul, côté serveur.

## Semaine = lundi

Toutes les périodes hebdomadaires commencent le lundi (`lib/dates.startOfWeek`). Les clés de jour sont en heure locale (`YYYY-MM-DD`) pour éviter les décalages UTC à minuit.

## Environnements et configuration

`src/config.ts` lit les variables `VITE_*` au build et expose `APP_ENV` (`local` | `dev` | `prod`), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `HAS_SUPABASE`. `src/data/supabase.ts` crée le client partagé (`null` sans config) et `pingSupabase()` vérifie URL + clé + schéma. `EnvBadge` affiche le résultat dans l'en-tête.

Un seul site GitHub Pages héberge les deux environnements : prod à `/Habikit/` (branche `main`), dev à `/Habikit/dev/` (branche `dev`). Chacun a sa base, son manifeste (« Habikit DEV ») et son service worker ; celui de prod exclut `/Habikit/dev/` de son fallback de navigation pour ne pas capter l'autre app. Détail dans COMMANDS.md.

## Backend (Supabase)

Deux projets (`Habikit-dev`, `Habikit-prod` à créer), deux tables (`habits`, `entries`) + RLS `user_id = auth.uid()`. Schéma dans `supabase/schema.sql`. Client : `src/data/supabase.ts`.

`src/data/supabaseRepo.ts` :
- `load()` : toutes les habitudes (triées par `position`) + entrées des 13 derniers mois (la grille n'affiche pas plus). Compte vide → insère les cinq habitudes du brief (Alcool, Sport, Commandes, Doliprane, Tâches) avec des ids neufs, **sans** entrées.
- Écritures unitaires : `upsert` par ligne (habitude ou entrée), `delete` par id. Supprimer une habitude supprime ses entrées par cascade SQL.
- `reset()` : recrée seulement les habitudes de départ manquantes (comparaison par nom), jamais de fake data en base.
- Mapping camelCase ↔ snake_case dans le même fichier (`toHabit` / `fromHabit`, `toEntry` / `fromEntry`). `order` ↔ `position`, `createdAt` ↔ `created_at`.

Auth : email + mot de passe (`signInWithPassword`). Le compte est créé dans le dashboard, les inscriptions sont désactivées côté Supabase. Session en localStorage du navigateur (jeton d'accès 1 h + jeton de rafraîchissement, renouvelé par le client). « Mot de passe oublié » : `resetPasswordForEmail` → lien vers `BASE_URL` (à déclarer dans Redirect URLs) → événement `PASSWORD_RECOVERY` → `AuthGate` affiche `SetPassword` (`updateUser({ password })`) avant l'app. Sans session, la RLS ne rend aucune ligne, clé publishable ou pas.

Offline : pas encore. En attendant, une écriture sans réseau affiche le bandeau d'erreur, l'UI reste à jour localement jusqu'au prochain rechargement. Phase 2 : file d'attente en localStorage rejouée à la reconnexion.

Notifications : **abandonnées** (décision du 2026-09-04). Les alertes restent calculées côté client à l'affichage. La table `push_subscriptions` du schéma est facultative et peut être ignorée.

## PWA

`vite-plugin-pwa` en mode `generateSW`, `registerType: 'autoUpdate'` : le service worker précache le build et se met à jour tout seul au prochain chargement. Manifest et icônes (`public/icon-*.png`, `favicon.svg`) sont générés par un script Python ponctuel, pas de dépendance à l'exécution. Le service worker n'est pas actif en `npm run dev` (`devOptions.enabled: false`) ; le tester avec `npm run build && npm run preview`.
