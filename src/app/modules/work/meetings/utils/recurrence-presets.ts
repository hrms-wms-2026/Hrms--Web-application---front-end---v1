// The repeat choices the meeting form offers, as RRULEs. Anything the presets don't produce reads back as "custom";
// the server validates every rule (meeting_recurrence_invalid).
export type RecurrencePreset = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

export const RECURRENCE_PRESET_LABELS: Record<RecurrencePreset, string> = {
  none: 'Does not repeat',
  daily: 'Every day',
  weekly: 'Every week on the start day',
  biweekly: 'Every 2 weeks on the start day',
  monthly: 'Every month on the start date',
  custom: 'Custom rule',
};

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** `startDate` is the wall-clock date (YYYY-MM-DD) in the meeting's zone, so the weekday never shifts with the browser's. */
function parts(startDate: string): { weekday: string; day: number } {
  const [y, m, d] = startDate.slice(0, 10).split('-').map(Number);
  return { weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()], day: d };
}

function toRule(preset: RecurrencePreset, startDate: string): string | null {
  const { weekday, day } = parts(startDate);
  switch (preset) {
    case 'daily': return 'FREQ=DAILY';
    case 'weekly': return `FREQ=WEEKLY;BYDAY=${weekday}`;
    case 'biweekly': return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${weekday}`;
    case 'monthly': return `FREQ=MONTHLY;BYMONTHDAY=${day}`;
    default: return null;
  }
}

function fromRule(rule: string | null): RecurrencePreset {
  if (!rule) return 'none';
  if (rule === 'FREQ=DAILY') return 'daily';
  if (/^FREQ=WEEKLY;BYDAY=(SU|MO|TU|WE|TH|FR|SA)$/.test(rule)) return 'weekly';
  if (/^FREQ=WEEKLY;INTERVAL=2;BYDAY=(SU|MO|TU|WE|TH|FR|SA)$/.test(rule)) return 'biweekly';
  if (/^FREQ=MONTHLY;BYMONTHDAY=\d{1,2}$/.test(rule)) return 'monthly';
  return 'custom';
}

export const recurrencePresets = { toRule, fromRule };
