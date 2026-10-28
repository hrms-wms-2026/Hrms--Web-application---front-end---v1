import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CalendarConflict, CalendarConflictKind } from '../../models/calendar-event.model';

const KIND_ORDER: Record<CalendarConflictKind, number> = { leave: 0, holiday: 1, outside_hours: 2, event: 3 };

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
  readonly conflicts = input<readonly CalendarConflict[]>([]);
  readonly checking = input(false);
  readonly repeating = input(false);
  /** The zone the overlap times are shown in; the browser's zone when unset. */
  readonly timezone = input<string | null>(null);

  readonly rows = computed<readonly WarningRow[]>(() => {
    const format = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone() ?? undefined, hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const people = [...new Set(this.conflicts().map((c) => c.employeeName))].sort((a, b) => a.localeCompare(b));
    return [...this.conflicts()]
      .map((c, index) => ({ c, index }))
      .sort((a, b) =>
        people.indexOf(a.c.employeeName) - people.indexOf(b.c.employeeName)
        || KIND_ORDER[a.c.kind ?? 'event'] - KIND_ORDER[b.c.kind ?? 'event']
        || a.index - b.index)
      .map(({ c, index }) => ({
        key: `${index}:${c.employeeId}:${c.kind ?? 'event'}:${c.overlapStart}`,
        text: `${c.employeeName}: ${c.conflictingEventTitle} · ${format.format(new Date(c.overlapStart))}–${format.format(new Date(c.overlapEnd))}`,
      }));
  });
}
