import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import { InboxRealtimeService } from '../../../../core/realtime/inbox-realtime.service';
import { ExceptionEvidenceResponse } from '../../../../shared/models/exception-evidence.model';
import { InboxApiService } from '../../data-access/inbox-api.service';
import { InboxActionDto, InboxItemDetailDto, InboxItemRef, sameRef } from '../../models/inbox.dto';
import { parseExtra } from '../../renderers/inbox-detail-renderers';
import { InboxKindsStore } from '../../state/inbox-kinds.store';
import { inboxIconTone, inboxStatusLabel, inboxStatusTone, inboxTitle, inboxTypeMeta } from '../../utils/inbox-item.util';
import { FaceEvidenceCardComponent } from '../face-evidence-card/face-evidence-card.component';
import { InboxChangeSetComponent } from '../inbox-change-set/inbox-change-set.component';
import { InboxTypeIconComponent } from '../inbox-type-icon/inbox-type-icon.component';
import { LeaveRequestSummaryComponent } from '../leave-request-summary/leave-request-summary.component';

export interface CaseCardAction {
  ref: InboxItemRef;
  key: string;
}

/** Actions that open somewhere else or undo a decision stay in the details panel, not on the card. */
const CARD_HIDDEN_ACTIONS = new Set(['open_target', 'revert']);

/**
 * A request or alert inside a chat: what it is, its status, its evidence (face checks, the requested leave or changes -
 * only what this viewer's own item detail includes) and its actions, so it can be decided right in the chat. A card
 * whose case is already resolved shows from the message alone and loads nothing.
 */
@Component({
  selector: 'app-case-card',
  standalone: true,
  imports: [DatePipe, FaceEvidenceCardComponent, InboxChangeSetComponent, InboxTypeIconComponent, LeaveRequestSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cc" data-testid="case-card" [class.cc--selected]="selected()" [class.cc--resolved]="resolved()">
      <button type="button" class="cc__head" data-testid="case-card-open" (click)="open.emit(ref())"
        [attr.aria-label]="'Open details of ' + heading()">
        @if (detail(); as d) {
          <app-inbox-type-icon [icon]="meta()!.icon" [tone]="iconTone()" />
        } @else {
          <app-inbox-type-icon icon="task" tone="neutral" />
        }
        <span class="cc__title">
          <span class="cc__name">{{ heading() }}</span>
          @if (detail(); as d) {
            <span class="cc__sub">{{ meta()!.label }} · {{ d.item.createdAt | date: 'MMM d, h:mm a' }}</span>
          }
        </span>
        @if (detail(); as d) {
          <span [class]="'cc__pill cc__pill--' + statusTone()" data-testid="case-card-status">{{ status() }}</span>
        } @else if (resolved()) {
          <span class="cc__pill cc__pill--neutral">Closed</span>
        }
      </button>

      @if (!resolved()) {
        @if (loading() && !detail()) {
          <p class="cc__quiet">Loading…</p>
        } @else if (error()) {
          <p class="cc__quiet">{{ error() }}</p>
        } @else if (detail(); as d) {
          @if (faceEvidence(); as ev) {
            <app-face-evidence-card [evidence]="ev" />
          } @else if (d.item.source === 'leave' && d.changeSet.length > 0) {
            <app-leave-request-summary [changes]="d.changeSet" [editable]="selected() && editable()" [errors]="errors()"
              (editsChange)="editsChange.emit($event)" />
          } @else if (d.changeSet.length > 0) {
            <app-inbox-change-set [changes]="d.changeSet" [editable]="selected() && editable()" [errors]="errors()"
              (editsChange)="editsChange.emit($event)" />
          } @else if (d.item.subtitle) {
            <p class="cc__text">{{ d.item.subtitle }}</p>
          }
          @if (actions().length > 0) {
            <div class="cc__actions">
              @for (a of actions(); track a.key) {
                <button type="button" [class]="'cc__btn cc__btn--' + a.tone" [attr.data-testid]="'case-card-action-' + a.key"
                  [disabled]="busy()" (click)="action.emit({ ref: ref(), key: a.key })">{{ a.label }}</button>
              }
            </div>
          }
        }
      }
    </article>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .cc { display: flex; flex-direction: column; gap: 10px; width: min(460px, 100%); padding: 12px; border: 1px solid var(--color-border);
      border-radius: 12px; background: var(--color-surface); }
    .cc--selected { border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-border)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 12%, transparent); }
    .cc--resolved { background: color-mix(in srgb, var(--color-surface-secondary) 50%, var(--color-surface)); }
    .cc__head { display: flex; width: 100%; min-width: 0; align-items: center; gap: 10px; padding: 0; border: 0; background: none; color: var(--color-text-primary);
      font: inherit; text-align: left; cursor: pointer; }
    .cc__head:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; border-radius: 8px; }
    .cc__title { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 1px; }
    .cc__name { overflow: hidden; font-size: 13px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .cc__head:hover .cc__name { color: var(--color-accent); }
    .cc__sub { color: var(--color-text-secondary); font-size: 12px; }
    .cc__pill { --tone: var(--color-accent); flex: 0 0 auto; padding: 2px 9px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent);
      color: var(--tone); font-size: 11px; font-weight: 650; white-space: nowrap; }
    .cc__pill--neutral { --tone: var(--color-text-secondary); }
    .cc__pill--warning { --tone: var(--color-warning, #d97706); }
    .cc__pill--danger { --tone: var(--color-danger); }
    .cc__pill--info { --tone: var(--color-purple, #7c3aed); }
    .cc__quiet, .cc__text { margin: 0; color: var(--color-text-secondary); font-size: 12px; }
    .cc__text { color: var(--color-text-primary); font-size: 13px; line-height: 1.45; }
    .cc__actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .cc__btn { height: 30px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .cc__btn:hover:not(:disabled) { border-color: var(--color-accent); }
    .cc__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
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
  protected readonly status = computed(() => (this.detail() ? inboxStatusLabel(this.detail()!.item) : ''));
  protected readonly statusTone = computed(() => (this.detail() ? inboxStatusTone(this.detail()!.item) : 'neutral'));
  protected readonly iconTone = computed(() => (this.detail() && this.meta() ? inboxIconTone(this.detail()!.item, this.meta()!) : 'neutral'));
  protected readonly actions = computed<InboxActionDto[]>(() =>
    (this.detail()?.item.availableActions ?? []).filter((a) => !CARD_HIDDEN_ACTIONS.has(a.key)));
  /** An identity case's face checks - present only in a reviewer's own detail. */
  protected readonly faceEvidence = computed<ExceptionEvidenceResponse | null>(() => {
    const d = this.detail();
    if (!d || this.kinds.descriptor(d.item.source, d.item.kind)?.detailRenderer !== 'exception-evidence') return null;
    return parseExtra(d.extraJson) as ExceptionEvidenceResponse | null;
  });

  constructor() {
    effect(() => {
      const ref = this.ref();
      const resolved = this.resolved();
      this.version();
      untracked(() => {
        if (!resolved) void this.load(ref);
      });
    });
    // The case changed somewhere (decided, escalated): refresh its status and actions.
    inject(InboxRealtimeService).inboxChanged$
      .pipe(filter((e) => sameRef(e.item, this.ref())), takeUntilDestroyed())
      .subscribe(() => { if (!this.resolved()) void this.load(this.ref()); });
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
      if (mine === this.request && !this.detail()) this.error.set('You can no longer see this case.');
    } finally {
      if (mine === this.request) this.loading.set(false);
    }
  }
}
