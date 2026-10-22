import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxActionDto, InboxItemDetailDto, InboxItemRef, sameRef } from '../../models/inbox.dto';
import { InboxKindsStore } from '../../state/inbox-kinds.store';
import { inboxIconTone, inboxTitle, inboxTypeMeta, isAlert } from '../../utils/inbox-item.util';
import { CaseSummaryComponent } from '../case-summary/case-summary.component';
import { InboxTypeIconComponent } from '../inbox-type-icon/inbox-type-icon.component';
import { LeaveRequestSummaryComponent } from '../leave-request-summary/leave-request-summary.component';

export interface CaseCardAction {
  ref: InboxItemRef;
  key: string;
}

/** Actions that open somewhere else, undo a decision or hand the case over stay in the details panel, not on the card. */
const CARD_HIDDEN_ACTIONS = new Set(['open_target', 'revert', 'escalate']);

/**
 * A request or alert inside a chat: what it is and when, and its actions, so it can be decided right in the chat; the
 * details are in the Ticket details panel. A card whose case is already resolved shows from the message alone and loads nothing.
 */
@Component({
  selector: 'app-case-card',
  standalone: true,
  imports: [DatePipe, CaseSummaryComponent, InboxTypeIconComponent, LeaveRequestSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cc" data-testid="case-card" [attr.data-tone]="cardTone()" [class.cc--selected]="selected()" [class.cc--resolved]="resolved()">
      <div class="cc__head">
        <button type="button" class="cc__open" data-testid="case-card-open" (click)="open.emit(ref())"
          [attr.aria-label]="'Open details of ' + heading()">
          @if (detail(); as d) {
            <app-inbox-type-icon class="cc__icon" [icon]="meta()!.icon" [tone]="iconTone()" />
          } @else {
            <app-inbox-type-icon class="cc__icon" icon="task" tone="neutral" />
          }
          <span class="cc__title">
            <span class="cc__name">{{ heading() }}</span>
            @if (detail(); as d) {
              <span class="cc__sub" data-testid="case-card-sub">{{ meta()!.label }} · {{ d.item.createdAt | date: 'MMM d, y, h:mm a' }}</span>
              @if (!alert() && d.item.subtitle) { <span class="cc__sub">{{ d.item.subtitle }}</span> }
            } @else if (resolved()) {
              <span class="cc__sub">Closed</span>
            } @else if (loading()) {
              <span class="cc__sub">Loading…</span>
            } @else if (error()) {
              <span class="cc__sub">{{ error() }}</span>
            }
          </span>
        </button>
        <!-- The actions sit in the heading row, just before the ⋮ menu. -->
        @if (detail() && actions().length > 0) {
          <div class="cc__actions">
            @for (a of actions(); track a.key) {
              <button type="button" [class]="'cc__btn cc__btn--' + a.tone" [attr.data-testid]="'case-card-action-' + a.key"
                [disabled]="busy()" (click)="action.emit({ ref: ref(), key: a.key })">{{ a.label }}</button>
            }
          </div>
        }
        <ng-content select="[caseMenu]" />
      </div>

      @if (detail(); as d) {
        <!-- The approver edits the requested changes on the card open in the details panel; otherwise the card is its heading row. -->
        @if (selected() && editable() && d.changeSet.length > 0) {
          @if (d.item.source === 'leave') {
            <app-leave-request-summary class="cc__editor" [changes]="d.changeSet" [editable]="true" [errors]="errors()"
              (editsChange)="editsChange.emit($event)" />
          } @else {
            <app-case-summary class="cc__editor" [changes]="d.changeSet" [editable]="true" [errors]="errors()"
              (editsChange)="editsChange.emit($event)" />
          }
        }
      }
    </article>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    /* No border: a soft tint of what it is - an open exception red, an open attendance alert amber, anything else gray. */
    .cc { --tone: var(--color-text-secondary); display: flex; flex-direction: column; gap: 10px; width: 100%; padding: 16px 18px; border-radius: 14px;
      background: color-mix(in srgb, var(--tone) 6%, var(--color-surface)); }
    .cc[data-tone="warning"] { --tone: var(--color-warning, #d97706); }
    .cc[data-tone="danger"] { --tone: var(--color-danger); }
    .cc[data-tone="warning"], .cc[data-tone="danger"] { background: color-mix(in srgb, var(--tone) 8%, var(--color-surface)); }
    .cc--selected { box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 45%, transparent); }
    .cc__head { display: flex; min-width: 0; align-items: center; gap: 10px; }
    .cc__open { display: flex; min-width: 0; flex: 1; align-items: center; gap: 16px; padding: 0; border: 0; background: none; color: var(--color-text-primary);
      font: inherit; text-align: left; cursor: pointer; }
    .cc__open:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; border-radius: 8px; }
    app-inbox-type-icon.cc__icon { width: 44px; height: 44px; border-radius: 50%; }
    .cc__title { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 3px; }
    .cc__name { overflow: hidden; font-size: 15px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .cc__open:hover .cc__name { color: var(--color-accent); }
    .cc__sub { color: var(--color-text-secondary); font-size: 13px; }
    .cc__editor { display: block; padding: 12px 14px; border-radius: 10px; background: var(--color-surface); }
    .cc__actions { display: flex; flex: none; gap: 8px; }
    .cc__btn { height: 36px; padding: 0 18px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .cc__btn:hover:not(:disabled) { border-color: var(--color-accent); }
    .cc__btn--primary { min-width: 108px; border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .cc__btn--danger { border-color: color-mix(in srgb, var(--color-danger) 45%, var(--color-border)); color: var(--color-danger); }
    .cc__btn:disabled { opacity: .55; cursor: default; }
    .cc__btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
  `]
})
export class CaseCardComponent {
  private readonly api = inject(InboxApiService);
  private readonly kinds = inject(InboxKindsStore);

  /** The request or alert. */
  ref = input.required<InboxItemRef>();
  /** Its title as it was posted, shown until (or instead of) the live detail. */
  title = input('');
  /** A "resolved" line follows the card: it shows from the message alone. */
  resolved = input(false);
  /** It is the case open in the details panel: the approver may edit the requested changes here. */
  selected = input(false);
  editable = input(false);
  errors = input<Record<string, string>>({});
  busy = input(false);
  /** Bumped by the host after an action, so the card reloads its status and actions. */
  version = input(0);

  open = output<InboxItemRef>();
  action = output<CaseCardAction>();
  editsChange = output<Record<string, string>>();

  /** "source:kind:id" - a string, so it only changes when the case does. */
  private readonly refKey = computed(() => `${this.ref().source}:${this.ref().kind}:${this.ref().id}`);
  protected readonly detail = signal<InboxItemDetailDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  private request = 0;

  protected readonly meta = computed(() => {
    const d = this.detail();
    return d ? inboxTypeMeta(d.item, this.kinds.descriptor(d.item.source, d.item.kind)) : null;
  });
  protected readonly heading = computed(() => {
    const d = this.detail();
    return d ? inboxTitle(d.item) : this.title() || 'Case';
  });
  protected readonly iconTone = computed(() => (this.detail() && this.meta() ? inboxIconTone(this.detail()!.item, this.meta()!) : 'neutral'));
  protected readonly alert = computed(() => !!this.detail() && isAlert(this.detail()!.item));
  /** Only an open alert or case is tinted; requests and closed items stay plain. */
  protected readonly cardTone = computed(() => {
    const d = this.detail();
    const tone = this.iconTone();
    return d && !this.resolved() && isAlert(d.item) && (tone === 'warning' || tone === 'danger') ? tone : 'neutral';
  });
  protected readonly actions = computed<InboxActionDto[]>(() =>
    (this.detail()?.item.availableActions ?? []).filter((a) => !CARD_HIDDEN_ACTIONS.has(a.key)));

  constructor() {
    // Keyed on the case's identity, not the ref object: a host that hands over an equal but new object on every
    // render must not trigger a reload each time (that looped into a request storm and HTTP 429s).
    effect(() => {
      this.refKey();
      const resolved = this.resolved();
      this.version();
      untracked(() => {
        if (!resolved) void this.load(this.ref());
      });
    });
    // The case changed somewhere (decided, escalated): refresh its status and actions.
    inject(InboxRealtimeService).inboxChanged$
      .pipe(filter((e) => sameRef(e.item, this.ref())), takeUntilDestroyed())
      .subscribe(() => void this.load(this.ref()));
    inject(DestroyRef).onDestroy(() => this.request++);
  }

  private async load(ref: InboxItemRef): Promise<void> {
    const mine = ++this.request;
    this.loading.set(true);
    this.error.set(null);
    try {
      const detail = await firstValueFrom(this.api.detail(ref));
      if (mine === this.request) this.detail.set(detail);
    } catch {
      if (mine === this.request && !this.detail()) this.error.set('Only the people on this case can see its details.');
    } finally {
      if (mine === this.request) this.loading.set(false);
    }
  }
}
