import type { Alert } from '../types';

interface Props {
  alerts: Alert[];
  onOpen(habitId: string): void;
}

export function AlertsBanner({ alerts, onOpen }: Props) {
  if (alerts.length === 0) return null;
  return (
    <div className="alerts">
      {alerts.map((a, i) => (
        <button key={i} className={`alert alert-${a.level}`} onClick={() => onOpen(a.habitId)}>
          <span className="alert-title">{a.title}</span>
          {a.detail && <span className="alert-detail">{a.detail}</span>}
        </button>
      ))}
    </div>
  );
}
