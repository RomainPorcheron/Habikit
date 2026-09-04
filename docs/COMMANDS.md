# COMMANDS — Habikit

## Développement

```bash
npm install          # dépendances
npm run dev          # serveur Vite sur http://localhost:5173 (accessible sur le réseau local avec --host, déjà activé)
npm run typecheck    # tsc --noEmit
npm run build        # build de prod dans dist/
npm run preview      # sert dist/ en local
```

## Tester sur le téléphone

Le serveur écoute sur toutes les interfaces (`host: true` dans vite.config.ts). Sur le téléphone, ouvrir `http://<ip-du-pc>:5173`. Trouver l'IP :

```bash
ipconfig | findstr IPv4
```

## Tester la PWA (installation, hors ligne)

Le service worker n'est pas actif en dev. Pour le tester :

```bash
npm run build
npm run preview
```

Puis ouvrir http://localhost:4173, et sur le téléphone « Ajouter à l'écran d'accueil ». Après un premier chargement, l'app s'ouvre hors ligne.

## Données locales

- Les données vivent dans `localStorage` sous la clé `habikit:v2` (v1 = avant l'ajout des types / activités ; changer la clé force le rechargement de la fake data).
- Bouton ↺ dans l'app = remplace tout par la fake data.
- Dans la console navigateur : `localStorage.removeItem('habikit:v2')` puis recharger = même effet.

## Git

```bash
git status
git add -A
git commit -m "message"
git push
```

## Environnements

- `npm run dev` charge `.env.development` (backend dev).
- `npm run build` charge `.env.production` (backend prod).

## Promotion dev → prod (à faire par Romain, après validation en dev)

À compléter quand le backend sera en place. Squelette :

1. Vérifier que tout est validé en dev (checklist du PLAN).
2. Rejouer les migrations SQL sur le projet prod (SQL editor ou `supabase db push --linked` sur le projet prod).
3. `npm run build` puis déployer `dist/` sur l'hébergeur prod.
4. Ouvrir l'URL prod, se connecter, vérifier une saisie et le dashboard.
