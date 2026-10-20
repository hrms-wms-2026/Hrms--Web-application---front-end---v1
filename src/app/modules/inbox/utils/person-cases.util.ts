import { InboxItemDto, InboxPersonCaseDto, InboxPersonCaseMonthDto } from '../models/inbox.dto';

/** Sources whose tickets are about one person, so they carry that person's case history. Work and onboarding don't. */
export const PERSON_CASE_SOURCES: ReadonlySet<string> = new Set(['monitoring', 'calendar', 'attendance', 'leave']);

/** The person a ticket is about: the alert's employee or the request's requester. */
export function personCaseSubjectId(item: InboxItemDto): string | null {
  return item.requestedBy?.id ?? null;
}

/** [from, to) of a 1-based month at local midnight, as ISO strings. */
export function localMonthBounds(year: number, month: number): { from: string; to: string } {
  return { from: new Date(year, month - 1, 1).toISOString(), to: new Date(year, month, 1).toISOString() };
}

/** The ticket's local year and 1-based month. */
export function localYearMonth(iso: string): { year: number; month: number } {
  const date = new Date(iso);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** The month a ticket belongs to in the history: an attendance alert is about its work day (it is often detected
 *  days later, in a batch), every other ticket about when it was raised - the same dates the server buckets by. */
export function personCaseMonthOf(item: InboxItemDto): { year: number; month: number } {
  const workDate = item.source === 'attendance' && item.kind === 'alert' ? item.facets['work_date']?.[0] : undefined;
  const day = workDate ? /^(\d{4})-(\d{2})-\d{2}$/.exec(workDate) : null;
  return day ? { year: Number(day[1]), month: Number(day[2]) } : localYearMonth(item.createdAt);
}

/** Minutes east of UTC, as the server expects (Date#getTimezoneOffset is west-positive). */
export function localOffsetMinutes(at: Date = new Date()): number {
  return -at.getTimezoneOffset();
}

function sameRef(a: InboxItemDto, b: InboxItemDto): boolean {
  return a.source === b.source && a.kind === b.kind && a.id === b.id;
}

function sameType(a: InboxItemDto, b: InboxItemDto): boolean {
  return a.source === b.source && a.kind === b.kind && a.actionType === b.actionType;
}

/** Without the current ticket; the same type as the current ticket first, then the rest, each newest first. */
export function orderPersonCases(cases: InboxPersonCaseDto[], current: InboxItemDto): InboxPersonCaseDto[] {
  const newest = (a: InboxPersonCaseDto, b: InboxPersonCaseDto) => Date.parse(b.item.createdAt) - Date.parse(a.item.createdAt);
  const others = cases.filter((c) => !sameRef(c.item, current));
  return [
    ...others.filter((c) => sameType(c.item, current)).sort(newest),
    ...others.filter((c) => !sameType(c.item, current)).sort(newest)
  ];
}

/** Cancelled requests read as muted. Every alert counts, so no alert is muted. */
export function isMutedPersonCase(item: InboxItemDto): boolean {
  return item.category === 'request' && item.status === 'cancelled';
}

/** Months of `year` that hold history other than the current ticket itself. */
export function redDotMonths(months: InboxPersonCaseMonthDto[], year: number, current: InboxItemDto): Set<number> {
  const at = personCaseMonthOf(current);
  const countsCurrent = at.year === year && !isMutedPersonCase(current);
  return new Set(months
    .filter((m) => m.count - (countsCurrent && m.month === at.month ? 1 : 0) > 0)
    .map((m) => m.month));
}
