import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { EmployeeUpcomingItem, EmployeeUpcomingKind } from '../../models/employee-overview.model';
import { formatEventTime, formatHours } from '../../utils/employee-overview.utils';

const KIND_LABELS: Record<EmployeeUpcomingKind, string> = {
  calendar: 'Calendar event',
  leave: 'Approved leave',
  release: 'Release'
};

/**
 * Read-only popup for one Upcoming item, shown over the Overview tab so the page is never left.
 * Everything it shows already arrived with the Upcoming response - no extra request.
 */
@Component({
  selector: 'app-upcoming-item-detail',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="item() !== null" [title]="item()?.title ?? ''" (closed)="closed.emit()">
      @if (item(); as it) {
        <div class="space-y-4 text-sm" data-testid="upcoming-detail">
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold" [class]="kindClass(it.kind)" data-testid="upcoming-detail-kind">
            {{ kindLabel(it.kind) }}
          </span>

          <dl class="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-3">
            <dt class="text-[var(--color-text-secondary)]">Date</dt>
            <dd class="font-medium text-[var(--color-text-primary)]" data-testid="upcoming-detail-date">{{ dateLine() }}</dd>

            <dt class="text-[var(--color-text-secondary)]">Time</dt>
            <dd class="font-medium text-[var(--color-text-primary)]" data-testid="upcoming-detail-time">{{ timeLine() }}</dd>

            @if (it.kind === 'calendar') {
              @if (it.detail) {
                <dt class="text-[var(--color-text-secondary)]">Location</dt>
                <dd class="text-[var(--color-text-primary)]">{{ it.detail }}</dd>
              }
              @if (safeMeetingLink(); as link) {
                <dt class="text-[var(--color-text-secondary)]">Meeting link</dt>
                <dd><a class="break-all font-semibold text-[var(--color-accent)] hover:underline" [href]="link" target="_blank" rel="noopener noreferrer" data-testid="upcoming-detail-link">Join meeting</a></dd>
              }
              @if (it.organizerName) {
                <dt class="text-[var(--color-text-secondary)]">Organizer</dt>
                <dd class="text-[var(--color-text-primary)]">{{ it.organizerName }}</dd>
              }
              @if (it.participants?.length) {
                <dt class="text-[var(--color-text-secondary)]">Participants</dt>
                <dd>
                  <ul class="flex flex-wrap gap-1.5" data-testid="upcoming-detail-participants">
                    @for (name of it.participants; track $index) {
                      <li class="rounded-full bg-[var(--color-surface-secondary)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-primary)]">{{ name }}</li>
                    }
                  </ul>
                </dd>
              }
            }
            @if (it.kind === 'leave') {
              <dt class="text-[var(--color-text-secondary)]">Status</dt>
              <dd class="font-medium text-[var(--color-success-text)]">Approved</dd>
              @if (it.hours !== null && it.hours !== undefined) {
                <dt class="text-[var(--color-text-secondary)]">Duration</dt>
                <dd class="text-[var(--color-text-primary)]" data-testid="upcoming-detail-hours">{{ hours(it.hours) }}</dd>
              }
            }
            @if (it.kind === 'release' && it.detail) {
              <dt class="text-[var(--color-text-secondary)]">Project</dt>
              <dd class="text-[var(--color-text-primary)]">{{ it.detail }}</dd>
            }
          </dl>

          @if (it.kind === 'calendar' && it.description) {
            <div class="border-t border-[var(--color-border)] pt-3">
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">Description</p>
              <p class="whitespace-pre-line text-[var(--color-text-primary)]" data-testid="upcoming-detail-description">{{ it.description }}</p>
            </div>
          }
        </div>
      }
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UpcomingItemDetailComponent {
  readonly item = input<EmployeeUpcomingItem | null>(null);
  readonly closed = output<void>();

  hours = formatHours;

  /** All-day items are read by their UTC date parts; timed events in the viewer's zone. */
  readonly dateLine = computed(() => {
    const it = this.item();
    if (!it) return '';
    const zone = it.isAllDay ? 'UTC' : undefined;
    const start = longDate(it.start, zone);
    if (it.isAllDay && it.end && it.end.slice(0, 10) !== it.start.slice(0, 10)) {
      return `${start} – ${longDate(it.end, zone)}`;
    }
    return start;
  });

  readonly timeLine = computed(() => {
    const it = this.item();
    if (!it) return '';
    if (it.isAllDay) return 'All day';
    const start = formatEventTime(it.start);
    return it.end ? `${start} – ${formatEventTime(it.end)}` : start;
  });

  /** Only http(s) links become clickable, so a stored javascript: URL can never run. */
  readonly safeMeetingLink = computed(() => {
    const link = this.item()?.meetingLink?.trim();
    return link && /^https?:\/\//i.test(link) ? link : null;
  });

  kindLabel(kind: EmployeeUpcomingKind): string {
    return KIND_LABELS[kind];
  }

  kindClass(kind: EmployeeUpcomingKind): string {
    return kind === 'leave' ? 'bg-[var(--color-success-subtle)] text-[var(--color-success-text)]' : kind === 'release' ? 'bg-[var(--color-cat-violet-subtle)] text-[var(--color-cat-violet)]' : 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]';
  }
}

function longDate(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone });
}
