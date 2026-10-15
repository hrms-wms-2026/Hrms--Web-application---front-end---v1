import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InboxItemDetailDto } from '../models/inbox.dto';
import { RENDERER_STYLES, pick } from './renderer.util';

interface Warning { message: string }
interface CalendarConflict { title: string; startsAt: string | null; endsAt: string | null }

/** "leave-request": balance impact (before → after, paid/unpaid), warnings (notice, max consecutive, team absence),
 *  calendar conflicts, documents and the reason. The approver trail (forwarded / delegated rows) is in the steps. */
@Component({
  selector: 'app-leave-request-renderer',
  standalone: true,
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rnd">
      @if (balance(); as b) {
        <div class="rnd__label">Balance impact</div>
        <div class="rnd__box">
          <div class="rnd__row" data-testid="leave-balance"><span class="rnd__key">Balance</span><span class="rnd__value">{{ b.before }}h → {{ b.after }}h</span></div>
          @if (split(); as s) {
            <div class="rnd__row" data-testid="leave-split"><span class="rnd__key">This request</span><span class="rnd__value">{{ s.paid }}h paid · {{ s.unpaid }}h unpaid</span></div>
          }
        </div>
      } @else if (split(); as s) {
        <div class="rnd__box"><div class="rnd__row" data-testid="leave-split"><span class="rnd__key">This request</span><span class="rnd__value">{{ s.paid }}h paid · {{ s.unpaid }}h unpaid</span></div></div>
      }

      @if (warnings().length > 0 || teamAbsence() !== null) {
        <div class="rnd__label">Warnings</div>
        <ul class="rnd__list rnd__list--warn" data-testid="leave-warnings">
          @for (w of warnings(); track $index) { <li>{{ w.message }}</li> }
          @if (teamAbsence() !== null) { <li data-testid="leave-team-absence">{{ teamAbsence() }}% of the team is away on these days</li> }
        </ul>
      }

      @if (conflicts().length > 0) {
        <div class="rnd__label">Calendar conflicts</div>
        <ul class="rnd__list" data-testid="leave-conflicts">
          @for (c of conflicts(); track $index) {
            <li>{{ c.title }}@if (c.startsAt) { <span class="rnd__muted"> · {{ c.startsAt | date: 'MMM d, h:mm a' }}</span> }</li>
          }
        </ul>
      }

      @if (documentCount() > 0) {
        <p class="rnd__note" data-testid="leave-documents">{{ documentCount() }} {{ documentCount() === 1 ? 'document' : 'documents' }} attached</p>
      }
      @if (detail()?.explanation; as reason) {
        <div class="rnd__label">Reason</div>
        <p class="rnd__note" data-testid="leave-reason">{{ reason }}</p>
      }
    </div>
  `,
  styles: [RENDERER_STYLES]
})
export class LeaveRequestRendererComponent {
  extra = input<Record<string, unknown> | null>(null);
  detail = input<InboxItemDetailDto | null>(null);

  private readonly snapshot = computed(() => pick<Record<string, unknown>>(this.extra(), 'conflictSnapshot'));
  protected readonly balance = computed(() => {
    const row = this.detail()?.changeSet.find((c) => c.field === 'balance');
    return row && row.before !== null && row.after !== null ? { before: row.before, after: row.after } : null;
  });
  protected readonly split = computed(() => {
    const paid = pick<number>(this.extra(), 'paidHours');
    const unpaid = pick<number>(this.extra(), 'unpaidHours');
    return paid === null && unpaid === null ? null : { paid: paid ?? 0, unpaid: unpaid ?? 0 };
  });
  protected readonly warnings = computed<Warning[]>(() =>
    (pick<Record<string, unknown>[]>(this.snapshot(), 'warnings') ?? [])
      .map((w) => ({ message: String(pick(w, 'message') ?? '') })).filter((w) => w.message));
  protected readonly teamAbsence = computed(() => pick<number>(this.snapshot(), 'teamAbsencePercent'));
  protected readonly conflicts = computed<CalendarConflict[]>(() =>
    (pick<Record<string, unknown>[]>(this.snapshot(), 'calendarConflicts') ?? []).map((c) => ({
      title: String(pick(c, 'title') ?? 'Event'), startsAt: pick<string>(c, 'startsAt'), endsAt: pick<string>(c, 'endsAt')
    })));
  protected readonly documentCount = computed(() => pick<number>(this.extra(), 'documentCount') ?? 0);
}
