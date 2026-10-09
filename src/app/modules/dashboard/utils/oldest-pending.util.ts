/** Compact "oldest waiting X" duration (My Team spec §8.2): "Xh" under a day, "Xd" otherwise. */
export function formatOldestWaiting(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;

  const diffMinutes = Math.max(0, (now.getTime() - date.getTime()) / 60_000);
  const diffHours = diffMinutes / 60;
  if (diffHours < 1) return 'oldest waiting <1h';
  if (diffHours < 24) return `oldest waiting ${Math.round(diffHours)}h`;
  return `oldest waiting ${Math.round(diffHours / 24)}d`;
}
