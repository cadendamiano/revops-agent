const LABELS: Record<string, string> = {
  'due-soon': 'Due soon',
  overdue: 'Overdue',
  open: 'Open',
  scheduled: 'Scheduled',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill ${status}`}>
      <span className="dot" />
      {LABELS[status] ?? status}
    </span>
  );
}
