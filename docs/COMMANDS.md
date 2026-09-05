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

## Tester depuis le téléphone sans PC (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` publie **deux versions** de l'app sur le même site Pages, à chaque push sur `main` ou `dev` (ou à la main via Actions → « Run workflow ») :

| Env | Branche | URL | Supabase |
|---|---|---|---|
| prod | `main` | https://romainporcheron.github.io/Habikit/ | Habikit-prod (variables `*_PROD`) |
| dev | `dev` | https://romainporcheron.github.io/Habikit/dev/ | Habikit-dev (variables `*_DEV`) |

- Pré-requis, une seule fois : GitHub → Settings → Pages → Source : **GitHub Actions**.
- La branche `dev` doit exister (GitHub → menu des branches → taper `dev` → « Create branch dev from main »). Tant qu'elle n'existe pas, seule la prod est publiée.
- Les deux builds sont distincts : `VITE_BASE`, `VITE_APP_ENV` et les variables Supabase changent, le manifeste aussi (« Habikit DEV », couleur de barre différente). On peut installer les deux PWA côte à côte sur l'écran d'accueil.
- Une pastille sous la date indique l'environnement et l'état du backend (`dev · Supabase OK`). En prod elle n'apparaît qu'en cas de problème. Tap dessus = revérifier + afficher l'erreur.
- Workflow de test depuis le téléphone : l'IA pousse sa branche → PR vers `dev` → merger → attendre ~1 min → ouvrir `/Habikit/dev/`. Une fois validé : PR `dev` → `main`.

## Brancher Supabase (à faire depuis le téléphone, une fois par projet)

Pour `Habikit-dev` d'abord, puis `Habikit-prod` plus tard avec les variables `*_PROD`.

1. **Schéma** : Supabase → SQL Editor → New query → coller le contenu de [supabase/schema.sql](../supabase/schema.sql) (sur GitHub, ouvrir le fichier → « Raw » → tout sélectionner / copier) → Run. Résultat attendu : « Success. No rows returned ».
2. **Auth** : Authentication → Providers → Email : activé (magic link, pas besoin de mot de passe). Authentication → URL Configuration :
   - Site URL : `https://romainporcheron.github.io/Habikit/dev/`
   - Redirect URLs : ajouter `https://romainporcheron.github.io/Habikit/dev/**` et `http://localhost:5173/**`
3. **Clés** : Project Settings → API (ou « API Keys ») : copier **Project URL** et la clé **anon / publishable** (`sb_publishable_…` ou `eyJ…` selon l'âge du projet, les deux marchent).
4. **GitHub** : repo → Settings → Secrets and variables → Actions → onglet **Variables** → New repository variable :
   - `SUPABASE_URL_DEV` = Project URL
   - `SUPABASE_ANON_KEY_DEV` = la clé
5. Relancer le déploiement (Actions → Deploy to GitHub Pages → Run workflow) ou pousser sur `dev`. Sur `/Habikit/dev/`, la pastille doit afficher `dev · Supabase OK`. `Supabase KO` + message = URL / clé fausse ou schéma non joué.

Pour travailler en local, copier `.env.example` en `.env.development` et y mettre les mêmes valeurs.

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

- `npm run dev` charge `.env.development` (backend dev). Sans fichier : `VITE_APP_ENV=local`, pas de backend, localStorage.
- `npm run build` charge `.env.production` (backend prod). Sur GitHub Pages, ce sont les Variables du repo qui alimentent le build (voir deploy.yml).
- Modèle : `.env.example`. Variables : `VITE_APP_ENV`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE`.

## Promotion dev → prod (à faire par Romain, après validation en dev)

À compléter quand le backend sera en place. Squelette :

1. Vérifier que tout est validé en dev (checklist du PLAN) sur `/Habikit/dev/`.
2. Rejouer les migrations SQL sur le projet `Habikit-prod` (SQL editor).
3. Renseigner `SUPABASE_URL_PROD` / `SUPABASE_ANON_KEY_PROD` dans les Variables GitHub (une fois), avec l'URL prod dans la config Auth de Supabase.
4. PR `dev` → `main`, merger : le workflow republie `/Habikit/`.
5. Ouvrir l'URL prod, se connecter, vérifier une saisie et le dashboard.
