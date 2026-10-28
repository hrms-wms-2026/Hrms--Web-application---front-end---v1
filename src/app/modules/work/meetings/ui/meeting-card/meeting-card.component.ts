import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MeetingListItem, MeetingStatus } from '../../models/meeting.models';

const STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
};
const RESPONSE_LABELS: Record<string, string> = { accepted: 'Accepted', rejected: 'Declined', pending: 'Not answered' };

/**
 * A meeting on the board, the Work Tree (variant "row", with the "M" badge) or My Work. Its status is derived and it is
 * not a status column card: it is never draggable (spec 5.9). Clicking opens the occurrence by its key.
 */
@Component({
  selector: 'app-meeting-card',
  standalone: true,
  template: `
    <button type="button" data-testid="meeting-card" (click)="open.emit({ seriesId: item().seriesId, originalStart: item().originalStart })"
      class="flex w-full items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface-secondary)]"
      [class.flex-col]="variant() === 'card'" [class.items-start]="variant() === 'card'">
      <span class="flex w-full items-center gap-2">
        @if (variant() === 'row') {
          <span data-testid="meeting-card-badge" class="rounded bg-[var(--color-accent)] px-1 text-[10px] font-bold text-[var(--color-accent-contrast)]">M</span>
        }
        <span data-testid="meeting-card-title" class="truncate font-medium">{{ title() }}</span>
        <span data-testid="meeting-card-shortid" class="shrink-0 text-[var(--color-text-secondary)]">{{ item().shortId }}</span>
      </span>
      <span class="flex w-full items-center gap-2 text-[var(--color-text-secondary)]">
        <span>{{ time() }}</span>
        <span data-testid="meeting-card-status" [attr.data-status]="item().status"
          class="rounded-full bg-[var(--color-surface-secondary)] px-1.5">{{ statusLabel() }}</span>
        @if (item().myResponse) {
          <span data-testid="meeting-card-response">{{ responseLabel() }}</span>
        }
      </span>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingCardComponent {
  readonly item = input.required<MeetingListItem>();
  readonly variant = input<'card' | 'row'>('card');
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
}
