export interface WorkScheduleSettings {
  firstDayOfWeek?: number | null; // 1 = Monday ... 7 = Sunday
  standardWorkingDays?: readonly number[] | null; // e.g. [1, 2, 3, 4, 5]
}

/**
 * Calculates default sprint start and end dates based on the legal entity's
 * start work day (firstDayOfWeek / first configured working day) and the
 * finishing work day of that week from standardWorkingDays.
 *
 * Formats: YYYY-MM-DD.
 */
export function calculateUpcomingSprintDates(
  schedule?: WorkScheduleSettings | null,
  refDate: Date = new Date()
): { startDate: string; endDate: string } {
  const firstDayOfWeek = schedule?.firstDayOfWeek ?? 1; // Default: Monday (1)
  const rawWorkingDays =
    schedule?.standardWorkingDays && schedule.standardWorkingDays.length > 0
      ? [...schedule.standardWorkingDays]
      : [1, 2, 3, 4, 5];

  // JavaScript getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
  // ISO day: 1 = Mon, ..., 7 = Sun
  const currentIsoDay = refDate.getDay() === 0 ? 7 : refDate.getDay();

  // Determine start day:
  // If firstDayOfWeek is configured as a working day, use it; otherwise use the first working day.
  const startDay = rawWorkingDays.includes(firstDayOfWeek)
    ? firstDayOfWeek
    : rawWorkingDays[0];

  // Days until upcoming start work day.
  // If today is the start work day, sprint starts today (0 days).
  // Otherwise, starts on the next upcoming occurrence of startDay.
  const daysUntilStart = (startDay - currentIsoDay + 7) % 7;

  const startDateObj = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + daysUntilStart);

  // Finishing work day of that week:
  // Measure offset of each working day from startDay within that week's cycle (0 to 6 days).
  const offsets = rawWorkingDays.map((d) => (d - startDay + 7) % 7);
  const maxOffset = Math.max(...offsets, 0);

  const endDateObj = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate() + maxOffset);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return {
    startDate: format(startDateObj),
    endDate: format(endDateObj)
  };
}
