# Reconstruire l'historique HabitKit depuis des captures d'écran

Quand l'export JSON (Pro) n'est pas disponible : deux captures par habitude du détail HabitKit (grille scrollée vers le passé, puis vers le présent), largeur 1080 px.

1. Copier les captures dans un dossier, nommées `<id>.png`, avec un `shots.json` :

```json
{ "today": "2026-09-07",
  "shots": [["sport-1", "Sport", [2026, 4]], ["sport-2", "Sport", [2025, 11]]] }
```

`[2026, 4]` = mois du premier libellé visible au-dessus de la grille (lu à l'œil). Le script vérifie que les libellés suivants tombent bien sur les premiers lundis des mois suivants.

2. Adapter `HABITS` dans `build.py` (icône, couleur, type build/quit, objectif), puis :

```bash
pip install pillow numpy
SHOTS_DIR=~/captures python3 scripts/screenshots/build.py
```

Produit `validation.html` (captures annotées + grille fusionnée + dates), `habikit-import.json` (bouton ⤒ de l'app) et `supabase-import.sql`.

Principe : saturation des pixels au centre de chaque case (grille détectée par autocorrélation, pas 34 px), colonnes calées sur les libellés de mois, semaine du lundi, fusion des deux captures en préférant les colonnes hors du dégradé de bord.
