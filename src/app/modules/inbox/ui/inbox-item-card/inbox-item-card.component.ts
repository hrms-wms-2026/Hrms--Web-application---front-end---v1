import { DatePipe, KeyValuePipe, NgComponentOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { LeaveCancelChoice, LeaveCancelConfirmDialogComponent } from '../../../../shared/ui/leave-cancel-confirm-dialog/leave-cancel-confirm-dialog.component';
import {
  InboxActionBody,
  InboxActionDto,
  InboxCapability,
  InboxItemDetailDto,
  InboxKindDescriptorDto,
  InboxTargetDto,
  hasCapability
} from '../../models/inbox.dto';
import { InboxDetailRendererRegistry, parseExtra } from '../../renderers/inbox-detail-renderers';
import { inboxStatusLabel, inboxStatusTone, inboxSubtitle, inboxTitle, inboxTypeMeta, isAlert, isWorkActionType } from '../../utils/inbox-item.util';
import { InboxEscalateDialogComponent } from '../inbox-action-dialogs/inbox-escalate-dialog.component';
import { InboxOutcomeChoice, InboxOutcomeDialogComponent } from '../inbox-action-dialogs/inbox-outcome-dialog.component';
import { buildEditedPayload, validateEdits } from '../inbox-change-set/inbox-change-set.component';
import { InboxCommentDialogComponent } from '../inbox-comment-dialog/inbox-comment-dialog.component';
import { InboxRevertBannerComponent } from '../inbox-revert-banner/inbox-revert-banner.component';
import { InboxStepsComponent } from '../inbox-steps/inbox-steps.component';
import { TicketParticipantsComponent } from '../ticket-participants/ticket-participants.component';
import { InboxTypeIconComponent } from '../inbox-type-icon/inbox-type-icon.component';

export interface InboxCardAction {
  key: string;
  body: InboxActionBody;
}

/** "Open" is navigation, not a server action - it is the card's target link. */
const NAVIGATION_ACTIONS = new Set(['open_target']);

/** The Ticket details panel of one inbox item: summary, details, steps, additional information (the kind's detail
 *  renderer), changes, a collapsible explanation and the action bar at the bottom. Built only from the item's
 *  AvailableActions and the kind descriptor, so a viewer without a decision sees no buttons and nothing editable;
 *  each action key opens its standard dialog. */
@Component({
  selector: 'app-inbox-item-card',
  standalone: true,
  imports: [
    DatePipe, KeyValuePipe, NgComponentOutlet, AvatarComponent, ConfirmModalComponent, TicketParticipantsComponent,
    InboxCommentDialogComponent, InboxEscalateDialogComponent, InboxOutcomeDialogComponent,
    InboxRevertBannerComponent, InboxStepsComponent, InboxTypeIconComponent, LeaveCancelConfirmDialogComponent
  ],
  host: { class: 'block h-full min-w-0' },
  template: `
    <aside class="card" data-testid="inbox-card" aria-label="Ticket details">
      <header class="card__top">
        <h2 class="card__heading">Ticket details</h2>
        <button type="button" class="card__hide" data-testid="inbox-card-hide" aria-label="Hide ticket details" (click)="hide.emit()">
          Hide
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      </header>
      @if (loading() && !detail()) {
        <p class="card__muted">Loading…</p>
      } @else if (!detail()) {
        @if (error()) { <p class="card__error card__error--pad" role="alert">{{ error() }}</p> }
      } @else {
        @let d = detail()!;
        @let item = d.item;
        <div class="card__scroll scroll-fade">
          <div [class]="'card__summary card__summary--' + meta().tone">
            <app-inbox-type-icon class="card__type-tile" [icon]="meta().icon" [tone]="meta().tone" />
            <div class="card__summary-text">
              <div class="card__eyebrow">{{ eyebrow() }}</div>
              <h3 class="card__title" data-testid="inbox-card-title">{{ title() }}</h3>
              @if (subtitle()) { <p class="card__subtitle">{{ subtitle() }}</p> }
            </div>
          </div>

          @if (error()) { <p class="card__error" role="alert">{{ error() }}</p> }
          @if (revertUntil(); as until) {
            <app-inbox-revert-banner [until]="until" [busy]="busy()" (undo)="revertOpen.set(true)" />
          }

          <dl class="card__rows">
            <div class="card__row"><dt>Status</dt>
              <dd><span data-testid="inbox-card-status" [class]="'card__pill card__pill--' + statusTone()">{{ statusText() }}</span></dd></div>
            <div class="card__row"><dt>Type</dt><dd><span [class]="'card__pill card__pill--' + meta().tone">{{ meta().label }}</span></dd></div>
            @if (item.contextType === 'project') {
              <div class="card__row"><dt>Project</dt><dd data-testid="inbox-card-project">{{ item.contextName ?? '—' }}</dd></div>
            }
            @if (item.requestedBy) {
              <div class="card__row"><dt>Requested by</dt>
                <dd class="card__person"><app-avatar [userName]="item.requestedBy.name" size="xs" /><span class="truncate">{{ item.requestedBy.name }}</span></dd></div>
            }
            @if (item.requestedTo) {
              <div class="card__row"><dt>{{ item.kind === 'invitation' ? 'Invitee' : 'Requested to' }}</dt>
                <dd class="card__person"><app-avatar [userName]="item.requestedTo.name" size="xs" /><span class="truncate">{{ item.requestedTo.name }}</span></dd></div>
            }
            <div class="card__row"><dt>{{ alert() ? 'Detected' : 'Requested on' }}</dt><dd>{{ item.createdAt | date: 'MMM d, y h:mm a' }}</dd></div>
            @if (item.severity) {
              <div class="card__row"><dt>Severity</dt>
                <dd><span [class]="'card__pill card__capitalize card__pill--' + severityTone()">{{ item.severity }}</span></dd></div>
            }
          </dl>
          @if (d.target; as target) {
            <button type="button" class="card__link" data-testid="inbox-card-open-target" (click)="openTarget.emit(target)">
              {{ target.label }}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
            </button>
          }

          @if (descriptor()?.detailRenderer === 'leave-request') {
            <!-- Leave: dates, hours and reason already show in the conversation card. -->
          } @else if (renderer(); as r) {
            <section class="card__section" data-testid="inbox-card-renderer">
              @if (descriptor()?.detailRenderer !== 'exception-evidence') { <h4 class="card__label">Additional information</h4> }
              <ng-container *ngComponentOutlet="r; inputs: { extra: extra(), detail: d }" />
            </section>
          } @else if (d.explanationDetails; as details) {
            <section class="card__section">
              <h4 class="card__label">Additional information</h4>
              <dl class="card__rows" data-testid="inbox-card-details">
                @for (entry of details | keyvalue; track entry.key) {
                  <div class="card__row"><dt>{{ humanize(entry.key) }}</dt><dd>{{ entry.value }}</dd></div>
                }
              </dl>
            </section>
          }

          @if (actionError() && actionErrorInline()) {
            <p class="card__error" role="alert" data-testid="inbox-card-inline-error">{{ actionError() }}</p>
          }

          <app-ticket-participants [requesterId]="item.requestedBy?.id ?? null" />

          <section class="card__section" data-testid="inbox-card-steps">
            <h4 class="card__label">{{ alert() ? 'Alert steps' : 'Request steps' }}</h4>
            <app-inbox-steps [steps]="d.steps" />
          </section>
        </div>

        @if (actionError() && !actionErrorInline()) {
          <p class="card__error card__error--footer" role="alert" data-testid="inbox-card-action-error">{{ actionError() }}</p>
        }
        @if (actions().length > 0) {
          <footer class="card__footer" data-testid="inbox-card-footer">
            @for (a of actions(); track a.key) {
              <button type="button" [class]="'card__btn card__btn--' + a.tone" [attr.data-testid]="'inbox-action-' + a.key"
                [attr.title]="a.label" [disabled]="busy()" (click)="onAction(a)">{{ a.label }}</button>
            }
          </footer>
        }

        <app-inbox-comment-dialog
          [open]="commentAction() !== null"
          [title]="(commentAction()?.label ?? '') + '?'"
          [confirmLabel]="commentAction()?.label ?? ''"
          (confirmed)="onCommentConfirmed($event)"
          (closed)="commentAction.set(null)"
        />
        <app-inbox-outcome-dialog
          [open]="dialog()?.kind === 'outcome'"
          [title]="(dialog()?.action?.label ?? 'Resolve')"
          [confirmLabel]="dialog()?.action?.label ?? 'Resolve'"
          [outcomes]="outcomes()"
          [leaveTypes]="leaveTypes()"
          [leaveHint]="leaveTypes().length > 0
            ? 'The balance, notice and other leave rules are checked when the leave is created; it is approved straight away.'
            : 'This employee has no leave type to convert to this year.'"
          (confirmed)="onOutcomeConfirmed($event)"
          (closed)="dialog.set(null)"
        />
        @if (dialog()?.kind === 'leave-cancel' && leaveRange(); as range) {
          <app-leave-cancel-confirm-dialog
            [open]="true"
            [leaveTypeName]="title()"
            [startAt]="range.start"
            [endAt]="range.end"
            [totalHours]="range.hours"
            [status]="d.item.status"
            [requireReason]="dialog()?.action?.needsComment ?? false"
            [cancelling]="busy()"
            (confirmed)="onLeaveCancel($event)"
            (closed)="dialog.set(null)"
          />
        }
        <app-inbox-escalate-dialog
          [open]="dialog()?.kind === 'escalate'"
          [escalateTo]="dialog()?.action?.meta?.['escalateTo'] ?? null"
          (confirmed)="onDialogComment($event)"
          (closed)="dialog.set(null)"
        />
        <app-confirm-modal
          [open]="revertOpen()"
          title="Revert this decision?"
          message="The decision will be undone and the request reopens for a new decision."
          confirmLabel="Revert"
          (confirmed)="onRevertConfirmed()"
          (cancelled)="revertOpen.set(false)"
        />
      }
    </aside>
  `,
  styles: [`
    .card { position: relative; display: flex; height: 100%; overflow: hidden; flex-direction: column; color: var(--color-text-primary); }
    .card__top { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 18px; border-bottom: 1px solid var(--color-border); }
    .card__heading { margin: 0; font-size: 14px; font-weight: 650; }
    .card__hide { display: inline-flex; align-items: center; gap: 2px; padding: 4px 6px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .card__hide:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .card__hide svg, .card__link svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .card__scroll { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 18px; overflow-x: hidden; overflow-y: auto; padding: 16px 18px; }
    .card__summary { --tone: var(--color-accent); display: flex; align-items: flex-start; gap: 12px; padding: 12px; border-radius: 12px; background: color-mix(in srgb, var(--tone) 8%, var(--color-surface)); }
    .card__summary--neutral { --tone: var(--color-text-secondary); }
    .card__summary--warning { --tone: var(--color-warning, #d97706); }
    .card__summary--danger { --tone: var(--color-danger); }
    .card__type-tile { width: 36px; height: 36px; border-radius: 10px; }
    .card__summary-text { min-width: 0; flex: 1; }
    .card__eyebrow { margin-bottom: 2px; color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .card__title { margin: 0; font-size: 14px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
    .card__subtitle { margin: 3px 0 0; color: var(--color-text-secondary); font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
    .card__muted { margin: 0; padding: 24px 18px; color: var(--color-text-secondary); font-size: 13px; }
    .card__error { margin: 0; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 8%, transparent); color: var(--color-danger); font-size: 12px; }
    .card__error--pad { margin: 16px 18px; }
    .card__error--footer { margin: 0 18px 8px; }
    .card__section { display: flex; flex-direction: column; }
    .card__label { margin: 0 0 10px; color: var(--color-text-primary); font-size: 13px; font-weight: 650; }
    .card__rows { display: flex; flex-direction: column; gap: 10px; margin: 0; font-size: 13px; }
    .card__row { display: grid; min-width: 0; grid-template-columns: minmax(96px, 40%) minmax(0, 1fr); align-items: center; gap: 12px; }
    .card__row dt { color: var(--color-text-secondary); }
    .card__row dd { min-width: 0; margin: 0; overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .card__capitalize { text-transform: capitalize; }
    .card__person { display: inline-flex; align-items: center; gap: 6px; }
    .card__link { display: inline-flex; align-self: flex-start; align-items: center; gap: 4px; margin-top: -8px; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .card__hide:focus-visible, .card__link:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .card__footer { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .card__btn { flex: 1 1 auto; min-width: 84px; max-width: 100%; height: 34px; padding: 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .card__btn:hover:not(:disabled) { background: var(--color-surface-secondary); }
    .card__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .card__btn--primary:hover:not(:disabled) { background: var(--color-accent); filter: brightness(.95); }
    .card__btn--danger { border-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-border)); color: var(--color-danger); }
    .card__btn:disabled { opacity: .55; cursor: default; }
    .card__btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .card__pill { --tone: var(--color-accent); display: inline-flex; max-width: 100%; align-items: center; padding: 2px 10px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .card__pill--neutral { --tone: var(--color-text-secondary); }
    .card__pill--warning { --tone: var(--color-warning, #d97706); }
    .card__pill--danger { --tone: var(--color-danger); }
  `]
})
export class InboxItemCardComponent {
  detail = input<InboxItemDetailDto | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  busy = input(false);
  actionError = input<string | null>(null);
  /** The action error is a validation message about the edited values (422): shown above the form. */
  actionErrorInline = input(false);
  /** The item's kind from the registry (GET /inbox/kinds); null while unknown. */
  descriptor = input<InboxKindDescriptorDto | null>(null);

  /** The Hide button: the page collapses the details panel (the chat takes the space). */
  hide = output<void>();
  action = output<InboxCardAction>();
  openTarget = output<InboxTargetDto>();

  private readonly renderers = inject(InboxDetailRendererRegistry);

  /** The approver's edits to the requested changes - made in the chat's "Requested changes" message (setEdits). */
  protected readonly edits = signal<Record<string, string>>({});
  /** Per-field problems found on approve; the chat's changes message shows them. */
  readonly editErrors = signal<Record<string, string>>({});
  protected readonly commentAction = signal<InboxActionDto | null>(null);
  protected readonly revertOpen = signal(false);
  /** The explanation starts collapsed and stays as the reader left it across tickets. */
  protected readonly dialog = signal<{ kind: 'outcome' | 'escalate' | 'leave-cancel'; action: InboxActionDto } | null>(null);

  protected readonly item = computed(() => this.detail()?.item ?? null);
  protected readonly alert = computed(() => !!this.item() && isAlert(this.item()!));
  protected readonly meta = computed(() => this.item()
    ? inboxTypeMeta(this.item()!, this.descriptor())
    : { label: '', tone: 'neutral' as const, icon: 'task' });
  /** WM request types read "Task Update Request"; registry labels ("Leave request") are used as they are. */
  protected readonly eyebrow = computed(() => {
    const item = this.item();
    return item && !this.alert() && isWorkActionType(item) ? `${this.meta().label} Request` : this.meta().label;
  });
  protected readonly title = computed(() => this.item() ? inboxTitle(this.item()!) : '');
  protected readonly subtitle = computed(() => this.item() ? inboxSubtitle(this.item()!) : '');
  protected readonly statusText = computed(() => this.item() ? inboxStatusLabel(this.item()!) : '');
  protected readonly statusTone = computed(() => this.item() ? inboxStatusTone(this.item()!) : 'neutral');
  protected readonly severityTone = computed(() => {
    const severity = this.item()?.severity?.toLowerCase();
    return severity === 'high' || severity === 'critical' ? 'danger' : severity === 'medium' ? 'warning' : 'neutral';
  });
  /** The revert window's end when the item offers a timed undo (shown as the banner, not a button). */
  protected readonly revertUntil = computed(() =>
    this.item()?.availableActions.find((a) => a.key === 'revert')?.meta?.['revertableUntil'] ?? null);
  /** Actions shown as buttons; danger/neutral first, the primary one last (right). */
  readonly actions = computed(() => (this.item()?.availableActions ?? [])
    .filter((a) => !NAVIGATION_ACTIONS.has(a.key) && !(a.key === 'revert' && this.revertUntil()))
    .sort((a, b) => Number(a.tone === 'primary') - Number(b.tone === 'primary')));
  /** Edit-before-approve: an approve action, editable rows, and a kind that takes edits (payload or capability). */
  readonly canEdit = computed(() => {
    const d = this.detail();
    return !!d && this.actions().some((a) => a.key === 'approve') && d.changeSet.some((c) => c.editable)
      && (!!d.editablePayloadJson || hasCapability(this.descriptor(), InboxCapability.EditBeforeApprove));
  });
  protected readonly renderer = computed(() => this.renderers.resolve(this.descriptor()?.detailRenderer));
  protected readonly extra = computed(() => parseExtra(this.detail()?.extraJson));
  protected readonly outcomes = computed(() => this.dialog()?.action.key === 'change_decision'
    ? ['approve', 'reject']
    : (this.dialog()?.action.meta?.['outcomes'] ?? '').split(',').map((o) => o.trim()).filter(Boolean));
  /** A leave-style date range on the item (startAt/endAt rows): its cancel uses the full/partial leave dialog. */
  protected readonly leaveRange = computed(() => {
    const rows = this.detail()?.changeSet ?? [];
    const start = rows.find((c) => c.field === 'startAt')?.after;
    const end = rows.find((c) => c.field === 'endAt')?.after;
    if (!start || !end) return null;
    return { start, end, hours: Number(rows.find((c) => c.field === 'total_hours')?.after ?? 0) || 0 };
  });
  /** Convert-to-leave choices: the change set's "leaveTypeId" select row. */
  protected readonly leaveTypes = computed(() =>
    this.detail()?.changeSet.find((c) => c.field === 'leaveTypeId')?.options ?? []);

  constructor() {
    // A different item starts with no edits and no open dialog.
    effect(() => {
      this.item()?.id;
      this.edits.set({});
      this.editErrors.set({});
      this.commentAction.set(null);
      this.revertOpen.set(false);
      this.dialog.set(null);
    });
  }

  /** Runs an action by key - used by the buttons and by the conversation's "/" commands. */
  /** The chat's changes message reports the approver's edits here; approve sends them. */
  setEdits(edits: Record<string, string>): void {
    this.edits.set(edits);
  }

  runAction(key: string): void {
    const action = this.actions().find((a) => a.key === key);
    if (action) this.onAction(action);
  }

  protected onAction(action: InboxActionDto): void {
    if ((action.key === 'resolve' && action.meta?.['outcomes']) || action.key === 'change_decision') {
      this.dialog.set({ kind: 'outcome', action });
      return;
    }
    if (action.key === 'cancel' && this.leaveRange()) {
      this.dialog.set({ kind: 'leave-cancel', action });
      return;
    }
    if (action.key === 'escalate') {
      this.dialog.set({ kind: 'escalate', action });
      return;
    }
    if (action.needsComment) {
      this.commentAction.set(action);
      return;
    }
    if (action.key === 'revert') {
      this.revertOpen.set(true);
      return;
    }
    if (action.key === 'approve') {
      const d = this.detail();
      const errors = d ? validateEdits(d.changeSet, this.edits()) : {};
      this.editErrors.set(errors);
      if (Object.keys(errors).length > 0) return;
      const edited = d && this.canEdit() ? buildEditedPayload(d.editablePayloadJson, d.changeSet, this.edits()) : undefined;
      this.action.emit({ key: action.key, body: edited ? { editedPayloadJson: edited } : {} });
      return;
    }
    this.action.emit({ key: action.key, body: {} });
  }

  protected onCommentConfirmed(comment: string | null): void {
    const action = this.commentAction();
    this.commentAction.set(null);
    if (action) this.action.emit({ key: action.key, body: { comment } });
  }

  protected onOutcomeConfirmed(choice: InboxOutcomeChoice): void {
    const action = this.dialog()?.action;
    this.dialog.set(null);
    if (!action) return;
    if (action.key === 'change_decision') this.action.emit({ key: action.key, body: { decision: choice.outcome, comment: choice.comment } });
    else this.action.emit({ key: action.key, body: { outcome: choice.outcome, comment: choice.comment, leaveTypeId: choice.leaveTypeId } });
  }

  /** Leave cancel (full, or partial from an effective date when the leave has started). */
  protected onLeaveCancel(choice: LeaveCancelChoice): void {
    const action = this.dialog()?.action;
    this.dialog.set(null);
    if (action) this.action.emit({ key: action.key, body: { comment: choice.reason, effectiveDate: choice.effectiveDate } });
  }

  /** Escalate: the dialog's note is the action comment. */
  protected onDialogComment(comment: string | null): void {
    const action = this.dialog()?.action;
    this.dialog.set(null);
    if (action) this.action.emit({ key: action.key, body: { comment } });
  }

  protected onRevertConfirmed(): void {
    this.revertOpen.set(false);
    this.action.emit({ key: 'revert', body: {} });
  }

  protected humanize(key: string): string {
    const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
