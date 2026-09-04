import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Entry, Habit } from './types';
import { localRepo, newId, type Snapshot } from './data/repo';

type State = Snapshot & { loaded: boolean };

type Action =
  | { type: 'hydrate'; snapshot: Snapshot }
  | { type: 'addHabit'; habit: Habit }
  | { type: 'updateHabit'; id: string; patch: Partial<Habit> }
  | { type: 'deleteHabit'; id: string }
  | { type: 'addEntry'; entry: Entry }
  | { type: 'updateEntry'; id: string; patch: Partial<Entry> }
  | { type: 'deleteEntry'; id: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return { ...action.snapshot, loaded: true };
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
}

const Ctx = createContext<{ state: State; actions: Actions } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { habits: [], entries: [], loaded: false });

  useEffect(() => {
    localRepo.load().then((snapshot) => dispatch({ type: 'hydrate', snapshot }));
  }, []);

  // Persistance : à chaque changement après hydratation.
  useEffect(() => {
    if (state.loaded) void localRepo.save({ habits: state.habits, entries: state.entries });
  }, [state]);

  const reset = useCallback(async () => {
    const snapshot = await localRepo.reset();
    dispatch({ type: 'hydrate', snapshot });
  }, []);

  const actions = useMemo<Actions>(
    () => ({
      addHabit(h) {
        const habit: Habit = {
          ...h,
          id: newId('h'),
          createdAt: new Date().toISOString(),
          order: state.habits.length,
          archived: false,
        };
        dispatch({ type: 'addHabit', habit });
        return habit;
      },
      updateHabit(id, patch) {
        dispatch({ type: 'updateHabit', id, patch });
      },
      deleteHabit(id) {
        dispatch({ type: 'deleteHabit', id });
      },
      addEntry(e) {
        const entry: Entry = { ...e, id: newId('e') };
        dispatch({ type: 'addEntry', entry });
        return entry;
      },
      updateEntry(id, patch) {
        dispatch({ type: 'updateEntry', id, patch });
      },
      deleteEntry(id) {
        dispatch({ type: 'deleteEntry', id });
      },
      reset,
    }),
    [state.habits.length, reset],
  );

  return <Ctx.Provider value={{ state, actions }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore hors StoreProvider');
  return ctx;
}
