# Récupérer ses données HabitKit

> Rédigé le 2026-09-07. But : rapatrier l'historique HabitKit (l'app de Sebastian Röhl) dans Habikit, sans l'abonnement Pro.

## Ce qu'on sait de HabitKit

- **Tout est local** : pas de compte, pas de serveur, pas de cloud. Les données sont dans une base SQLite dans le dossier privé de l'app sur le téléphone. Conséquence : une demande RGPD au développeur ne donne rien, il ne détient pas les données.
- **Export / import JSON = fonction Pro** (« HabitKit Pro unlocks unlimited habits, as well as importing and exporting your data… »). Pro : 1,99 $/mois, 19,99 $/an, 41,99 $ à vie.
- **Format de l'export JSON** (retrouvé dans le code d'une app open source qui l'importe, [InlitX/streak](https://github.com/InlitX/streak), `lib/services/import_service.dart`) :

```json
{
  "habits":      [{ "id": "…", "name": "Sport", "description": "…", "color": "blue", "iconName": "…", "archived": false, "orderIndex": 0 }],
  "completions": [{ "habitId": "…", "date": "2026-07-21T22:00:00.000Z", "timezoneOffsetInMinutes": 120, "amountOfCompletions": 1 }],
  "intervals":   [{ "habitId": "…", "requiredNumberOfCompletionsPerDay": 1 }]
}
```

`date` = minuit local converti en UTC ; le jour réel = `date + timezoneOffsetInMinutes`. `color` = nom Material (`blue`, `deepOrange`…) ou hex. Une complétion par habitude et par jour, avec un compteur.

## Dans Habikit : bouton ⤒ (Importer)

Le dashboard a deux boutons dans l'en-tête : **⤒ Importer** (fichier JSON Habikit ou HabitKit) et **⤓ Exporter** (JSON Habikit). L'import HabitKit :

- crée une habitude par entrée de `habits` (type `build`, métrique `count`, objectif min N / jour d'après `intervals`, couleur au plus proche, emoji deviné d'après `iconName`, sinon ✅ ; les archivées restent archivées) ;
- crée une entrée par complétion, au jour local, avec `count = amountOfCompletions` ;
- ids dérivés des ids HabitKit (`hk_…`, `hke_…`) : ré-importer le même fichier **remplace** au lieu de dupliquer. Les habitudes Habikit existantes sont conservées.

Ensuite, modifier chaque habitude importée (type quit / build, unité, objectif, options) : le formulaire fait tout.

## Obtenir le fichier

### Voie 1 — iPhone : sauvegarde locale + extraction (gratuit, sans jailbreak)

Les sauvegardes Finder / iTunes contiennent le dossier de l'app, base SQLite comprise.

1. Brancher l'iPhone au Mac / PC → Finder (ou iTunes / Apple Devices sur Windows) → **Sauvegarder maintenant**, **sans** cocher « Chiffrer la sauvegarde locale » (sinon voir plus bas).
2. Dossier de la sauvegarde : macOS `~/Library/Application Support/MobileSync/Backup/<id>`, Windows `%APPDATA%\Apple Computer\MobileSync\Backup\<id>` (ou `%USERPROFILE%\Apple\MobileSync\Backup` avec l'app Apple Devices).
3. Repérer l'app puis extraire sa base :

```bash
python scripts/habitkit_backup_to_json.py --backup "<dossier>" --out habitkit-db/ --list-domains   # trouver le bundle id (…habitkit…)
python scripts/habitkit_backup_to_json.py --backup "<dossier>" --out habitkit-db/                  # copie les fichiers + convertit chaque .db en .json
```

4. Importer le `.json` produit avec ⤒. Si le format ne passe pas, ouvrir le JSON : le script exporte **toutes** les tables en camelCase et renomme celles qui ressemblent à `habits` / `completions` / `intervals` ; ajuster les clés à la main d'après le schéma ci-dessus.

Sauvegarde chiffrée : `Manifest.db` est illisible directement. Soit refaire une sauvegarde non chiffrée, soit utiliser la bibliothèque Python [`iOSbackup`](https://github.com/avibrazil/iOSbackup) (`getFolderDecryptedCopy` sur le domaine `AppDomain-<bundle id>`), puis passer la base extraite à `--db`.

### Voie 2 — Android : plus difficile sans root

Le dossier `/data/data/com.roehl.habitkit/` n'est pas lisible sans root, et `adb backup` ne sauvegarde plus les données des apps depuis Android 12. Pistes, par ordre de faisabilité :

1. **Émulateur rooté + restauration Google** : créer un AVD Android Studio avec une image **« Google APIs »** (pas « Google Play », qui interdit `adb root`), se connecter avec le compte Google à la configuration et accepter la **restauration des apps depuis la sauvegarde** du téléphone (Google One / sauvegarde Android doit être active sur le téléphone, et HabitKit ne pas l'avoir désactivée). Puis `adb root && adb pull /data/data/com.roehl.habitkit/ habitkit-db/` et `--db` sur le `.db` trouvé (`databases/` ou `app_flutter/`).
2. **Téléphone rooté** : `adb pull` direct du même dossier.
3. **Migration téléphone → téléphone** (Android 12+, câble ou sans fil) vers un appareil rooté : même résultat.

### Voie 3 — Lire les grilles partagées

HabitKit sait partager une grille en image. Un script qui détecte les cases colorées peut reconstruire les jours (pas les compteurs exacts). À garder pour un historique court, saisie manuelle ensuite dans Habikit (fiche jour par jour dans le détail).

### Voie 4 — Un mois de Pro (1,99 $)

S'abonner un mois, exporter le JSON, résilier. C'est la voie la plus rapide et la seule officielle ; l'importeur ⤒ est fait pour ce fichier. À considérer si les voies 1 / 2 coûtent plus d'une heure.

## Ce qui n'est pas retenu

- APK / IPA « Pro débloqué » : piraté, hors de question.
- Demande RGPD : sans objet, les données ne quittent pas le téléphone.
