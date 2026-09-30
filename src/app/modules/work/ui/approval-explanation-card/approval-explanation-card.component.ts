import { DatePipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { ApprovalCommentsComponent } from '../approval-comments/approval-comments.component';
import { ApprovalRejectDialogComponent } from '../approval-reject-dialog/approval-reject-dialog.component';
import { ApprovalCommentDto, ApprovalDetailDto, ApprovalFieldDto } from '../../models/dto/approval-feed.dto';
import {
  APPROVAL_TYPE_META,
  approvalSubtitle,
  approvalTitle,
  approvalTypeKey,
  statusLabel,
  statusTone
} from '../../utils/approval-feed.util';

export interface ApprovalTimelineEntry {
  icon: 'request' | 'approved' | 'rejected' | 'cancelled' | 'stale';
  text: string;
  at: string;
}

/** Overwrites the edited keys on the requested payload. Keys are the payload's own property names. */
export function buildEditedPayload(requestedJson: string | null, fields: readonly ApprovalFieldDto[], edits: Record<string, string>): string | undefined {
  const keys = Object.keys(edits);
  if (keys.length === 0) return undefined;
  const payload = requestedJson ? JSON.parse(requestedJson) as Record<string, unknown> : {};
  for (const key of keys) {
    const field = fields.find((f) => f.key === key);
    if (!field) continue;
    const raw = edits[key].trim();
    payload[key] = raw === '' ? null
      : field.kind === 'number' || field.kind === 'hours' ? Number(raw)
      : raw;
  }
  return JSON.stringify(payload);
}

/** Requested → (Approved / Approved with changes / Rejected / Cancelled / Outdated), with who and when. */
export function buildTimeline(detail: ApprovalDetailDto): ApprovalTimelineEntry[] {
  const item = detail.item;
  const invitation = item.source === 'invitation';
  const entries: ApprovalTimelineEntry[] = [
    { icon: 'request', text: invitation ? `Invited by ${item.requestedByName}` : `Requested by ${item.requestedByName}`, at: item.createdAt }
  ];
  const by = item.decidedByName ?? item.approverName;
  const at = item.decidedAt ?? '';
  switch (item.status) {
    case 'approved':
      entries.push({
        icon: 'approved', at,
        text: invitation ? `Accepted by ${by}` : detail.appliedPayloadJson ? `Approved with changes by ${by}` : `Approved by ${by}`
      });
      break;
    case 'rejected':
      entries.push({
        icon: 'rejected', at,
        text: `${invitation ? 'Declined' : 'Rejected'} by ${by}${item.decisionComment ? ` — ${item.decisionComment}` : ''}`
      });
      break;
    case 'cancelled':
      entries.push({ icon: 'cancelled', at, text: invitation ? 'Invitation cancelled' : 'Cancelled by requester' });
      break;
    case 'stale':
      entries.push({ icon: 'stale', at, text: invitation ? 'Invitation expired' : 'Closed as outdated' });
      break;
  }
  return entries;
}

const PRIORITY_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
];

/** The right-hand card of the Approvals page: details, invitation, field diff (editable for the approver), activity and comments. */
@Component({
  selector: 'app-approval-explanation-card',
  standalone: true,
  imports: [DatePipe, AvatarComponent, DatePickerComponent, WorkDropdownComponent, ApprovalCommentsComponent, ApprovalRejectDialogComponent],
  host: { class: 'block h-full min-w-0' },
  template: `
    <aside class="approval-card" data-testid="approval-card" aria-label="Request details">
      @if (loading() && !detail()) {
        <p class="approval-card__muted" data-testid="approval-card-loading">Loading request…</p>
      } @else if (!detail()) {
        @if (error()) { <p class="approval-card__error m-4" role="alert">{{ error() }}</p> }
      } @else {
        @let d = detail()!;
        @let item = d.item;
        <div class="approval-card__scroll flex flex-col gap-5">
          <!-- Header: same pattern as the Tree tab's explanation panel. -->
          <div class="flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <div class="min-w-0">
              <div class="mb-2 flex items-center gap-2">
                <span class="h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" aria-hidden="true"></span>
                <span class="truncate text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">{{ meta().label }} Request</span>
              </div>
              <h2 class="text-base font-bold leading-tight text-[var(--color-text-primary)]">{{ title() }}</h2>
              <p class="mt-1 break-words text-xs text-[var(--color-text-secondary)]">{{ subtitle() }}</p>
              <span data-testid="approval-card-status" [class]="'approval-pill mt-2 approval-pill--' + statusToneValue()">{{ statusText() }}</span>
            </div>
            <button type="button" class="approval-card__close" data-testid="approval-card-close" aria-label="Close details" (click)="closed.emit()">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          @if (error()) { <p class="approval-card__error" role="alert" data-testid="approval-card-error">{{ error() }}</p> }

          <section>
            <div class="approval-card__label">Details</div>
            <div class="approval-card__box">
              <div class="approval-card__row"><span>Module</span><span class="approval-card__value">{{ item.moduleTitle ?? '—' }}</span></div>
              <div class="approval-card__row"><span>Project</span><span class="approval-card__value">{{ item.projectName }}</span></div>
              <div class="approval-card__row">
                <span>Requested by</span>
                <span class="approval-card__value approval-card__person"><app-avatar [userName]="item.requestedByName" size="xs" /><span class="truncate">{{ item.requestedByName }}</span></span>
              </div>
              <div class="approval-card__row"><span>Requested on</span><span class="approval-card__value">{{ item.createdAt | date: 'MMM d, y h:mm a' }}</span></div>
              <div class="approval-card__row">
                <span>{{ item.source === 'invitation' ? 'Invitee' : 'Approver' }}</span>
                <span class="approval-card__value approval-card__person"><app-avatar [userName]="item.approverName" size="xs" /><span class="truncate">{{ item.approverName }}</span></span>
              </div>
              @if (item.decidedAt) {
                <div class="approval-card__row"><span>Decided by</span><span class="approval-card__value">{{ item.decidedByName ?? item.approverName }}</span></div>
                <div class="approval-card__row"><span>Decided on</span><span class="approval-card__value">{{ item.decidedAt | date: 'MMM d, y h:mm a' }}</span></div>
              }
              @if (item.decisionComment) {
                <div class="approval-card__row approval-card__row--stacked"><span>Reason</span><span class="approval-card__value" data-testid="approval-card-decision-reason">{{ item.decisionComment }}</span></div>
              }
            </div>
            @if (canOpenTarget()) {
              <button type="button" class="approval-card__link" data-testid="approval-card-open-target" (click)="openTarget.emit()">
                {{ item.targetType === 'task' ? 'Open task' : 'Open module' }}
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
              </button>
            }
          </section>

          @if (d.invitation; as inv) {
            <section data-testid="approval-card-invitation">
              <div class="approval-card__label">Invitation</div>
              <div class="approval-card__box">
                <div class="approval-card__row">
                  <span>Invitee</span>
                  <span class="approval-card__value approval-card__person"><app-avatar [userName]="inv.inviteeName" size="xs" /><span class="truncate">{{ inv.inviteeName }}</span></span>
                </div>
                <div class="approval-card__row"><span>Invited as</span><span class="approval-card__value capitalize">{{ inv.inviteType }}</span></div>
                <div class="approval-card__row"><span>Module</span><span class="approval-card__value">{{ inv.moduleTitle }}</span></div>
                <div class="approval-card__row"><span>Invited by</span><span class="approval-card__value">{{ inv.invitedByName }}</span></div>
                <div class="approval-card__row"><span>Expires</span><span class="approval-card__value">{{ inv.expiresAt ? (inv.expiresAt | date: 'MMM d, y') : 'Never' }}</span></div>
              </div>
            </section>
          }

          @if (d.fields.length > 0) {
            <section>
              <div class="approval-card__label flex items-center justify-between gap-2">
                <span>Changes</span>
                @if (lastColumn()) { <span class="approval-card__tag" data-testid="approval-card-last-col">{{ lastColumn() }}</span> }
              </div>
              @if (d.currentAllocatedHours !== null && allocationField(); as f) {
                <div class="mb-2 grid grid-cols-2 gap-2" data-testid="approval-card-allocation">
                  <div class="approval-card__stat"><div class="approval-card__stat-value">{{ d.currentAllocatedHours }}h</div><div class="approval-card__stat-label">Current allocation</div></div>
                  <div class="approval-card__stat"><div class="approval-card__stat-value approval-card__stat-value--accent">{{ allocationAfter() }}h</div><div class="approval-card__stat-label">After approval</div></div>
                </div>
              }
              <div class="flex flex-col gap-2" data-testid="approval-card-changes">
                @for (f of d.fields; track f.key) {
                  <div class="approval-card__field" [class.approval-card__row--changed]="f.changed" data-testid="approval-card-field" [attr.data-key]="f.key">
                    <div class="approval-card__field-label">{{ f.label }}</div>
                    <div class="grid grid-cols-2 gap-2">
                      <div class="min-w-0"><div class="approval-card__mini">Current</div><div class="approval-card__field-value">{{ display(f, f.current) }}</div></div>
                      <div class="min-w-0"><div class="approval-card__mini">Requested</div><div class="approval-card__field-value approval-card__requested">{{ display(f, f.requested) }}</div></div>
                    </div>
                    @if (lastColumn() === 'Approve value' && f.editable) {
                      <div class="mt-2 min-w-0">
                        <div class="approval-card__mini">Approve value</div>
                        @switch (f.kind) {
                          @case ('date') {
                            <app-date-picker class="block min-w-0" [value]="editValue(f)" [showQuickPresets]="false" [ariaLabel]="f.label" [inputTestId]="'approval-edit-' + f.key"
                              (valueChange)="setEdit(f.key, $event)" />
                          }
                          @case ('priority') {
                            <app-work-dropdown size="sm" [fullWidth]="true" [options]="priorityOptions" [selected]="editValue(f)" [accessibleLabel]="f.label"
                              [testId]="'approval-edit-' + f.key" (selectionChanged)="setEdit(f.key, $event)" />
                          }
                          @default {
                            <span class="approval-card__input-wrap">
                              <input class="approval-card__input" [attr.data-testid]="'approval-edit-' + f.key" [attr.aria-label]="f.label"
                                [type]="f.kind === 'number' || f.kind === 'hours' ? 'number' : 'text'"
                                [value]="editValue(f)" (input)="setEdit(f.key, $any($event.target).value)" />
                              @if (f.kind === 'hours') { <span class="approval-card__suffix">h</span> }
                            </span>
                          }
                        }
                        @if (fieldErrors()[f.key]; as err) {
                          <span class="approval-card__field-error" role="alert" [attr.data-testid]="'approval-edit-error-' + f.key">{{ err }}</span>
                        }
                      </div>
                    } @else if (lastColumn() === 'Approved') {
                      <div class="mt-2"><div class="approval-card__mini">Approved</div><div class="approval-card__field-value font-semibold">{{ display(f, f.applied ?? f.requested) }}</div></div>
                    }
                  </div>
                }
              </div>
            </section>
          }

          @if (d.note) {
            <section>
              <div class="approval-card__label">Reason / note</div>
              <p class="approval-card__note" data-testid="approval-card-note">{{ d.note }}</p>
            </section>
          }

          <section>
            <div class="approval-card__label">Activity</div>
            <ol class="approval-card__timeline" data-testid="approval-card-timeline">
              @for (entry of timeline(); track $index) {
                <li [class]="'approval-card__event approval-card__event--' + entry.icon">
                  <span class="approval-card__dot" aria-hidden="true"></span>
                  <span class="approval-card__event-text">{{ entry.text }}</span>
                  @if (entry.at) { <time>{{ entry.at | date: 'MMM d, y h:mm a' }}</time> }
                </li>
              }
            </ol>
            <app-approval-comments
              [comments]="comments()"
              [loading]="commentsLoading()"
              (add)="addComment.emit($event)"
              (reply)="replyComment.emit($event)"
              (edit)="editComment.emit($event)"
            />
          </section>
        </div>

        @if (item.canDecide || item.canCancel) {
          <footer class="approval-card__footer" data-testid="approval-card-footer">
            @if (item.canDecide) {
              <button type="button" [class]="secondaryBtn" data-testid="approval-card-reject" [disabled]="busy()" (click)="rejectOpen.set(true)">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                <span>{{ isInvitation() ? 'Decline' : 'Reject' }}</span>
              </button>
              <button type="button" [class]="primaryBtn" data-testid="approval-card-approve" [disabled]="busy()" (click)="onApprove()">
                <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
                <span>{{ isInvitation() ? 'Accept' : 'Approve' }}</span>
              </button>
            } @else {
              <button type="button" [class]="secondaryBtn + ' col-span-2'" data-testid="approval-card-cancel" [disabled]="busy()" (click)="cancelRequest.emit()">
                <span>Cancel request</span>
              </button>
            }
          </footer>
        }

        <app-approval-reject-dialog
          [open]="rejectOpen()"
          [title]="isInvitation() ? 'Decline invitation?' : 'Reject request?'"
          [confirmLabel]="isInvitation() ? 'Decline' : 'Reject'"
          (confirmed)="onRejectConfirmed($event)"
          (closed)="rejectOpen.set(false)"
        />
      }
    </aside>
  `,
  styles: [`
    /* Same shell as app-card (Tree tab explanation panel), but a fixed height so the actions stay at the bottom. */
    .approval-card { position: relative; display: flex; height: calc(100vh - 170px); min-height: 440px; overflow: hidden; flex-direction: column; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / .05); }
    .approval-card__scroll { flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 20px; }
    .approval-card__close { display: inline-flex; flex: 0 0 auto; width: 28px; height: 28px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .approval-card__close:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    /* Beside the list the card is always open; closing only makes sense for the narrow-screen drawer. */
    @media (min-width: 1024px) { .approval-card__close { display: none; } }
    .approval-card__close svg, .approval-card__link svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .approval-card__muted { margin: 0; padding: 24px 20px; color: var(--color-text-secondary); font-size: 13px; }
    .approval-card__error { margin: 0; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 8%, transparent); color: var(--color-danger); font-size: 12px; }
    .approval-card__label { margin-bottom: 8px; color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .approval-card__tag { padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); font-size: 10px; letter-spacing: .02em; text-transform: none; }
    .approval-card__box { display: flex; flex-direction: column; padding: 4px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: color-mix(in srgb, var(--color-surface-secondary) 30%, transparent); font-size: 12px; }
    .approval-card__row { display: flex; min-width: 0; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent); }
    .approval-card__row:last-child { border-bottom: 0; }
    .approval-card__row > span:first-child { flex: 0 0 auto; color: var(--color-text-secondary); font-weight: 500; }
    .approval-card__row--stacked { flex-direction: column; align-items: stretch; gap: 4px; }
    .approval-card__value { min-width: 0; overflow: hidden; color: var(--color-text-primary); font-weight: 600; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
    .approval-card__row--stacked .approval-card__value { text-align: left; white-space: normal; overflow-wrap: anywhere; font-weight: 500; }
    .approval-card__person { display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px; }
    .approval-card__link { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .approval-card__stat { padding: 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); text-align: center; box-shadow: 0 1px 2px rgb(0 0 0 / .05); }
    .approval-card__stat-value { color: var(--color-text-primary); font-size: 16px; font-weight: 700; }
    .approval-card__stat-value--accent { color: var(--color-accent); }
    .approval-card__stat-label { margin-top: 2px; color: var(--color-text-secondary); font-size: 10px; font-weight: 500; }
    .approval-card__field { min-width: 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: color-mix(in srgb, var(--color-surface-secondary) 30%, transparent); }
    .approval-card__row--changed { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
    .approval-card__field-label { margin-bottom: 6px; color: var(--color-text-primary); font-size: 12px; font-weight: 650; }
    .approval-card__mini { margin-bottom: 2px; color: var(--color-text-secondary); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .approval-card__field-value { color: var(--color-text-primary); font-size: 12px; overflow-wrap: anywhere; }
    .approval-card__row--changed .approval-card__requested { color: var(--color-accent); font-weight: 650; }
    .approval-card__input-wrap { display: flex; min-width: 0; align-items: center; width: 100%; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .approval-card__input-wrap:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .approval-card__input { width: 100%; min-width: 0; padding: 6px 8px; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 12px; outline: none; }
    .approval-card__suffix { padding-right: 8px; color: var(--color-text-secondary); font-size: 12px; }
    .approval-card__field-error { display: block; margin-top: 3px; color: var(--color-danger); font-size: 11px; }
    .approval-card__note { margin: 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: color-mix(in srgb, var(--color-surface-secondary) 30%, transparent); color: var(--color-text-secondary); font-size: 12px; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
    .approval-card__timeline { display: flex; flex-direction: column; gap: 10px; margin: 0 0 16px; padding: 0; list-style: none; }
    .approval-card__event { --tone: var(--color-text-secondary); display: grid; grid-template-columns: 12px minmax(0, 1fr); column-gap: 10px; font-size: 12px; }
    .approval-card__event--request, .approval-card__event--approved { --tone: var(--color-accent); }
    .approval-card__dot { width: 8px; height: 8px; margin-top: 4px; border-radius: 999px; background: var(--tone); }
    .approval-card__event-text { font-weight: 600; overflow-wrap: anywhere; }
    .approval-card__event time { grid-column: 2; color: var(--color-text-secondary); font-size: 11px; }
    .approval-card__footer { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--color-border); background: var(--color-surface); }
    .approval-card__footer button:disabled { opacity: .55; cursor: default; }
    .approval-pill { --tone: var(--color-accent); display: inline-flex; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 500; white-space: nowrap; }
    .approval-pill--neutral { --tone: var(--color-text-secondary); background: var(--color-surface-secondary); }
  `]
})
export class ApprovalExplanationCardComponent {
  detail = input<ApprovalDetailDto | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  comments = input<readonly ApprovalCommentDto[]>([]);
  commentsLoading = input(false);
  busy = input(false);

  closed = output<void>();
  approve = output<string | undefined>();
  reject = output<string | null>();
  cancelRequest = output<void>();
  openTarget = output<void>();
  addComment = output<string>();
  replyComment = output<{ parentId: string; content: string }>();
  editComment = output<{ id: string; content: string }>();

  protected readonly edits = signal<Record<string, string>>({});
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly rejectOpen = signal(false);
  protected readonly priorityOptions = PRIORITY_OPTIONS;
  // Same button styles as the Tree tab explanation panel.
  protected readonly primaryBtn = 'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2.5 text-center text-sm font-medium text-[var(--color-accent-contrast)] shadow-sm transition-[filter,transform] hover:brightness-95 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';
  protected readonly secondaryBtn = 'inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-center text-sm font-medium text-[var(--color-text-secondary)] shadow-sm transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';

  private readonly item = computed(() => this.detail()?.item ?? null);
  private readonly itemId = computed(() => this.item()?.id ?? null);
  protected readonly isInvitation = computed(() => this.item()?.source === 'invitation');
  protected readonly meta = computed(() => APPROVAL_TYPE_META[approvalTypeKey(this.item()?.actionType ?? '')]);
  protected readonly title = computed(() => this.item() ? approvalTitle(this.item()!) : '');
  protected readonly subtitle = computed(() => this.item() ? approvalSubtitle(this.item()!) : '');
  protected readonly statusText = computed(() => this.item() ? statusLabel(this.item()!) : '');
  protected readonly statusToneValue = computed(() => this.item() ? statusTone(this.item()!) : 'neutral');
  protected readonly timeline = computed(() => this.detail() ? buildTimeline(this.detail()!) : []);
  protected readonly canOpenTarget = computed(() => {
    const item = this.item();
    return !!item?.targetId && (item.targetType === 'task' || item.targetType === 'module');
  });

  /** "Approve value" while the caller may edit, "Approved" once an edited payload was applied, else hidden. */
  protected readonly lastColumn = computed<'Approve value' | 'Approved' | null>(() => {
    const d = this.detail();
    if (!d) return null;
    if (d.canEditPayload) return 'Approve value';
    if (d.appliedPayloadJson) return 'Approved';
    return null;
  });

  protected readonly allocationField = computed(() =>
    this.item()?.actionType === 'module.allocation_extend' ? this.detail()!.fields.find((f) => f.kind === 'hours') ?? null : null);

  protected readonly allocationAfter = computed(() => {
    const d = this.detail();
    const f = this.allocationField();
    if (!d || !f) return null;
    const extra = Number(this.edits()[f.key] ?? f.applied ?? f.requested ?? 0);
    return (d.currentAllocatedHours ?? 0) + (Number.isFinite(extra) ? extra : 0);
  });

  constructor() {
    // A different request starts with no edits.
    effect(() => {
      this.itemId();
      this.edits.set({});
      this.fieldErrors.set({});
      this.rejectOpen.set(false);
    });
  }

  protected editValue(field: ApprovalFieldDto): string {
    return this.edits()[field.key] ?? field.requested ?? '';
  }

  protected setEdit(key: string, value: string): void {
    const field = this.detail()?.fields.find((f) => f.key === key);
    this.edits.update((e) => {
      const next = { ...e };
      // Setting a value back to what was requested is no edit.
      if (field && value === (field.requested ?? '')) delete next[key];
      else next[key] = value;
      return next;
    });
    this.fieldErrors.update((e) => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }

  protected display(field: ApprovalFieldDto, value: string | null): string {
    if (value === null || value === '') return '—';
    switch (field.kind) {
      case 'hours': return `${value}h`;
      case 'priority': return value.charAt(0).toUpperCase() + value.slice(1);
      case 'date': {
        const date = new Date(`${value}T00:00:00`);
        return isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
      }
      default: return value;
    }
  }

  protected onApprove(): void {
    const d = this.detail();
    if (!d) return;
    const errors: Record<string, string> = {};
    for (const [key, raw] of Object.entries(this.edits())) {
      const field = d.fields.find((f) => f.key === key);
      if (!field || (field.kind !== 'number' && field.kind !== 'hours') || raw.trim() === '') continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[key] = 'Enter a number.';
      else if (field.kind === 'hours' && n <= 0) errors[key] = 'Hours must be greater than zero.';
    }
    this.fieldErrors.set(errors);
    if (Object.keys(errors).length > 0) return;
    this.approve.emit(buildEditedPayload(d.requestedPayloadJson, d.fields, this.edits()));
  }

  protected onRejectConfirmed(reason: string | null): void {
    this.rejectOpen.set(false);
    this.reject.emit(reason);
  }
}
