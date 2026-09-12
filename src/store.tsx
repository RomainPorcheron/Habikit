import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type { Entry, Habit } from './types';
import { localRepo, newId, type Repo, type Snapshot } from './data/repo';
import { supabaseRepo } from './data/supabaseRepo';
import { supabase } from './data/supabase';

/** Backend réel si configuré (et donc session ouverte, cf. AuthGate), sinon localStorage. */
const repo: Repo = supabase ? supabaseRepo : localRepo;

type State = Snapshot & { loaded: boolean; loadError?: string };

type Action =
  | { type: 'hydrate'; snapshot: Snapshot }
  | { type: 'loadError'; message: string }
  | { type: 'addHabit'; habit: Habit }
  | { type: 'updateHabit'; id: string; patch: Partial<Habit> }
  | { type: 'deleteHabit'; id: string }
  | { type: 'addEntry'; entry: Entry }
  | { type: 'updateEntry'; id: string; patch: Partial<Entry> }
  | { type: 'deleteEntry'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ...action.snapshot, loaded: true, loadError: undefined };
    case 'loadError':
      return { ...state, loaded: true, loadError: action.message };
    case 'addHabit':
      return { ...state, habits: [...state.habits, action.habit] };
    case 'updateHabit':
      return { ...state, habits: state.habits.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)) };
    case 'deleteHabit':
      return {
        ...state,
        habits: state.habits.filter((h) => h.id !== action.id),
        entries: state.entries.filter((e) => e.habitId !== action.id),
      };
    case 'addEntry':
      return { ...state, entries: [...state.entries, action.entry] };
    case 'updateEntry':
      return { ...state, entries: state.entries.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)) };
    case 'deleteEntry':
      return { ...state, entries: state.entries.filter((e) => e.id !== action.id) };
  }
}

export interface Actions {
  addHabit(h: Omit<Habit, 'id' | 'createdAt' | 'order' | 'archived'>): Habit;
  updateHabit(id: string, patch: Partial<Habit>): void;
  deleteHabit(id: string): void;
  addEntry(e: Omit<Entry, 'id'>): Entry;
  updateEntry(id: string, patch: Partial<Entry>): void;
  deleteEntry(id: string): void;
  reset(): Promise<void>;
  /** Recharge tout depuis le backend (après une erreur de sauvegarde, par exemple). */
  reload(): Promise<void>;
}

interface StoreCtx {
  state: State;
  actions: Actions;
  /** Mode démo (localStorage + fake data) ou backend. */
  demo: boolean;
  /** Dernière écriture échouée, à afficher. `null` = tout est synchronisé. */
  syncError: string | null;
  dismissSyncError(): void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { habits: [], entries: [], loaded: false });
  const [syncError, setSyncError] = useState<string | null>(null);
  // Les actions lisent l'état courant via une ref : pas besoin de recréer `actions` à chaque rendu.
  const stateRef = useRef(state);
  stateRef.current = state;

  const load = useCallback(async () => {
    try {
      const snapshot = await repo.load();
      dispatch({ type: 'hydrate', snapshot });
    } catch (e) {
      dispatch({ type: 'loadError', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Écriture en arrière-plan : l'UI est déjà à jour (optimiste), on ne fait que remonter l'erreur. */
  const persist = useCallback((op: Promise<void>) => {
    op.catch((e: unknown) => setSyncError(e instanceof Error ? e.message : String(e)));
  }, []);

  const reset = useCallback(async () => {
    try {
      const snapshot = await repo.reset();
      dispatch({ type: 'hydrate', snapshot });
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      addHabit(h) {
        const habit: Habit = {
          ...h,
          id: newId(),
          createdAt: new Date().toISOString(),
          order: stateRef.current.habits.length,
          archived: false,
        };
        dispatch({ type: 'addHabit', habit });
        persist(repo.upsertHabit(habit));
        return habit;
      },
      updateHabit(id, patch) {
        const current = stateRef.current.habits.find((h) => h.id === id);
        if (!current) return;
        dispatch({ type: 'updateHabit', id, patch });
        persist(repo.upsertHabit({ ...current, ...patch }));
      },
      deleteHabit(id) {
        dispatch({ type: 'deleteHabit', id });
        persist(repo.deleteHabit(id));
      },
      addEntry(e) {
        const entry: Entry = { ...e, id: newId() };
        dispatch({ type: 'addEntry', entry });
        persist(repo.upsertEntry(entry));
        return entry;
      },
      updateEntry(id, patch) {
        const current = stateRef.current.entries.find((e) => e.id === id);
        if (!current) return;
        dispatch({ type: 'updateEntry', id, patch });
        persist(repo.upsertEntry({ ...current, ...patch }));
      },
      deleteEntry(id) {
        dispatch({ type: 'deleteEntry', id });
        persist(repo.deleteEntry(id));
      },
      reset,
      reload: load,
    }),
    [persist, reset, load],
  );

  const value = useMemo<StoreCtx>(
    () => ({ state, actions, demo: repo.demo, syncError, dismissSyncError: () => setSyncError(null) }),
    [state, actions, syncError],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore hors StoreProvider');
  return ctx;
}
