import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { KeyboardClickDirective } from '../../../../../shared/directives/keyboard-click.directive';
import { EmployeeAvatarComponent } from '../../../ui/employee-avatar/employee-avatar.component';
import { MeetingListItem, MeetingStatus } from '../../models/meeting.models';

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const RESPONSE_LABELS: Record<string, string> = { accepted: 'Accepted', rejected: 'Declined', pending: 'Not answered' };

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A meeting among the tasks: a card in its board status column (variant "card") or a row in the Work Tree laid out like
 * a task row (variant "row"). Both carry the "M" badge. Its status follows the clock, so it is never draggable (D10).
 * Clicking opens the occurrence by its key.
 */
@Component({
  selector: 'app-meeting-card',
  standalone: true,
  imports: [KeyboardClickDirective, EmployeeAvatarComponent],
  template: `
    @if (variant() === 'row') {
      <div role="button" tabindex="0" appKeyboardClick data-testid="meeting-card" (click)="emitOpen()"
        class="grid w-full grid-cols-[1fr_112px_40px_88px_140px] items-center gap-3 rounded-md px-2 py-1.5 text-left cursor-pointer tree-row hover:bg-[var(--color-surface-secondary)]">
        <span data-testid="meeting-card-name-cell" class="flex min-w-0 items-center gap-1.5" [style.paddingLeft.px]="depth() * 20">
          <span class="h-4 w-4 shrink-0"></span>
          <span data-testid="meeting-card-badge" class="shrink-0 rounded bg-[var(--color-accent)] px-1 text-[10px] font-bold text-[var(--color-accent-contrast)]">M</span>
          <span data-testid="meeting-card-title" class="min-w-0 truncate text-sm text-[var(--color-text-primary)]">{{ title() }}</span>
          <span data-testid="meeting-card-shortid" class="shrink-0 text-xs text-[var(--color-text-secondary)]">{{ item().shortId }}</span>
          <span data-testid="meeting-card-status" [attr.data-status]="item().status"
            class="shrink-0 rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{{ statusLabel() }}</span>
        </span>
        <span class="truncate text-xs text-[var(--color-text-secondary)]">{{ clock() }}</span>
        <!-- The organiser sits in the task row's assignee column. -->
        <span data-testid="meeting-card-organizer" class="inline-flex shrink-0">
          @if (item().organizerEmployeeId; as id) {
            <app-employee-avatar [employeeId]="id" />
          } @else {
            <span class="text-xs text-[var(--color-text-secondary)]">—</span>
          }
        </span>
        <span data-testid="meeting-card-date" class="text-xs text-[var(--color-text-secondary)]">{{ date() }}</span>
        <span class="flex items-center justify-end gap-2 text-xs text-[var(--color-text-secondary)]">
          @if (item().myResponse) {
            <span data-testid="meeting-card-response">{{ responseLabel() }}</span>
          }
          <button type="button" data-testid="meeting-card-view" aria-label="View meeting" (click)="viewClicked($event)"
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </span>
      </div>
    } @else {
      <button type="button" data-testid="meeting-card" (click)="emitOpen()"
        class="flex w-full flex-col gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-left shadow-sm hover:border-[var(--color-accent)]">
        <span class="flex w-full items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
          <span data-testid="meeting-card-badge" class="rounded bg-[var(--color-accent)] px-1 text-[10px] font-bold text-[var(--color-accent-contrast)]">M</span>
          <span data-testid="meeting-card-shortid">{{ item().shortId }}</span>
        </span>
        <span data-testid="meeting-card-title" class="w-full truncate text-[13px] font-medium text-[var(--color-text-primary)]">{{ title() }}</span>
        <span class="flex w-full flex-wrap items-center gap-2 text-[11.5px] text-[var(--color-text-secondary)]">
          <span>{{ time() }}</span>
          <span data-testid="meeting-card-status" [attr.data-status]="item().status"
            class="rounded-full bg-[var(--color-surface-secondary)] px-1.5">{{ statusLabel() }}</span>
          @if (item().myResponse) {
            <span data-testid="meeting-card-response">{{ responseLabel() }}</span>
          }
        </span>
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingCardComponent {
  readonly item = input.required<MeetingListItem>();
  readonly variant = input<'card' | 'row'>('card');
  /** Tree depth of the row, indented like a task row at the same depth. */
  readonly depth = input(0);
  readonly open = output<{ seriesId: string; originalStart: string }>();

  /** Listing a private meeting implies a role; without one, show it as "Private meeting" rather than leak its title. */
  readonly title = computed(() => (this.item().isPrivate && !this.item().myRole ? 'Private meeting' : this.item().title));
  readonly statusLabel = computed(() => STATUS_LABELS[this.item().status]);
  readonly responseLabel = computed(() => RESPONSE_LABELS[this.item().myResponse ?? 'pending'] ?? 'Not answered');
  readonly time = computed(() => {
    const item = this.item();
    if (item.isAllDay) return 'All day';
    const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return day.format(new Date(item.startAt));
  });
  /** Start to end time for the tree row; the date sits in its own column. */
  readonly clock = computed(() => {
    const item = this.item();
    if (item.isAllDay) return 'All day';
    const format = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${format.format(new Date(item.startAt))} – ${format.format(new Date(item.endAt))}`;
  });
  /** The start's local date as YYYY-MM-DD, the form the task rows show their dates in. */
  readonly date = computed(() => {
    const start = new Date(this.item().startAt);
    return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
  });

  protected emitOpen(): void {
    this.open.emit({ seriesId: this.item().seriesId, originalStart: this.item().originalStart });
  }

  /** The eye opens the meeting too; it stops here so the row does not open it a second time. */
  protected viewClicked(event: Event): void {
    event.stopPropagation();
    this.emitOpen();
  }
}
