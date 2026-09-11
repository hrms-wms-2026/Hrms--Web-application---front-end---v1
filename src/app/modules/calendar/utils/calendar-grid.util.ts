export interface CalendarGridDay {
  readonly date: string; // 'YYYY-MM-DD'
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** month is 1-indexed (1 = January) to match this module's other date-string conventions. */
export function buildMonthGrid(year: number, month: number): readonly CalendarGridDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const jsDay = firstOfMonth.getDay(); // 0 = Sunday
  const daysBackToMonday = jsDay === 0 ? 6 : jsDay - 1;
  const gridStart = new Date(year, month - 1, 1 - daysBackToMonday);

  const todayStr = toDateString(new Date());
  const days: CalendarGridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dateStr = toDateString(cellDate);
    days.push({ date: dateStr, isCurrentMonth: cellDate.getMonth() === month - 1, isToday: dateStr === todayStr });
  }
  return days;
}
