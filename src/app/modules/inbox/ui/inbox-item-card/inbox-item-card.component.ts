import { DatePipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { InboxActionBody, InboxActionDto, InboxItemDetailDto, InboxTargetDto } from '../../models/inbox.dto';
import { inboxStatusLabel, inboxStatusTone, inboxSubtitle, inboxTitle, inboxTypeMeta, isAlert } from '../../utils/inbox-item.util';
import { InboxChangeSetComponent, buildEditedPayload, validateEdits } from '../inbox-change-set/inbox-change-set.component';
import { InboxCommentDialogComponent } from '../inbox-comment-dialog/inbox-comment-dialog.component';
import { InboxStepsComponent } from '../inbox-steps/inbox-steps.component';
import { InboxTypeIconComponent } from '../inbox-type-icon/inbox-type-icon.component';

export interface InboxCardAction {
  key: string;
  body: InboxActionBody;
}

/** "Open" is navigation, not a server action - it is the card's target link. */
const NAVIGATION_ACTIONS = new Set(['open_target']);

/** The detail card of one inbox item: header, request steps, explanation (summary + change set, or the
 *  alert message), the action bar, and a slot for the item's conversation. */
@Component({
  selector: 'app-inbox-item-card',
  standalone: true,
  imports: [DatePipe, KeyValuePipe, NgTemplateOutlet, AvatarComponent, ConfirmModalComponent, InboxChangeSetComponent, InboxCommentDialogComponent, InboxStepsComponent, InboxTypeIconComponent],
  host: { class: 'block h-full min-w-0' },
  template: `
    <ng-template #conversation><ng-content select="[inboxConversation]" /></ng-template>
    <aside class="card" data-testid="inbox-card" aria-label="Item details">
      @if (loading() && !detail()) {
        <p class="card__muted">Loading…</p>
      } @else if (!detail()) {
        <div class="card__scroll">
          <div class="card__header card__header--bare">
            <button type="button" class="card__close" data-testid="inbox-card-close" aria-label="Close details" (click)="closed.emit()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          @if (error()) { <p class="card__error" role="alert">{{ error() }}</p> }
          <!-- The conversation has its own access check, so it is still offered without the detail. -->
          @if (!loading()) { <ng-container [ngTemplateOutlet]="conversation" /> }
        </div>
      } @else {
        @let d = detail()!;
        @let item = d.item;
        <div class="card__scroll">
          <div class="card__header">
            <app-inbox-type-icon class="card__type-tile" [icon]="meta().icon" [tone]="meta().tone" />
            <div class="card__heading">
              <div class="card__eyebrow">{{ meta().label }}{{ alert() ? '' : ' Request' }}</div>
              <h2 class="card__title" data-testid="inbox-card-title">{{ title() }}</h2>
              <p class="card__subtitle">{{ subtitle() }}</p>
              <span data-testid="inbox-card-status" [class]="'card__pill card__pill--' + statusTone()">
                <span class="card__pill-dot" aria-hidden="true"></span>{{ statusText() }}
              </span>
            </div>
            <button type="button" class="card__close" data-testid="inbox-card-close" aria-label="Close details" (click)="closed.emit()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          @if (error()) { <p class="card__error" role="alert">{{ error() }}</p> }

          <section class="card__section">
            <div class="card__label">Details</div>
            <div class="card__box">
              <div class="card__row"><span class="card__key">Project</span><span class="card__value">{{ item.contextName ?? '—' }}</span></div>
              @if (item.requestedBy) {
                <div class="card__row"><span class="card__key">Requested by</span>
                  <span class="card__value card__person"><app-avatar [userName]="item.requestedBy.name" size="xs" /><span class="truncate">{{ item.requestedBy.name }}</span></span></div>
              }
              @if (item.requestedTo) {
                <div class="card__row"><span class="card__key">{{ item.kind === 'invitation' ? 'Invitee' : 'Requested to' }}</span>
                  <span class="card__value card__person"><app-avatar [userName]="item.requestedTo.name" size="xs" /><span class="truncate">{{ item.requestedTo.name }}</span></span></div>
              }
              <div class="card__row"><span class="card__key">{{ alert() ? 'Detected' : 'Requested on' }}</span><span class="card__value">{{ item.createdAt | date: 'MMM d, y h:mm a' }}</span></div>
              @if (item.severity) {
                <div class="card__row"><span class="card__key">Severity</span><span class="card__value card__capitalize">{{ item.severity }}</span></div>
              }
            </div>
            @if (d.target; as target) {
              <button type="button" class="card__link" data-testid="inbox-card-open-target" (click)="openTarget.emit(target)">
                {{ target.label }}
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
              </button>
            }
          </section>

          <section class="card__section">
            <div class="card__label">{{ alert() ? 'Alert steps' : 'Request steps' }}</div>
            <app-inbox-steps [steps]="d.steps" />
          </section>

          @if (d.explanation || d.explanationDetails) {
            <section class="card__section">
              <div class="card__label">{{ alert() ? 'What happened' : 'Reason / note' }}</div>
              @if (d.explanation) { <p class="card__note" data-testid="inbox-card-explanation">{{ d.explanation }}</p> }
              @if (d.explanationDetails; as details) {
                <div class="card__box mt-2" data-testid="inbox-card-details">
                  @for (entry of details | keyvalue; track entry.key) {
                    <div class="card__row"><span class="card__key">{{ humanize(entry.key) }}</span><span class="card__value">{{ entry.value }}</span></div>
                  }
                </div>
              }
            </section>
          }

          @if (d.changeSet.length > 0) {
            <section class="card__section">
              <div class="card__label">Changes</div>
              <app-inbox-change-set [changes]="d.changeSet" [editable]="canEdit()" [errors]="editErrors()" (editsChange)="edits.set($event)" />
            </section>
          }

          <ng-container [ngTemplateOutlet]="conversation" />
        </div>

        @if (actionError()) {
          <p class="card__error card__error--footer" role="alert" data-testid="inbox-card-action-error">{{ actionError() }}</p>
        }
        @if (actions().length > 0) {
          <footer class="card__footer" data-testid="inbox-card-footer">
            @for (a of actions(); track a.key) {
              <button type="button" [class]="'card__btn card__btn--' + a.tone" [attr.data-testid]="'inbox-action-' + a.key"
                [disabled]="busy()" (click)="onAction(a)">{{ a.label }}</button>
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
    .card { position: relative; display: flex; height: 100%; overflow: hidden; flex-direction: column; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / .05); }
    .card__scroll { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 20px; overflow-x: hidden; overflow-y: auto; padding: 20px; }
    .card__header { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); }
    .card__header--bare { justify-content: flex-end; padding-bottom: 0; border-bottom: 0; }
    .card__type-tile { width: 40px; height: 40px; border-radius: 11px; }
    .card__heading { min-width: 0; flex: 1; }
    .card__eyebrow { margin-bottom: 3px; color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .card__title { margin: 0; font-size: 16px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
    .card__subtitle { margin: 3px 0 8px; color: var(--color-text-secondary); font-size: 12px; overflow-wrap: anywhere; }
    .card__close { display: inline-flex; flex: 0 0 auto; width: 28px; height: 28px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .card__close:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    @media (min-width: 1024px) { .card__close { display: none; } }
    .card__close svg, .card__link svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .card__muted { margin: 0; padding: 24px 20px; color: var(--color-text-secondary); font-size: 13px; }
    .card__error { margin: 0; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 8%, transparent); color: var(--color-danger); font-size: 12px; }
    .card__error--footer { margin: 0 20px 8px; }
    .card__label { margin-bottom: 8px; color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .card__box { display: flex; flex-direction: column; padding: 2px 12px; border: 1px solid var(--color-border); border-radius: 12px; font-size: 12px; }
    .card__row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent); }
    .card__row:last-child { border-bottom: 0; }
    .card__key { flex: 0 0 auto; color: var(--color-text-secondary); font-weight: 500; }
    .card__value { min-width: 0; overflow: hidden; font-weight: 600; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
    .card__capitalize { text-transform: capitalize; }
    .card__person { display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; }
    .card__link { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .card__note { margin: 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: color-mix(in srgb, var(--color-surface-secondary) 30%, transparent); color: var(--color-text-secondary); font-size: 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
    .card__footer { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .card__btn { flex: 1 1 0; min-width: 96px; padding: 9px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .card__btn:hover:not(:disabled) { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .card__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .card__btn--primary:hover:not(:disabled) { background: var(--color-accent); color: var(--color-accent-contrast, #fff); filter: brightness(.95); }
    .card__btn--danger { color: var(--color-danger); }
    .card__btn:disabled { opacity: .55; cursor: default; }
    .card__btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .card__pill { --tone: var(--color-accent); display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 500; }
    .card__pill-dot { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
    .card__pill--neutral { --tone: var(--color-text-secondary); background: var(--color-surface-secondary); }
  `]
})
export class InboxItemCardComponent {
  detail = input<InboxItemDetailDto | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  busy = input(false);
  actionError = input<string | null>(null);

  closed = output<void>();
  action = output<InboxCardAction>();
  openTarget = output<InboxTargetDto>();

  protected readonly edits = signal<Record<string, string>>({});
  protected readonly editErrors = signal<Record<string, string>>({});
  protected readonly commentAction = signal<InboxActionDto | null>(null);
  protected readonly revertOpen = signal(false);

  private readonly item = computed(() => this.detail()?.item ?? null);
  protected readonly alert = computed(() => !!this.item() && isAlert(this.item()!));
  protected readonly meta = computed(() => this.item() ? inboxTypeMeta(this.item()!) : { label: '', tone: 'neutral' as const, icon: 'task' });
  protected readonly title = computed(() => this.item() ? inboxTitle(this.item()!) : '');
  protected readonly subtitle = computed(() => this.item() ? inboxSubtitle(this.item()!) : '');
  protected readonly statusText = computed(() => this.item() ? inboxStatusLabel(this.item()!) : '');
  protected readonly statusTone = computed(() => this.item() ? inboxStatusTone(this.item()!) : 'neutral');
  /** Actions shown as buttons; danger/neutral first, the primary one last (right). */
  readonly actions = computed(() => (this.item()?.availableActions ?? [])
    .filter((a) => !NAVIGATION_ACTIONS.has(a.key))
    .sort((a, b) => Number(a.tone === 'primary') - Number(b.tone === 'primary')));
  protected readonly canEdit = computed(() =>
    !!this.detail()?.editablePayloadJson && this.actions().some((a) => a.key === 'approve'));

  constructor() {
    // A different item starts with no edits and no open dialog.
    effect(() => {
      this.item()?.id;
      this.edits.set({});
      this.editErrors.set({});
      this.commentAction.set(null);
      this.revertOpen.set(false);
    });
  }

  /** Runs an action by key - used by the buttons and by the conversation's "/" commands. */
  runAction(key: string): void {
    const action = this.actions().find((a) => a.key === key);
    if (action) this.onAction(action);
  }

  protected onAction(action: InboxActionDto): void {
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

  protected onRevertConfirmed(): void {
    this.revertOpen.set(false);
    this.action.emit({ key: 'revert', body: {} });
  }

  protected humanize(key: string): string {
    const words = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
