# PLAN — Habikit

> Brouillon à valider. Rédigé le 2026-09-04 à partir du brief initial.

## Objectif

Reproduire l'expérience HabitKit (grille façon GitHub, une carte par habitude, ultra simple) sans la limitation payante, et l'étendre :

- plusieurs coches par jour (compteur), pas seulement fait / pas fait ;
- des détails à chaque coche : durée, montant, note texte ;
- des objectifs **min** (au moins 1 sport / jour) et des limites **max** (4 verres / semaine, 150 € / mois) ;
- « il se passe quelque chose » quand une limite est dépassée ou un minimum raté.

Garder l'interface et la lisibilité de HabitKit : dashboard = liste de cartes, une grille par carte, un bouton par carte.

## Cas d'usage de Romain

| Habitude | Type | Saisie | Objectif |
|---|---|---|---|
| Alcool | à limiter | +1 verre avec type (Bière par défaut, Vin, Cocktail, Fort, Autre), note optionnelle | max 4 verres / semaine |
| Sport | à faire | activité dans une liste (Vélo, Escalade, Badminton, Marche, Rando, Salle de sport, Autre à écrire) + durée | min 1 séance / jour |
| Commandes | à limiter | montant € + où | max 150 € / mois |
| Doliprane | à limiter | +1 comprimé | max 6 / semaine |
| Tâches | à faire | +1 + libellé de la tâche | min 10 / semaine |

## Fonctionnalités

### Faites (prototype, fake data en localStorage)
- Dashboard : cartes avec icône, nom, description, grille ~30 semaines, bouton ✓ / +, chip objectif, série.
- Bouton carte : tap = +1 direct (ou fiche si durée/montant à saisir, sans appui long dans ce cas), appui long = fiche complète.
- Retour visuel à chaque ajout : bouton qui « pop », pastille compteur du jour sur le bouton, puce « auj. » colorée, toast en bas avec Annuler.
- Fiche de saisie : jour, heure, quantité, durée, montant, détail. Modification et suppression.
- Détail habitude : grille, stats (semaine, mois, série, record), barre d'objectif, histogramme 12 semaines, calendrier mensuel avec valeur par jour, liste des entrées du jour sélectionné.
- Formulaire habitude : nom, description, emoji, couleur, type, unité, champs à saisir, métrique affichée, objectif min/max avec période, conséquence.
- Alertes en haut du dashboard : limite dépassée, presque à la limite, minimum pas encore fait (après 18 h pour un objectif jour, ou quand il ne reste plus assez de jours), raté hier. Carte cerclée de rouge.
- Choix par habitude (`options`) : chips dans la fiche de saisie, « Autre… » avec texte libre, choix par défaut utilisé par le +1 rapide. Section « Par type » dans le détail (répartition sur le mois affiché).
- PWA installable : manifest, icônes, service worker (vite-plugin-pwa, mise à jour auto). Fonctionne hors ligne une fois installée.
- Reset de la fake data (bouton ↺).

### À faire
- [ ] Backend et synchronisation (voir ARCHITECTURE.md, section Backend). Romain met en place Supabase à son retour de vacances.
- [ ] Authentification : un seul compte (Romain), magic link.
- [ ] Archiver / réordonner les habitudes (drag).
- [ ] Export / import JSON.
- [ ] Vue compacte et vue « checklist » comme HabitKit (optionnel).
- [ ] Widget écran d'accueil : impossible en PWA, seulement si passage en app native (Expo).

## Stack

- Front : Vite + React 18 + TypeScript, CSS maison (variables, pas de framework). Mobile-first, thème sombre.
- Données : `localStorage` derrière une interface `Repo` (src/data/repo.ts) pour brancher un backend sans toucher aux composants.
- Backend proposé : Supabase (Postgres + Auth + Row Level Security). Voir `supabase/schema.sql`.

## Environnements

Deux environnements séparés dès le backend :

- **dev** : projet Supabase « habikit-dev », `.env.development`, c'est là que je travaille et que Romain teste.
- **prod** : projet Supabase « habikit-prod », `.env.production`, jamais modifié directement.

La promotion dev → prod (schéma, build, déploiement) est faite par Romain une fois tout validé en dev. La procédure sera dans COMMANDS.md.

## Structure

```
src/
  types.ts            modèle (Habit, Entry, Goal, Alert)
  store.tsx           état global (useReducer) + persistance
  data/repo.ts        interface Repo + implémentation localStorage
  data/seed.ts        fake data déterministe
  lib/dates.ts        helpers de dates (semaine = lundi)
  lib/stats.ts        totaux, objectifs, séries, niveaux de heatmap, alertes
  lib/colors.ts       palette, emojis
  components/         Heatmap, HabitCard, HabitDetail, MonthCalendar, LogSheet, HabitForm, AlertsBanner
docs/                 PLAN, ARCHITECTURE, FUNCTIONS, COMMANDS, PATTERNS
supabase/schema.sql   schéma backend proposé
```

## Étapes

1. ✅ Prototype front avec fake data.
2. Valider le PLAN et les réponses aux questions ouvertes.
3. Mise en place backend (Supabase) par Romain, implémentation `supabaseRepo` + auth.
4. ✅ PWA installable.
5. Polish : archivage, réordonnancement, export.

## Décisions (2026-09-04)

- **PWA**, pas d'app native. Pas de widget d'écran d'accueil.
- **Alertes** : le bandeau + carte rouge + texte de conséquence suffisent. Pas de push ni de mail.
- **Alcool** : comptage par type à renseigner, Bière par défaut.
- **Sport** : activité choisie dans une liste (Vélo, Escalade, Badminton, Marche, Rando, Salle de sport) ou « Autre » à écrire.
- **Un seul utilisateur** : Romain.
