function plural(count: number, unit: string): string {
  return `Updated ${count} ${unit}${count === 1 ? '' : 's'} ago`;
}

export function formatRelativeTime(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;

  const diffSeconds = (now.getTime() - date.getTime()) / 1000;
  if (diffSeconds < 60) return 'Updated just now';

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return plural(diffMinutes, 'minute');

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return plural(diffHours, 'hour');

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return plural(diffDays, 'day');

  const diffMonths = Math.round(diffDays / 30);
  if (diffMonths < 12) return plural(diffMonths, 'month');

  const diffYears = Math.round(diffMonths / 12);
  return plural(diffYears, 'year');
}
