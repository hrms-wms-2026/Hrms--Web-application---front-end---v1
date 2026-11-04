import { PlannerPersonDay } from '../../work/planner/models/team-planner.models';

/** How full a person's day is (team planner, 2026-11-03): the approved heatmap's colour steps. */
export type LoadBand = 'leave' | 'none' | 'under' | 'mid' | 'full' | 'over';

export const LOAD_BAND_COLORS: Readonly<Record<LoadBand, { bg: string; fg: string }>> = {
  leave: { bg: '#fde68a', fg: '#78350f' },
  none: { bg: '#f4f4f5', fg: '#3f3f46' },
  under: { bg: '#dbeafe', fg: '#1e3a8a' },
  mid: { bg: '#93c5fd', fg: '#1e3a8a' },
  full: { bg: '#1d4ed8', fg: '#ffffff' },
  over: { bg: '#c2410c', fg: '#ffffff' },
};

/** Leave first, then empty, then the share of capacity; any load on a day with no capacity is over. */
export function loadBand(loadMinutes: number, capacityMinutes: number, onLeave: boolean): LoadBand {
  if (onLeave) return 'leave';
  if (loadMinutes <= 0) return 'none';
  if (capacityMinutes <= 0) return 'over';
  const pct = (loadMinutes / capacityMinutes) * 100;
  if (pct < 50) return 'under';
  if (pct < 90) return 'mid';
  if (pct <= 100) return 'full';
  return 'over';
}

/** Planned task blocks plus meetings that count. */
export function dayLoad(day: PlannerPersonDay): number {
  return day.blockMinutes + day.meetingMinutes;
}

/** "6h", "7.5h" for whole and half hours, "6h 40m" otherwise, "—" for nothing. */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (Number.isInteger(hours * 2)) return `${hours}h`;
  return `${Math.floor(hours)}h ${minutes % 60}m`;
}
