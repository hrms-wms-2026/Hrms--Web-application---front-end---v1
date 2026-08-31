export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
export type RecurrenceEndMode = 'never' | 'until';

export function buildRecurrenceRule(
  frequency: RecurrenceFrequency, endMode: RecurrenceEndMode, untilDate: string | null
): string | null {
  if (frequency === 'none') return null;
  const freqPart = `FREQ=${frequency.toUpperCase()}`;
  if (endMode === 'until' && untilDate) {
    return `${freqPart};UNTIL=${untilDate.replace(/-/g, '')}T235959Z`;
  }
  return freqPart;
}

export function describeRecurrence(
  frequency: RecurrenceFrequency, endMode: RecurrenceEndMode, untilDate: string | null
): string {
  if (frequency === 'none') return 'Does not repeat';
  const label = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  if (endMode === 'until' && untilDate) return `${label}, until ${untilDate}`;
  return label;
}
