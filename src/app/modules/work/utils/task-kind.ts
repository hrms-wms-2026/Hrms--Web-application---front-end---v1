/**
 * A work item category's fixed type (Planner redesign, 2026-10-29). Category names are free text per project; the
 * backend stores this kind beside the name, and the UI colours, icons and groups by it. Meeting and Checklist belong to
 * system categories; users pick from the other five.
 */
export type TaskKind = 'task' | 'bug' | 'story' | 'feature' | 'testing' | 'meeting' | 'checklist';

export const TASK_KINDS: readonly TaskKind[] = ['task', 'bug', 'story', 'feature', 'testing', 'meeting', 'checklist'];
export const USER_SELECTABLE_KINDS: readonly TaskKind[] = ['task', 'bug', 'story', 'feature', 'testing'];

export interface TaskKindMeta {
  readonly label: string;
  /** SVG path data for a 24x24, stroke-drawn icon. */
  readonly icon: string;
  /** Text colour: the icon and accents. */
  readonly color: string;
  /** Light background: a tile, a block's fill. */
  readonly tint: string;
  /** Solid background: a block's left bar, a load segment. */
  readonly bar: string;
  /** The same colour as a hex value, for the icon picker and its tile. */
  readonly hex: string;
  /** The picker's stored value for this kind's look, shown until a category has its own icon. */
  readonly defaultIcon: string;
}

/** One source of truth for each kind's look. Full class strings, so Tailwind keeps them. */
export const KIND_META: Readonly<Record<TaskKind, TaskKindMeta>> = {
  task: {
    label: 'Task', color: 'text-teal-600', tint: 'bg-teal-50', bar: 'bg-teal-600', hex: '#0D9488', defaultIcon: 'lucide:square-check-big',
    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  },
  bug: {
    label: 'Bug', color: 'text-red-600', tint: 'bg-red-50', bar: 'bg-red-600', hex: '#DC2626', defaultIcon: 'lucide:bug',
    icon: 'M8 2l1.9 1.9M14.1 3.9 16 2M9 7.1v-1a3 3 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.5 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M21 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4',
  },
  story: {
    label: 'Story', color: 'text-violet-600', tint: 'bg-violet-50', bar: 'bg-violet-600', hex: '#7C3AED', defaultIcon: 'lucide:book-open',
    icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  },
  feature: {
    label: 'Feature', color: 'text-pink-600', tint: 'bg-pink-50', bar: 'bg-pink-600', hex: '#DB2777', defaultIcon: 'lucide:star',
    icon: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8l-6.2 3.3L7 14.2 2 9.3l6.9-1z',
  },
  testing: {
    label: 'Testing', color: 'text-cyan-600', tint: 'bg-cyan-50', bar: 'bg-cyan-600', hex: '#0891B2', defaultIcon: 'lucide:flask-conical',
    icon: 'M9 3h6M10 3v7.4L4.6 19.2A1.3 1.3 0 0 0 5.7 21h12.6a1.3 1.3 0 0 0 1.1-1.8L14 10.4V3M7.5 15h9',
  },
  meeting: {
    label: 'Meeting', color: 'text-blue-600', tint: 'bg-blue-50', bar: 'bg-blue-600', hex: '#2563EB', defaultIcon: 'lucide:calendar',
    icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  },
  checklist: {
    label: 'Checklist', color: 'text-slate-500', tint: 'bg-slate-100', bar: 'bg-slate-500', hex: '#64748B', defaultIcon: 'lucide:list-checks',
    icon: 'M3 17l2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8',
  },
};

/** A kind from the API; anything unknown or missing (an older API, no category) is a plain task. */
export function kindOf(value: string | null | undefined): TaskKind {
  return (TASK_KINDS as readonly string[]).includes(value ?? '') ? (value as TaskKind) : 'task';
}
