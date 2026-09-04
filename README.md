# Habikit

Tracker d'habitudes façon HabitKit (grille GitHub, une carte par habitude), sans limitation payante, avec compteur multi-coches par jour, détails (durée, montant, note), objectifs min / max et alertes.

## Lancer

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173 (ou `http://<ip-du-pc>:5173` depuis le téléphone). Les données sont en `localStorage`, pré-remplies avec de la fake data. Le bouton ↺ les régénère.

## Docs

- [docs/PLAN.md](docs/PLAN.md) — objectifs, fonctionnalités, étapes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — organisation, modèle, flux, backend proposé
- [docs/FUNCTIONS.md](docs/FUNCTIONS.md) — fonctions clés
- [docs/COMMANDS.md](docs/COMMANDS.md) — commandes
- [docs/PATTERNS.md](docs/PATTERNS.md) — patterns utilisés
- [supabase/schema.sql](supabase/schema.sql) — schéma backend proposé
