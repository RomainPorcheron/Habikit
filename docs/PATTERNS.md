# PATTERNS — Habikit

### Repository derrière une interface

**Fonction** : Les composants ne savent pas d'où viennent les données. `Repo` expose `load / save / reset` ; `localRepo` est l'implémentation actuelle.

**Intérêt** : Brancher Supabase sans toucher à l'UI, et garder un mode « démo » (localStorage) quand aucun backend n'est configuré. Les écritures sont unitaires (une ligne à la fois), ce qui colle aux tables SQL et prépare la file d'attente hors ligne.

**Exemple** :
```ts
export interface Repo {
  readonly demo: boolean;
  load(): Promise<Snapshot>;
  upsertHabit(h: Habit): Promise<void>;
  deleteHabit(id: string): Promise<void>;
  upsertEntry(e: Entry): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  reset(): Promise<Snapshot>;
}
```

**Utilisé dans ce projet** : `src/data/repo.ts` (`localRepo`), `src/data/supabaseRepo.ts`, consommés par `src/store.tsx`.

---

### Mise à jour optimiste

**Fonction** : Chaque action du store modifie l'état en mémoire immédiatement, puis lance l'écriture backend sans l'attendre. Si elle échoue, l'erreur est stockée dans `syncError` et affichée dans un bandeau avec un bouton Recharger.

**Intérêt** : Le +1 reste instantané sur mobile, même en 3G. L'UI ne dépend jamais de la latence réseau. Trade-off : entre l'échec et le rechargement, l'écran montre un état que le serveur n'a pas ; acceptable pour un seul utilisateur, et la phase 2 (file d'attente) le résoudra.

**Utilisé dans ce projet** : `src/store.tsx` (`persist()`), bandeau `.sync-error` dans `App.tsx`.

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

**Fonction** : `pointerdown` arme un timer (450 ms). S'il expire → action longue (fiche détaillée). Sinon l'action courte (+1) part sur `click`, jamais sur `pointerup`. Les habitudes qui exigent une durée ou un montant (Sport, Commandes) n'ont pas d'appui long : un tap ouvre la fiche.

**Intérêt** : Un seul bouton par carte, comme HabitKit, mais deux gestes. `onContextMenu` est neutralisé pour éviter le menu Android sur appui long.

**Piège évité (clic fantôme)** : sur mobile, le `click` synthétique d'une tape est ciblé sur ce qui se trouve sous le doigt *au relâchement*. Si on ouvre la fiche au `pointerup`, ce clic atterrit sur l'overlay qui vient d'apparaître et la referme aussitôt (« je clique et rien ne se passe »). Trois garde-fous : l'action sur `click` ; après un appui long, `swallowNextClick()` avale le clic suivant en phase de capture sur `document` ; l'overlay ne ferme que si le `pointerdown` a commencé sur lui (`downOnOverlay`).

**Utilisé dans ce projet** : `src/components/HabitCard.tsx`, `LogSheet.tsx`, `HabitForm.tsx`.

---

### Retour visuel après un ajout, dérivé des données

**Fonction** : `HabitCard` compare le total du jour au rendu précédent (`useRef`). S'il augmente : le bouton « pop » (Web Animations API), la carte flashe dans sa couleur, la pastille compteur sur le bouton et la puce « auj. » se remontent. `App` affiche un toast « ✓ Alcool · ajouté · +1 Bière » avec **Annuler** (supprime l'entrée) pendant 4 s.

**Intérêt** : Le feedback ne dépend pas du geste (tap +1, fiche enregistrée, ajout depuis le détail) : il se déclenche dès que les entrées changent. L'annulation évite un aller-retour dans le détail en cas de double tap.

**Utilisé dans ce projet** : `src/components/HabitCard.tsx`, `src/App.tsx`.

---

### Heatmap qui remplit la largeur disponible

**Fonction** : `ResizeObserver` sur le conteneur → nombre de semaines = `floor((largeur + gap) / (cellule + gap))`. Colonnes alignées à droite, la semaine courante est toujours visible.

**Intérêt** : Même composant sur téléphone (≈ 25 semaines) et desktop (≈ 40), sans média query.

**Utilisé dans ce projet** : `src/components/Heatmap.tsx`.
