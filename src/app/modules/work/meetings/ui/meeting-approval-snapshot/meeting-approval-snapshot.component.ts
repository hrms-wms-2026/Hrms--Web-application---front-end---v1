import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MeetingApprovalSnapshot } from '../../models/meeting.models';

const PLATFORMS: Record<string, string> = { microsoft_teams: 'Microsoft Teams', zoom: 'Zoom' };

/**
 * The body of a meeting.create / meeting.move approval (spec D5): exactly the snapshot frozen when the request was
 * submitted. Each row is picked from a fixed list, so nothing else in the payload - a link, attendance, action items -
 * can reach the approver.
 */
@Component({
  selector: 'app-meeting-approval-snapshot',
  standalone: true,
  template: `
    <dl data-testid="meeting-approval-snapshot" class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      @for (row of rows(); track row.label) {
        <dt data-testid="snapshot-label" class="text-[var(--color-text-secondary)]">{{ row.label }}</dt>
        <dd class="min-w-0 break-words">{{ row.value }}</dd>
      }
    </dl>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingApprovalSnapshotComponent {
  readonly snapshot = input.required<MeetingApprovalSnapshot>();

  readonly rows = computed(() => {
    const s = this.snapshot();
    const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
      .format(new Date(s.start));
    return [
      { label: 'Title', value: s.title },
      { label: 'Agenda', value: s.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '—' },
      { label: 'When', value: when },
      { label: 'Duration', value: `${s.durationMinutes} min` },
      { label: 'Time zone', value: s.timezone },
      { label: 'Repeats', value: s.recurrenceSummary },
      { label: 'Organizer', value: s.organizerName },
      { label: 'Module', value: s.modulePath },
      { label: 'Participants', value: s.participantNames.length > 0 ? s.participantNames.join(', ') : '—' },
      { label: 'Guests', value: s.guestEmails.length > 0 ? s.guestEmails.join(', ') : '—' },
      { label: 'Platform', value: s.platform ? PLATFORMS[s.platform] ?? s.platform : 'No online meeting' },
    ];
  });
}
