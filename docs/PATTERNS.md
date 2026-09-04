# PATTERNS — Habikit

### Repository derrière une interface

**Fonction** : Les composants ne savent pas d'où viennent les données. `Repo` expose `load / save / reset` ; `localRepo` est l'implémentation actuelle.

**Intérêt** : Brancher Supabase (ou autre) sans toucher à l'UI. Permet aussi de garder un mode « démo / offline ». Trade-off : `save(snapshot)` complet est simple mais ne convient pas à un backend ; on passera à des écritures unitaires.

**Exemple** :
```ts
export interface Repo {
  load(): Promise<Snapshot>;
  save(snapshot: Snapshot): Promise<void>;
  reset(): Promise<Snapshot>;
}
```

**Utilisé dans ce projet** : `src/data/repo.ts`, consommé par `src/store.tsx`.

---

### Agrégats dérivés, jamais stockés

**Fonction** : On stocke uniquement des `Entry` brutes. Totaux journaliers, série, avancement d'objectif, alertes sont recalculés à l'affichage (`useMemo`).

**Intérêt** : Zéro incohérence (supprimer une entrée met tout à jour), le modèle reste minuscule, et le même code pourra tourner côté serveur pour les notifications. Trade-off : recalcul à chaque rendu ; négligeable pour quelques milliers d'entrées.

**Utilisé dans ce projet** : `src/lib/stats.ts`, `HabitCard.tsx`, `HabitDetail.tsx`.

---

### Clés de jour en heure locale

**Fonction** : Chaque entrée porte `date = 'YYYY-MM-DD'` calculée en local, en plus de l'horodatage ISO `at`.

**Intérêt** : Un verre bu à 00:30 compte pour le jour où on l'a saisi selon l'heure du téléphone, sans surprise UTC. Les regroupements par jour deviennent de simples comparaisons de chaînes (`date >= '2026-09-01'`).

**Utilisé dans ce projet** : `src/lib/dates.ts` (`toKey`), `src/lib/stats.ts`.

---

### Fake data déterministe (PRNG seedé)

**Fonction** : `mulberry32(42)` génère toujours la même suite : le reset redonne exactement les mêmes 220 jours.

**Intérêt** : Captures d'écran et tests reproductibles ; on peut forcer des cas (dépassement cette semaine, rien aujourd'hui) pour voir les alertes.

**Exemple** :
```ts
function mulberry32(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; /* … */ };
}
```

**Utilisé dans ce projet** : `src/data/seed.ts`.

---

### Tap court / appui long sur un même bouton

**Fonction** : `pointerdown` arme un timer (420 ms). S'il expire → action longue (fiche détaillée). `pointerup` avant → action courte (+1).

**Intérêt** : Un seul bouton par carte, comme HabitKit, mais deux gestes. `onContextMenu` est neutralisé pour éviter le menu Android sur appui long.

**Utilisé dans ce projet** : `src/components/HabitCard.tsx`.

---

### Heatmap qui remplit la largeur disponible

**Fonction** : `ResizeObserver` sur le conteneur → nombre de semaines = `floor((largeur + gap) / (cellule + gap))`. Colonnes alignées à droite, la semaine courante est toujours visible.

**Intérêt** : Même composant sur téléphone (≈ 25 semaines) et desktop (≈ 40), sans média query.

**Utilisé dans ce projet** : `src/components/Heatmap.tsx`.
