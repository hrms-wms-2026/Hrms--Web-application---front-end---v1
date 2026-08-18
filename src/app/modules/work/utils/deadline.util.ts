export interface DeadlineStatus {
  label: string;
  overdue: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDeadlineStatus(endDateIso: string | null | undefined, today: Date = new Date()): DeadlineStatus | null {
  if (!endDateIso) return null;

  const end = new Date(endDateIso);
  if (isNaN(end.getTime())) return null;

  const diffDays = Math.round((startOfDay(end).getTime() - startOfDay(today).getTime()) / MS_PER_DAY);

  if (diffDays === 0) {
    return { label: 'Due today', overdue: false };
  }

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { label: `${days} ${days === 1 ? 'day' : 'days'} overdue`, overdue: true };
  }

  return { label: `${diffDays} ${diffDays === 1 ? 'day' : 'days'} left`, overdue: false };
}
