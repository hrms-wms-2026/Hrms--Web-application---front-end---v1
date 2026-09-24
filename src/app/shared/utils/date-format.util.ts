export interface TaskDueDateInfo {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
  tooltip: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const FULL_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function getTaskDueDateInfo(
  dueDate: Date | string | null | undefined,
  isCompleted: boolean = false,
  now: Date = new Date()
): TaskDueDateInfo | null {
  if (!dueDate) return null;

  const date = dueDate instanceof Date ? new Date(dueDate.getTime()) : new Date(dueDate);
  if (isNaN(date.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((target.getTime() - today.getTime()) / msPerDay);

  const isOverdue = !isCompleted && diffDays < 0;
  const isToday = diffDays === 0;

  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const isInCurrentWeek = target.getTime() >= startOfWeek.getTime() && target.getTime() <= endOfWeek.getTime();

  let label: string;
  if (diffDays === 0) {
    label = 'Today';
  } else if (diffDays === 1) {
    label = 'Tomorrow';
  } else if (diffDays === -1) {
    label = 'Yesterday';
  } else if (isInCurrentWeek) {
    label = WEEKDAYS[target.getDay()];
  } else {
    const month = MONTHS[target.getMonth()];
    const day = target.getDate();
    if (target.getFullYear() === today.getFullYear()) {
      label = `${month} ${day}`;
    } else {
      label = `${month} ${day}, ${target.getFullYear()}`;
    }
  }

  const tooltip = `${FULL_WEEKDAYS[target.getDay()]}, ${MONTHS[target.getMonth()]} ${target.getDate()}, ${target.getFullYear()}${isOverdue ? ' (Overdue)' : ''}`;

  return {
    label,
    isOverdue,
    isToday,
    tooltip
  };
}
