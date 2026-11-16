import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarConflict, CalendarConflictKind } from '../../models/calendar-event.model';

const KIND_ORDER: Record<CalendarConflictKind, number> = { leave: 0, holiday: 1, outside_hours: 2, event: 3 };

const BUSY = 'Busy';
const HOLIDAY_PREFIX = 'Public holiday: ';
const NON_WORKING_DAY = 'Non-working day';
const OUTSIDE_HOURS = /^Outside working hours \((.+)\)$/;

/** "Ada" -> "Ada's", "James" -> "James'". */
function possessive(name: string): string {
  return name.endsWith('s') ? `${name}'` : `${name}'s`;
}

/**
 * One warning as a sentence about the person: "you" when it is the signed-in user, their name otherwise.
 * The backend sends a short label per kind (see ParticipantAvailabilityRules); an unknown label falls back
 * to "Name: label" so nothing is ever hidden.
 */
function sentence(c: CalendarConflict, isSelf: boolean): string {
  const name = c.employeeName;
  const title = c.conflictingEventTitle;
  switch (c.kind ?? 'event') {
    case 'leave':
      if (title === BUSY) return isSelf ? "You're busy" : `${name} is busy`;
      return isSelf ? "You're on leave" : `${name} is on leave`;
    case 'holiday': {
      const holiday = title.startsWith(HOLIDAY_PREFIX) ? title.slice(HOLIDAY_PREFIX.length) : title;
      return isSelf ? `It's a public holiday for you (${holiday})` : `It's a public holiday for ${name} (${holiday})`;
    }
    case 'outside_hours': {
      if (title === NON_WORKING_DAY) return isSelf ? 'This is your non-working day' : `It's ${possessive(name)} non-working day`;
      const hours = OUTSIDE_HOURS.exec(title)?.[1];
      if (hours) return isSelf ? `This is outside your working hours (${hours})` : `Outside ${possessive(name)} working hours (${hours})`;
      break;
    }
    case 'event':
      if (c.isBusyOnly || title === BUSY) return isSelf ? "You're busy" : `${name} is busy`;
      return isSelf ? `You have another meeting: ${title}` : `${name} has another meeting: ${title}`;
  }
  return `${isSelf ? 'You' : name}: ${title}`;
}

interface WarningRow {
  readonly key: string;
  readonly text: string;
}

/**
 * Who cannot make a meeting time and why: leave, a public holiday, outside working hours, or another meeting
 * (meeting availability warnings, 2026-10-28 design 4.3). Rows are grouped by person, leave first. Advisory only:
 * nothing here disables saving.
 */
@Component({
  selector: 'app-availability-warnings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="availability-warnings" class="flex flex-col gap-1 text-xs">
      @if (checking()) {
        <p data-testid="availability-checking" class="text-[var(--color-text-secondary)]">Checking availability…</p>
      } @else if (rows().length === 0) {
        <p data-testid="availability-clear" class="text-[var(--color-text-secondary)]">Everyone is available</p>
      }
      @if (rows().length > 0) {
        <div class="flex flex-col gap-1 rounded-md bg-[var(--color-warning-subtle)] p-2 text-[var(--color-warning-text)]" role="status">
          @for (row of rows(); track row.key) {
            <p data-testid="availability-row">{{ row.text }}</p>
          }
        </div>
      }
      @if (repeating()) {
        <p data-testid="availability-first-occurrence" class="text-[var(--color-text-secondary)]">Checked for the first occurrence</p>
      }
    </div>
  `,
})
export class AvailabilityWarningsComponent {
  private readonly auth = inject(AuthStore);

  readonly conflicts = input<readonly CalendarConflict[]>([]);
  readonly checking = input(false);
  readonly repeating = input(false);
  /** The zone the overlap times are shown in; the browser's zone when unset. */
  readonly timezone = input<string | null>(null);

  readonly rows = computed<readonly WarningRow[]>(() => {
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone() ?? undefined, hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const me = this.auth.employeeId()?.toLowerCase() ?? null;
    const isSelf = (c: CalendarConflict) => me !== null && c.employeeId.toLowerCase() === me;
    const people = [...new Set(this.conflicts().map((c) => c.employeeName))].sort((a, b) => a.localeCompare(b));
    return [...this.conflicts()]
      .map((c, index) => ({ c, index }))
      .sort((a, b) =>
        Number(isSelf(b.c)) - Number(isSelf(a.c))
        || people.indexOf(a.c.employeeName) - people.indexOf(b.c.employeeName)
        || KIND_ORDER[a.c.kind ?? 'event'] - KIND_ORDER[b.c.kind ?? 'event']
        || a.index - b.index)
      .map(({ c, index }) => ({
        key: `${index}:${c.employeeId}:${c.kind ?? 'event'}:${c.overlapStart}`,
        text: `${sentence(c, isSelf(c))} · ${format.format(new Date(c.overlapStart))}–${format.format(new Date(c.overlapEnd))}`,
      }));
  });
}
