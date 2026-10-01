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
            <dt class="text-slate-500">Date</dt>
            <dd class="font-medium text-slate-900" data-testid="upcoming-detail-date">{{ dateLine() }}</dd>

            <dt class="text-slate-500">Time</dt>
            <dd class="font-medium text-slate-900" data-testid="upcoming-detail-time">{{ timeLine() }}</dd>

            @if (it.kind === 'calendar') {
              @if (it.detail) {
                <dt class="text-slate-500">Location</dt>
                <dd class="text-slate-900">{{ it.detail }}</dd>
              }
              @if (safeMeetingLink(); as link) {
                <dt class="text-slate-500">Meeting link</dt>
                <dd><a class="break-all font-semibold text-blue-600 hover:underline" [href]="link" target="_blank" rel="noopener noreferrer" data-testid="upcoming-detail-link">Join meeting</a></dd>
              }
              @if (it.organizerName) {
                <dt class="text-slate-500">Organizer</dt>
                <dd class="text-slate-900">{{ it.organizerName }}</dd>
              }
              @if (it.participants?.length) {
                <dt class="text-slate-500">Participants</dt>
                <dd>
                  <ul class="flex flex-wrap gap-1.5" data-testid="upcoming-detail-participants">
                    @for (name of it.participants; track $index) {
                      <li class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">{{ name }}</li>
                    }
                  </ul>
                </dd>
              }
            }
            @if (it.kind === 'leave') {
              <dt class="text-slate-500">Status</dt>
              <dd class="font-medium text-emerald-700">Approved</dd>
              @if (it.hours !== null && it.hours !== undefined) {
                <dt class="text-slate-500">Duration</dt>
                <dd class="text-slate-900" data-testid="upcoming-detail-hours">{{ hours(it.hours) }}</dd>
              }
            }
            @if (it.kind === 'release' && it.detail) {
              <dt class="text-slate-500">Project</dt>
              <dd class="text-slate-900">{{ it.detail }}</dd>
            }
          </dl>

          @if (it.kind === 'calendar' && it.description) {
            <div class="border-t border-slate-100 pt-3">
              <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
              <p class="whitespace-pre-line text-slate-700" data-testid="upcoming-detail-description">{{ it.description }}</p>
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
    return kind === 'leave' ? 'bg-emerald-50 text-emerald-700' : kind === 'release' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700';
  }
}

function longDate(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone });
}
