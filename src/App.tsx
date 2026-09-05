import { useEffect, useMemo, useState } from 'react';
import type { Entry, Habit } from './types';
import { useStore } from './store';
import { formatLong, toKey, today } from './lib/dates';
import { alertsFor, entriesOf, formatValue } from './lib/stats';
import { PALETTE } from './lib/colors';
import { HabitCard } from './components/HabitCard';
import { HabitDetail } from './components/HabitDetail';
import { LogSheet } from './components/LogSheet';
import { HabitForm } from './components/HabitForm';
import { AlertsBanner } from './components/AlertsBanner';
import { EnvBadge } from './components/EnvBadge';

type Screen = { name: 'dashboard' } | { name: 'detail'; habitId: string };
type Sheet = { habitId: string; date?: string; entry?: Entry } | null;
type Form = { habitId?: string } | null;
/** Confirmation affichée en bas après un ajout, avec « Annuler ». */
type Toast = { id: number; habit: Habit; entry: Entry } | null;

const TOAST_MS = 4000;

/** « +1 Bière », « Vélo · 1h30 », « 34 € · Amazon », « +1 Courses ». */
function describeEntry(habit: Habit, e: Entry): string {
  const bits: string[] = [];
  if (habit.metric === 'count' || (e.duration == null && e.amount == null)) {
    bits.push(`+${e.count} ${e.category ?? e.note ?? habit.unit}`.trim());
  } else {
    if (e.category) bits.push(e.category);
    if (e.duration != null) bits.push(formatValue(e.duration, 'duration'));
    if (e.amount != null) bits.push(formatValue(e.amount, 'amount'));
    if (e.count !== 1) bits.push(`×${e.count}`);
  }
  if (e.note && !bits.includes(`+${e.count} ${e.note}`)) bits.push(e.note);
  return bits.join(' · ');
}

export default function App() {
  const { state, actions } = useStore();
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [form, setForm] = useState<Form>(null);
  const [toast, setToast] = useState<Toast>(null);

  // Le toast disparaît seul ; un nouvel ajout remplace le précédent et relance le compte à rebours.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  const habits = useMemo(() => state.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order), [state.habits]);
  const alerts = useMemo(() => alertsFor(habits, state.entries), [habits, state.entries]);

  if (!state.loaded) return <div className="app"><p className="muted">Chargement…</p></div>;

  const confirmAdded = (habit: Habit, entry: Entry) => setToast({ id: Date.now(), habit, entry });

  const quickLog = (habitId: string) => {
    const habit = state.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const entry = actions.addEntry({ habitId, date: toKey(today()), at: new Date().toISOString(), count: 1, category: habit.defaultOption });
    confirmAdded(habit, entry);
  };

  const undoToast = () => {
    if (!toast) return;
    actions.deleteEntry(toast.entry.id);
    setToast(null);
  };

  const sheetHabit = sheet ? state.habits.find((h) => h.id === sheet.habitId) : undefined;
  const formHabit = form?.habitId ? state.habits.find((h) => h.id === form.habitId) : undefined;

  return (
    <div className="app">
      {screen.name === 'dashboard' && (
        <>
          <header className="topbar">
            <div>
              <h1>Habikit</h1>
              <span className="muted small">{formatLong(today())}</span>
              <EnvBadge />
            </div>
            <div className="topbar-actions">
              <button className="ghost" title="Recharger la fake data" onClick={() => { if (confirm('Remplacer toutes les données par la fake data ?')) void actions.reset(); }}>↺</button>
              <button className="fab" onClick={() => setForm({})} aria-label="Nouvelle habitude">+</button>
            </div>
          </header>

          <AlertsBanner alerts={alerts} onOpen={(habitId) => setScreen({ name: 'detail', habitId })} />

          <main className="cards">
            {habits.map((h) => (
              <HabitCard
                key={h.id}
                habit={h}
                entries={entriesOf(state.entries, h.id)}
                onOpen={() => setScreen({ name: 'detail', habitId: h.id })}
                onQuickLog={() => quickLog(h.id)}
                onDetailedLog={() => setSheet({ habitId: h.id })}
              />
            ))}
            {habits.length === 0 && (
              <div className="empty">
                <p>Aucune habitude.</p>
                <button className="btn primary" onClick={() => setForm({})}>Créer la première</button>
              </div>
            )}
          </main>
        </>
      )}

      {screen.name === 'detail' && (() => {
        const habit = state.habits.find((h) => h.id === screen.habitId);
        if (!habit) return null;
        return (
          <HabitDetail
            habit={habit}
            entries={entriesOf(state.entries, habit.id)}
            onBack={() => setScreen({ name: 'dashboard' })}
            onEdit={() => setForm({ habitId: habit.id })}
            onAddEntry={(date) => setSheet({ habitId: habit.id, date })}
            onEditEntry={(entry) => setSheet({ habitId: habit.id, entry })}
            onDeleteEntry={(id) => actions.deleteEntry(id)}
          />
        );
      })()}

      {sheet && sheetHabit && (
        <LogSheet
          habit={sheetHabit}
          date={sheet.date}
          entry={sheet.entry}
          onClose={() => setSheet(null)}
          onSave={(e) => {
            if (sheet.entry) actions.updateEntry(sheet.entry.id, e);
            else confirmAdded(sheetHabit, actions.addEntry(e));
            setSheet(null);
          }}
          onDelete={sheet.entry ? () => { actions.deleteEntry(sheet.entry!.id); setSheet(null); } : undefined}
        />
      )}

      {toast && (
        <div className="toast" role="status" style={{ ['--c' as string]: PALETTE[toast.habit.color] }}>
          <span className="toast-check">✓</span>
          <span className="toast-text">
            <span className="toast-title">{toast.habit.icon} {toast.habit.name} · {toast.entry.date === toKey(today()) ? 'ajouté' : `ajouté le ${toast.entry.date.slice(8, 10)}/${toast.entry.date.slice(5, 7)}`}</span>
            <span className="toast-sub">{describeEntry(toast.habit, toast.entry)}</span>
          </span>
          <button className="btn secondary" onClick={undoToast}>Annuler</button>
        </div>
      )}

      {form && (
        <HabitForm
          habit={formHabit}
          onClose={() => setForm(null)}
          onSave={(h) => {
            if (formHabit) actions.updateHabit(formHabit.id, h);
            else actions.addHabit(h);
            setForm(null);
          }}
          onDelete={formHabit ? () => {
            if (confirm(`Supprimer « ${formHabit.name} » et toutes ses entrées ?`)) {
              actions.deleteHabit(formHabit.id);
              setForm(null);
              setScreen({ name: 'dashboard' });
            }
          } : undefined}
        />
      )}
    </div>
  );
}
