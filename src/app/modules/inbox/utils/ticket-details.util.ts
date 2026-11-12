import { InboxChangeDto, InboxItemDetailDto } from '../models/inbox.dto';
import { isAlert } from './inbox-item.util';

/** One line of a Ticket details section: an icon, a label and its value (amber when it is what went wrong). */
export interface TicketRow {
  key: string;
  label: string;
  value: string;
  icon: TicketRowIcon;
  tone?: 'warning';
}

export type TicketRowIcon = 'clock' | 'clock-in' | 'clock-out' | 'timer' | 'monitor' | 'calendar' | 'tag' | 'info';

/** What the Ticket details panel shows below its header, the same layout for every kind: a details box, the outcome,
 *  the employee's note. The approver's own note is not repeated here - it is on its step. */
export interface TicketSections {
  title: string;
  rows: TicketRow[];
  outcome: string | null;
  note: { label: string; text: string } | null;
}

/** Rows that are not details: the alert's own name, its day (in the header), the decision inputs and the notes. */
const HIDDEN_FIELDS = new Set(['signal', 'work_date', 'outcome', 'leaveTypeId', 'note', 'reason', 'comment']);

/** Attendance alert rows, in reading order: what was expected, what happened, by how much. */
const ATTENDANCE_ROWS: Record<string, { label: string; icon: TicketRowIcon; order: number; tone?: 'warning' }> = {
  expected_in: { label: 'Scheduled start', icon: 'clock', order: 0 },
  clock_in: { label: 'Actual clock-in', icon: 'clock-in', order: 1 },
  expected_out: { label: 'Scheduled end', icon: 'clock', order: 2 },
  clock_out: { label: 'Actual clock-out', icon: 'clock-out', order: 3 },
  minutes: { label: 'Delay', icon: 'timer', order: 4, tone: 'warning' },
  computer_on: { label: 'Computer on', icon: 'monitor', order: 5 }
};

const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const DATE_TIME: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' };

function formatDate(iso: string, options: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date.toLocaleString('en-US', options);
}

function hours(value: string | null): string | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? value : `${n} ${n === 1 ? 'hour' : 'hours'}`;
}

/** A change row's value as read: the option's label for a select, dates and hours formatted. */
export function changeValue(change: InboxChangeDto): string | null {
  const value = change.applied ?? change.after;
  if (value === null || value === '') return null;
  if (change.options?.length) return change.options.find((o) => o.value === value)?.label ?? value;
  switch (change.kind) {
    case 'datetime': return formatDate(value, DATE_TIME);
    case 'date': return formatDate(value, DATE);
    case 'hours': return hours(value);
    default: return value;
  }
}

/** "Approved on Oct 11, 2026, 10:00 AM" - the latest decided step of a request, or null while nobody has decided. */
export function decisionLine(detail: InboxItemDetailDto): string | null {
  const step = [...detail.steps].reverse()
    .find((s) => s.state === 'done' && s.at && /^(approved|rejected|cancelled|declined|accepted|resolved)/i.test(s.label));
  if (!step?.at) return null;
  const verb = step.label.split(/[\s(]/)[0];
  return `${verb} on ${formatDate(step.at, DATE_TIME)}`;
}

function attendanceSections(detail: InboxItemDetailDto): TicketSections {
  const rows = detail.changeSet
    .filter((c) => !HIDDEN_FIELDS.has(c.field))
    .map((c) => ({ change: c, spec: ATTENDANCE_ROWS[c.field] }))
    .sort((a, b) => (a.spec?.order ?? 99) - (b.spec?.order ?? 99))
    .flatMap(({ change, spec }) => {
      const value = changeValue(change);
      if (!value) return [];
      // An early clock-out is not a delay.
      const label = change.field === 'minutes' ? (change.label === 'Late by' ? 'Delay' : change.label) : spec?.label ?? change.label;
      return [{ key: change.field, label, value, icon: spec?.icon ?? 'info', tone: spec?.tone }];
    });
  const outcome = detail.changeSet.find((c) => c.field === 'outcome');
  const note = detail.changeSet.find((c) => c.field === 'note');
  return {
    title: 'Attendance details',
    rows,
    outcome: outcome ? changeValue(outcome) : null,
    note: note?.after ? { label: 'Note', text: note.after } : null
  };
}

function leaveSections(detail: InboxItemDetailDto): TicketSections {
  const row = (field: string) => detail.changeSet.find((c) => c.field === field) ?? null;
  const start = row('startAt');
  const end = row('endAt');
  const from = start ? start.applied ?? start.after : null;
  const to = end ? end.applied ?? end.after : null;
  const rows: TicketRow[] = [];
  const type = row('leave_type');
  if (type?.after) rows.push({ key: 'leave_type', label: 'Leave type', value: type.after, icon: 'tag' });
  if (from) {
    const first = formatDate(from, DATE);
    const last = to ? formatDate(to, DATE) : first;
    rows.push({ key: 'date', label: 'Date', value: first === last ? first : `${first} – ${last}`, icon: 'calendar' });
  }
  const duration = hours(row('total_hours')?.after ?? null);
  if (duration) rows.push({ key: 'duration', label: 'Duration', value: duration, icon: 'timer' });
  rows.push({ key: 'requested_on', label: 'Requested on', value: formatDate(detail.item.createdAt, DATE_TIME), icon: 'clock' });
  const decided = decisionLine(detail);
  if (decided) {
    const [verb, ...rest] = decided.split(' on ');
    rows.push({ key: 'decided_on', label: `${verb} on`, value: rest.join(' on '), icon: 'clock' });
  }
  const reason = row('reason')?.after;
  return { title: 'Request details', rows, outcome: null, note: reason ? { label: "Employee's note", text: reason } : null };
}

function genericSections(detail: InboxItemDetailDto): TicketSections {
  const rows = detail.changeSet
    .filter((c) => !HIDDEN_FIELDS.has(c.field))
    .flatMap((c) => {
      const value = changeValue(c);
      return value ? [{ key: c.field, label: c.label, value, icon: (c.kind === 'datetime' || c.kind === 'date' ? 'calendar' : 'info') as TicketRowIcon }] : [];
    });
  if (!isAlert(detail.item)) {
    rows.push({ key: 'requested_on', label: 'Requested on', value: formatDate(detail.item.createdAt, DATE_TIME), icon: 'clock' });
  }
  const note = detail.changeSet.find((c) => c.field === 'reason' || c.field === 'note' || c.field === 'comment');
  return {
    title: isAlert(detail.item) ? 'Details' : 'Request details',
    rows,
    outcome: null,
    note: note?.after ? { label: isAlert(detail.item) ? 'Note' : "Employee's note", text: note.after } : null
  };
}

/** Project monitor alert facts (the backend's explanationDetails), in reading order. Keys not listed here (ids, anything
 *  new) are not shown. */
const MONITOR_ROWS: Record<string, { label: string; icon: TicketRowIcon; format: (v: string) => string | null; tone?: 'warning' } | undefined> = {
  endDate: { label: 'Deadline', icon: 'calendar', format: (v) => isoDay(v) },
  dueDate: { label: 'Due date', icon: 'calendar', format: (v) => isoDay(v) },
  expectedFinish: { label: 'Expected finish', icon: 'calendar', format: (v) => isoDay(v), tone: 'warning' },
  lateDays: { label: 'Late by', icon: 'timer', format: (v) => count(v, 'working day', 'working days'), tone: 'warning' },
  remainingHours: { label: 'Work remaining', icon: 'timer', format: hours },
  demandHours: { label: 'Work due', icon: 'timer', format: hours },
  allocatedHours: { label: 'Allocated', icon: 'timer', format: hours },
  estimatedHours: { label: 'Estimate', icon: 'timer', format: hours },
  clockedHours: { label: 'Clocked', icon: 'clock', format: hours, tone: 'warning' },
  capacityHours: { label: 'Time available', icon: 'clock', format: hours },
  shortfallHours: { label: 'Short by', icon: 'timer', format: hours, tone: 'warning' },
  openTasks: { label: 'Open tasks', icon: 'tag', format: (v) => v },
  memberCount: { label: 'Team size', icon: 'info', format: (v) => count(v, 'person', 'people') }
};
const MONITOR_ORDER = Object.keys(MONITOR_ROWS);

/** What a monitor rule is about, from its action type ("monitor.module_capacity_shortfall" → Module). */
function monitorTargetLabel(actionType: string): string {
  if (actionType.includes('sprint_')) return 'Sprint';
  if (actionType.includes('module_')) return 'Milestone';
  return 'Task';
}

/** "2026-10-16" as Oct 16, 2026 - read as a calendar day, never shifted by the time zone. */
function isoDay(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-US', DATE) : value || null;
}

function count(value: string, one: string, many: string): string | null {
  const n = Number(value);
  return value === '' || isNaN(n) ? null : `${n} ${n === 1 ? one : many}`;
}

/** A project monitor alert: what it is about and the figures that tripped it. */
function monitorAlertSections(detail: InboxItemDetailDto): TicketSections {
  const item = detail.item;
  const rows: TicketRow[] = [];
  if (item.title) rows.push({ key: 'target', label: monitorTargetLabel(item.actionType), value: item.title, icon: 'tag' });
  if (item.contextName) rows.push({ key: 'project', label: 'Project', value: item.contextName, icon: 'tag' });
  const facts = detail.explanationDetails ?? {};
  for (const key of MONITOR_ORDER) {
    const spec = MONITOR_ROWS[key];
    const raw = facts[key];
    const value = spec && raw !== undefined ? spec.format(raw) : null;
    if (spec && value) rows.push({ key, label: spec.label, value, icon: spec.icon, tone: spec.tone });
  }
  return { title: 'Evidence & details', rows, outcome: null, note: null };
}

export function isMonitorAlert(detail: InboxItemDetailDto): boolean {
  return detail.item.source === 'work' && detail.item.kind === 'monitor_alert';
}

/** The Ticket details sections of one item - attendance alerts, leave and every other request share one layout. */
export function ticketSections(detail: InboxItemDetailDto): TicketSections {
  if (isMonitorAlert(detail)) return monitorAlertSections(detail);
  if (detail.item.source === 'attendance' && detail.item.kind === 'alert') return attendanceSections(detail);
  if (detail.item.source === 'leave') return leaveSections(detail);
  return genericSections(detail);
}
