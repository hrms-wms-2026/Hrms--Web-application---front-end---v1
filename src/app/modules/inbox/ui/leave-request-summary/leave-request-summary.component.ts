import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { InboxChangeDto } from '../../models/inbox.dto';
import { fromLocalInput, toLocalInput } from '../inbox-change-set/inbox-change-set.component';

const DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

/** A leave request in its chat: one small card - leave type, when, hours (and the reason, if given). When the approver
 *  may change the dates, "Edit" opens From/To inputs; the edits go to the host, which sends them with Approve. */
@Component({
  selector: 'app-leave-request-summary',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lrs" data-testid="leave-request-summary">
      <div class="lrs__head">
        <span class="lrs__type">{{ value('leave_type') || 'Leave' }}</span>
        @if (editable() && !editing()) {
          <button type="button" class="lrs__edit" data-testid="leave-request-edit" (click)="editing.set(true)">
            Edit
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </button>
        }
      </div>
      <div class="lrs__when" data-testid="leave-request-when">
        {{ when() }}@if (hours()) { <span class="lrs__hours" data-testid="leave-request-hours">({{ hours() }})</span> }
      </div>
      @if (value('reason'); as reason) { <p class="lrs__reason">{{ reason }}</p> }

      @if (editing()) {
        <div class="lrs__form">
          <label class="lrs__field">From
            <input type="datetime-local" data-testid="inbox-edit-startAt" [value]="local('startAt')"
              (input)="set('startAt', $any($event.target).value)" />
          </label>
          @if (errors()['startAt']; as e) { <span class="lrs__error">{{ e }}</span> }
          <label class="lrs__field">To
            <input type="datetime-local" data-testid="inbox-edit-endAt" [value]="local('endAt')"
              (input)="set('endAt', $any($event.target).value)" />
          </label>
          @if (errors()['endAt']; as e) { <span class="lrs__error">{{ e }}</span> }
          <button type="button" class="lrs__edit" data-testid="leave-request-edit-reset" (click)="reset()">Undo changes</button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .lrs { display: flex; min-width: 240px; flex-direction: column; gap: 2px; }
    .lrs__type { color: var(--color-text-primary); font-size: 14px; font-weight: 650; }
    .lrs__when { color: var(--color-text-primary); font-size: 13px; }
    .lrs__head { display: flex; align-items: center; gap: 10px; }
    .lrs__hours { margin-left: 4px; color: var(--color-text-secondary); }
    .lrs__reason { margin: 4px 0 0; color: var(--color-text-secondary); font-size: 12px; overflow-wrap: anywhere; }
    .lrs__edit { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: var(--color-accent);
      font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .lrs__edit svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .lrs__edit:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .lrs__form { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border); }
    .lrs__field { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: var(--color-text-secondary); font-size: 12px; }
    .lrs__field input { height: 30px; padding: 0 8px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 12px; }
    .lrs__error { color: var(--color-danger); font-size: 11px; }
  `]
})
export class LeaveRequestSummaryComponent {
  /** The leave request's change set (leave_type, startAt, endAt, total/paid/unpaid hours, reason). */
  readonly changes = input<readonly InboxChangeDto[]>([]);
  /** The approver may change the dates before approving. */
  readonly editable = input(false);
  readonly errors = input<Record<string, string>>({});
  readonly editsChange = output<Record<string, string>>();

  protected readonly editing = signal(false);
  private readonly edits = signal<Record<string, string>>({});

  protected readonly when = computed(() => {
    const start = this.date('startAt');
    const end = this.date('endAt');
    if (!start || !end) return '—';
    const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, o).format(d);
    return start.toDateString() === end.toDateString()
      ? `${fmt(start, DAY)} · ${fmt(start, TIME)} – ${fmt(end, TIME)}`
      : `${fmt(start, DAY)}, ${fmt(start, TIME)} – ${fmt(end, DAY)}, ${fmt(end, TIME)}`;
  });

  /** "8 h · Paid", "8 h · Unpaid", or "8 h · 6 h paid, 2 h unpaid" when it is split. */
  protected readonly hours = computed(() => {
    const total = this.value('total_hours');
    if (!total) return '';
    const paid = Number(this.value('paid_hours') ?? 0);
    const unpaid = Number(this.value('unpaid_hours') ?? 0);
    const pay = unpaid <= 0 ? 'Paid' : paid <= 0 ? 'Unpaid' : `${paid} h paid, ${unpaid} h unpaid`;
    return `${total} h · ${pay}`;
  });

  constructor() {
    // A different request starts closed, with nothing edited.
    effect(() => {
      this.changes();
      untracked(() => {
        this.editing.set(false);
        this.edits.set({});
      });
    });
  }

  protected value(field: string): string | null {
    return this.edits()[field] ?? this.changes().find((c) => c.field === field)?.after ?? null;
  }

  protected local(field: string): string {
    return toLocalInput(this.value(field));
  }

  protected set(field: string, local: string): void {
    this.edits.update((e) => ({ ...e, [field]: fromLocalInput(local) }));
    this.editsChange.emit(this.edits());
  }

  protected reset(): void {
    this.edits.set({});
    this.editing.set(false);
    this.editsChange.emit({});
  }

  private date(field: string): Date | null {
    const v = this.value(field);
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  }
}
