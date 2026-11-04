import { WritableSignal } from '@angular/core';

/** The Planner create popover's tabs, in display order (2026-11-03 design). */
export type CreateTab = 'event' | 'meeting' | 'workItem' | 'timeOff';

export const CREATE_TAB_ORDER: readonly CreateTab[] = ['event', 'meeting', 'workItem', 'timeOff'];

export const CREATE_TAB_LABELS: Readonly<Record<CreateTab, string>> = {
  event: 'Event', meeting: 'Meeting', workItem: 'Work item', timeOff: 'Time off',
};

/** The picked time: local minutes on `date` in the planner's zone, and the same instants in UTC. */
export interface CreateSlot {
  date: string;
  startMinutes: number;
  endMinutes: number;
  startIso: string;
  endIso: string;
}

/** What every tab shares while the popover is open: switching tabs keeps them. */
export interface SharedCreateDraft {
  title: WritableSignal<string>;
  isAllDay: WritableSignal<boolean>;
}

/** "HH:mm" for minutes from local midnight; 24:00 stays "24:00" only in labels. */
export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
