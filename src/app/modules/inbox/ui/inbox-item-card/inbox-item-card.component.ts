import { DatePipe, NgComponentOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ExceptionEvidenceResponse } from '../../../../shared/models/exception-evidence.model';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { LeaveCancelChoice, LeaveCancelConfirmDialogComponent } from '../../../../shared/ui/leave-cancel-confirm-dialog/leave-cancel-confirm-dialog.component';
import {
  InboxActionBody,
  InboxActionDto,
  InboxCapability,
  InboxItemDetailDto,
  InboxKindDescriptorDto,
  InboxItemRef,
  InboxTargetDto,
  hasCapability
} from '../../models/inbox.dto';
import { InboxDetailRendererRegistry, parseExtra } from '../../renderers/inbox-detail-renderers';
import { inboxStatusLabel, inboxStatusTone, inboxSubtitle, inboxTitle, inboxTypeMeta, isAlert, isWorkActionType } from '../../utils/inbox-item.util';
import { TicketRowIcon, decisionLine, isMonitorAlert, ticketSections } from '../../utils/ticket-details.util';
import { FaceEvidenceCardComponent } from '../face-evidence-card/face-evidence-card.component';
import { InboxEscalateCandidate, InboxEscalateChoice, InboxEscalateContext, InboxEscalateDialogComponent } from '../inbox-action-dialogs/inbox-escalate-dialog.component';
import { InboxOutcomeChoice, InboxOutcomeDialogComponent } from '../inbox-action-dialogs/inbox-outcome-dialog.component';
import { buildEditedPayload, validateEdits } from '../inbox-change-set/inbox-change-set.component';
import { InboxCommentDialogComponent } from '../inbox-comment-dialog/inbox-comment-dialog.component';
import { InboxRevertBannerComponent } from '../inbox-revert-banner/inbox-revert-banner.component';
import { InboxStepsComponent } from '../inbox-steps/inbox-steps.component';
import { InboxTypeIconComponent } from '../inbox-type-icon/inbox-type-icon.component';

export interface InboxCardAction {
  key: string;
  body: InboxActionBody;
}

/** "Open" is navigation, not a server action - it is the card's target link. */
const NAVIGATION_ACTIONS = new Set(['open_target']);

/** Stroke paths (24x24) of the details rows' icons. */
const ROW_ICONS: Record<TicketRowIcon, string> = {
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7v5l3 2',
  'clock-in': 'M7 17 17 7M9 7h8v8',
  'clock-out': 'M17 7 7 17M15 17H7V9',
  timer: 'M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16',
  monitor: 'M4 4h16v11H4zM8 20h8M12 15v5',
  calendar: 'M8 3v4M16 3v4M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  tag: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01',
  info: 'M12 16v-4M12 8h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18'
};

/** The Ticket details panel of one inbox item, one layout for every kind: a tinted header (status pill, an exception's description),
 *  an identity case's face checks and day evidence, a details box, the outcome, the employee's note, the steps and the action bar at the bottom. Built only from the item's
 *  AvailableActions and the kind descriptor, so a viewer without a decision sees no buttons and nothing editable;
 *  each action key opens its standard dialog. */
@Component({
  selector: 'app-inbox-item-card',
  standalone: true,
  imports: [
    DatePipe, NgComponentOutlet, ConfirmModalComponent, FaceEvidenceCardComponent,
    InboxCommentDialogComponent, InboxEscalateDialogComponent, InboxOutcomeDialogComponent,
    InboxRevertBannerComponent, InboxStepsComponent, InboxTypeIconComponent, LeaveCancelConfirmDialogComponent
  ],
  host: { class: 'block h-full min-w-0' },
  template: `
    <aside class="card" data-testid="inbox-card" aria-label="Ticket details">
      @if (showHeading()) {
        <header class="card__top">
          <h2 class="card__heading">Ticket details</h2>
          <ng-content select="[cardHeaderAction]" />
        </header>
      }
      @if (loading() && !detail()) {
        <p class="card__muted">Loading…</p>
      } @else if (!detail()) {
        @if (error()) { <p class="card__error card__error--pad" role="alert">{{ error() }}</p> }
      } @else {
        @let d = detail()!;
        @let item = d.item;
        <div class="card__scroll scroll-fade">
          <!-- Every kind reads the same: a tinted header, its details box, the outcome, the employee's note, the steps. -->
          <div [class]="'card__summary card__summary--' + meta().tone">
            <div class="card__summary-head">
              <app-inbox-type-icon class="card__type-tile" [icon]="meta().icon" [tone]="meta().tone" />
              <div class="card__summary-text">
                <h3 class="card__title" data-testid="inbox-card-title">{{ title() }}</h3>
                <p class="card__subtitle">{{ alert() || !subtitle() ? meta().label + ' · ' + (item.createdAt | date: 'MMM d, y, h:mm a') : subtitle() }}</p>
                @if (decided(); as line) { <p class="card__subtitle" data-testid="inbox-card-decided">{{ line }}</p> }
              </div>
              <span data-testid="inbox-card-status" [class]="'card__pill card__pill--' + statusTone()">{{ statusText() }}</span>
            </div>
            @if (description(); as text) { <p class="card__description" data-testid="inbox-card-description">{{ text }}</p> }
          </div>

          @if (error()) { <p class="card__error" role="alert">{{ error() }}</p> }
          @if (revertUntil(); as until) {
            <app-inbox-revert-banner [until]="until" [busy]="busy()" (undo)="revertOpen.set(true)" />
          }

          @if (faceEvidence(); as ev) {
            <section class="card__section" data-testid="inbox-card-face-evidence">
              <h4 class="card__label">Evidence &amp; details</h4>
              <app-face-evidence-card [evidence]="ev" />
            </section>
          }
          <!-- An identity case stops at its face checks; other monitoring exceptions keep the day's evidence (why it was flagged). -->
          @if (!faceEvidence() && evidenceRenderer(); as r) {
            <section class="card__section" data-testid="inbox-card-renderer">
              <h4 class="card__label">Attendance details</h4>
              <ng-container *ngComponentOutlet="r; inputs: { extra: extra(), detail: d }" />
            </section>
          }

          @let sec = sections();
          @if (sec.rows.length > 0) {
            <section class="card__section" data-testid="inbox-card-details">
              <h4 class="card__label">{{ sec.title }}</h4>
              <dl class="card__box card__rows">
                @for (row of sec.rows; track row.key) {
                  <div class="card__row" data-testid="inbox-card-detail-row">
                    <dt><svg class="card__dt-icon" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="rowIcons[row.icon]" /></svg>{{ row.label }}</dt>
                    <dd [class.card__warn]="row.tone === 'warning'">{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </section>
          }
          @if (sec.outcome; as outcome) {
            <section class="card__section" data-testid="inbox-card-outcome">
              <h4 class="card__label">Outcome</h4>
              <p class="card__box card__text">{{ outcome }}</p>
            </section>
          }
          @if (sec.note; as note) {
            <section class="card__section" data-testid="inbox-card-note">
              <h4 class="card__label">Description / note</h4>
              <dl class="card__box card__rows">
                <div class="card__row card__row--top"><dt>{{ note.label }}</dt><dd class="card__wrap">{{ note.text }}</dd></div>
              </dl>
            </section>
          }

          @if (actionError() && actionErrorInline()) {
            <p class="card__error" role="alert" data-testid="inbox-card-inline-error">{{ actionError() }}</p>
          }

          <section class="card__section" data-testid="inbox-card-steps">
            <h4 class="card__label">Request steps</h4>
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
          [candidates]="escalateCandidates()"
          [context]="escalateContext()"
          (confirmed)="onEscalateConfirmed($event)"
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
    .card__scroll { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 18px; overflow-x: hidden; overflow-y: auto; padding: 16px 18px; }
    .card__summary { --tone: var(--color-accent); display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 12px; background: color-mix(in srgb, var(--tone) 8%, var(--color-surface)); }
    .card__summary--neutral { --tone: var(--color-text-secondary); }
    .card__summary--warning { --tone: var(--color-warning, #d97706); }
    .card__summary--danger { --tone: var(--color-danger); }
    .card__summary-head { display: flex; align-items: flex-start; gap: 12px; }
    .card__type-tile { width: 40px; height: 40px; border-radius: 50%; }
    .card__summary-text { min-width: 0; flex: 1; }
    .card__title { margin: 0; font-size: 15px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
    .card__subtitle { margin: 3px 0 0; color: var(--color-text-secondary); font-size: 12.5px; line-height: 1.45; overflow-wrap: anywhere; }
    .card__description { margin: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
    .card__muted { margin: 0; padding: 24px 18px; color: var(--color-text-secondary); font-size: 13px; }
    .card__error { margin: 0; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 8%, transparent); color: var(--color-danger); font-size: 12px; }
    .card__error--pad { margin: 16px 18px; }
    .card__error--footer { margin: 0 18px 8px; }
    .card__section { display: flex; flex-direction: column; }
    .card__label { margin: 0 0 10px; color: var(--color-text-primary); font-size: 13px; font-weight: 650; }
    .card__box { margin: 0; padding: 12px 14px; border-radius: 10px; background: var(--color-surface-secondary); }
    .card__rows { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
    .card__text { color: var(--color-text-primary); font-size: 13px; }
    .card__row { display: grid; min-width: 0; grid-template-columns: minmax(96px, 40%) minmax(0, 1fr); align-items: center; gap: 12px; }
    .card__row dt { display: flex; min-width: 0; align-items: center; gap: 8px; color: var(--color-text-secondary); }
    .card__dt-icon { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; opacity: .8; }
    .card__row dd { min-width: 0; margin: 0; overflow: hidden; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .card__row--top { align-items: start; }
    .card__wrap { white-space: normal !important; overflow-wrap: anywhere; line-height: 1.5; }
    .card__warn { color: var(--color-warning, #d97706); font-weight: 650 !important; }
    .card__footer { display: flex; flex-wrap: wrap; gap: 12px; padding: 14px 18px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .card__btn { flex: 1 1 0; min-width: 84px; max-width: 100%; height: 40px; padding: 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .card__btn:hover:not(:disabled) { background: var(--color-surface-secondary); }
    .card__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .card__btn--primary:hover:not(:disabled) { background: var(--color-accent); filter: brightness(.95); }
    .card__btn--danger { border-color: color-mix(in srgb, var(--color-danger) 60%, var(--color-border)); color: var(--color-danger); }
    .card__btn:disabled { opacity: .55; cursor: default; }
    .card__btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .card__pill { --tone: var(--color-accent); display: inline-flex; max-width: 100%; align-items: center; padding: 2px 10px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .card__pill--neutral { --tone: var(--color-text-secondary); }
    .card__pill--warning { --tone: var(--color-warning, #d97706); }
    .card__pill--danger { --tone: var(--color-danger); }
  `]
})
export class InboxItemCardComponent {
  /** False where the panel already names it (the 1-on-1 chat's "Ticket details" tab, which also holds its actions). */
  showHeading = input(true);
  detail = input<InboxItemDetailDto | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  busy = input(false);
  actionError = input<string | null>(null);
  /** The action error is a validation message about the edited values (422): shown above the form. */
  actionErrorInline = input(false);
  /** The item's kind from the registry (GET /inbox/kinds); null while unknown. */
  descriptor = input<InboxKindDescriptorDto | null>(null);

  action = output<InboxCardAction>();
  openTarget = output<InboxTargetDto>();
  /** A row in Past cases was clicked (only rows the caller can open emit). */
  openCase = output<InboxItemRef>();

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
  /** Who the escalate dialog may send the item to instead (escalate action Meta "escalateCandidates", JSON). */
  protected readonly escalateCandidates = computed<InboxEscalateCandidate[]>(() => {
    const raw = this.item()?.availableActions.find((a) => a.key === 'escalate')?.meta?.['escalateCandidates'];
    if (!raw) return [];
    try {
      return JSON.parse(raw) as InboxEscalateCandidate[];
    } catch {
      return [];
    }
  });
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
  /** The ticket card beside the escalate picker (one object per item, not per change detection). */
  protected readonly escalateContext = computed<InboxEscalateContext | null>(() =>
    this.item() ? { eyebrow: this.eyebrow(), title: this.title(), subtitle: this.subtitle() } : null);
  protected readonly statusText = computed(() => this.item() ? inboxStatusLabel(this.item()!) : '');
  protected readonly statusTone = computed(() => this.item() ? inboxStatusTone(this.item()!) : 'neutral');
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
  protected readonly evidenceRenderer = computed(() => this.descriptor()?.detailRenderer === 'exception-evidence'
    ? this.renderers.resolve('exception-evidence')
    : null);
  protected readonly extra = computed(() => parseExtra(this.detail()?.extraJson));
  protected readonly rowIcons = ROW_ICONS;
  protected readonly sections = computed(() => {
    const d = this.detail();
    return d ? ticketSections(d) : { title: '', rows: [], outcome: null, note: null };
  });
  /** "Approved on ..." under a decided request's subtitle. */
  protected readonly decided = computed(() => (this.detail() && !this.alert() ? decisionLine(this.detail()!) : null));
  /** Why a monitoring exception or a project monitor alert fired (its explanation); other kinds' explanation is the
   *  employee's note, shown below. */
  protected readonly description = computed(() => {
    const d = this.detail();
    return d && (this.evidenceRenderer() || isMonitorAlert(d)) ? d.explanation : null;
  });
  /** An identity case's face checks - present only in a reviewer's own detail. */
  protected readonly faceEvidence = computed<ExceptionEvidenceResponse | null>(() => {
    if (this.descriptor()?.detailRenderer !== 'exception-evidence') return null;
    const ev = this.extra() as ExceptionEvidenceResponse | null;
    return ev && ((ev.faceChecks?.length ?? 0) > 0 || (ev.checkInScans?.length ?? 0) > 0 || !!ev.identity?.photoUrl) ? ev : null;
  });
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
      this.item();
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

  /** Escalate: the dialog's note is the action comment; a hand-picked person goes as targetEmployeeId. */
  protected onEscalateConfirmed(choice: InboxEscalateChoice): void {
    const action = this.dialog()?.action;
    this.dialog.set(null);
    if (!action) return;
    this.action.emit({ key: action.key, body: choice.targetEmployeeId ? { comment: choice.comment, targetEmployeeId: choice.targetEmployeeId } : { comment: choice.comment } });
  }

  protected onRevertConfirmed(): void {
    this.revertOpen.set(false);
    this.action.emit({ key: 'revert', body: {} });
  }
}
