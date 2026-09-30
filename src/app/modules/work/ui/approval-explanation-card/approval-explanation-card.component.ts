import { DatePipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { ApprovalTypeIconComponent } from '../approval-type-icon/approval-type-icon.component';
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
  imports: [DatePipe, AvatarComponent, DatePickerComponent, WorkDropdownComponent, ApprovalTypeIconComponent, ApprovalCommentsComponent, ApprovalRejectDialogComponent],
  template: `
    <aside class="approval-card" data-testid="approval-card" aria-label="Request details">
      <button type="button" class="approval-card__close" data-testid="approval-card-close" aria-label="Close details" (click)="closed.emit()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>

      @if (loading() && !detail()) {
        <p class="approval-card__muted" data-testid="approval-card-loading">Loading request…</p>
      } @else if (!detail()) {
        @if (error()) { <p class="approval-card__error" role="alert">{{ error() }}</p> }
      } @else {
        @let d = detail()!;
        @let item = d.item;
        <div class="approval-card__scroll">
          <header class="approval-card__header">
            <div class="approval-card__kind">
              <app-approval-type-icon [icon]="meta().icon" [tone]="meta().tone" />
              <span>{{ meta().label }}</span>
            </div>
            <span data-testid="approval-card-status" [class]="'approval-pill approval-pill--' + statusToneValue()">{{ statusText() }}</span>
          </header>
          <h2 class="approval-card__title">{{ title() }}</h2>
          <p class="approval-card__subtitle">{{ subtitle() }}</p>

          @if (error()) { <p class="approval-card__error" role="alert" data-testid="approval-card-error">{{ error() }}</p> }

          <section class="approval-card__section">
            <h3>Details</h3>
            <dl class="approval-card__details">
              <dt>Module</dt><dd>{{ item.moduleTitle ?? '—' }}</dd>
              <dt>Project</dt><dd>{{ item.projectName }}</dd>
              <dt>Requested by</dt>
              <dd class="approval-card__person"><app-avatar [userName]="item.requestedByName" size="sm" /><span>{{ item.requestedByName }}</span></dd>
              <dt>Requested on</dt><dd>{{ item.createdAt | date: 'MMM d, y h:mm a' }}</dd>
              <dt>{{ item.source === 'invitation' ? 'Invitee' : 'Approver' }}</dt>
              <dd class="approval-card__person"><app-avatar [userName]="item.approverName" size="sm" /><span>{{ item.approverName }}</span></dd>
              @if (item.decidedAt) {
                <dt>Decided by</dt><dd>{{ item.decidedByName ?? item.approverName }}</dd>
                <dt>Decided on</dt><dd>{{ item.decidedAt | date: 'MMM d, y h:mm a' }}</dd>
              }
              @if (item.decisionComment) {
                <dt>Reason</dt><dd data-testid="approval-card-decision-reason">{{ item.decisionComment }}</dd>
              }
            </dl>
            @if (canOpenTarget()) {
              <button type="button" class="approval-card__link" data-testid="approval-card-open-target" (click)="openTarget.emit()">
                {{ item.targetType === 'task' ? 'Open task' : 'Open module' }}
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
              </button>
            }
          </section>

          @if (d.invitation; as inv) {
            <section class="approval-card__section" data-testid="approval-card-invitation">
              <h3>Invitation</h3>
              <dl class="approval-card__details">
                <dt>Invitee</dt>
                <dd class="approval-card__person"><app-avatar [userName]="inv.inviteeName" size="sm" /><span>{{ inv.inviteeName }}</span></dd>
                <dt>Invited as</dt><dd class="approval-card__cap">{{ inv.inviteType }}</dd>
                <dt>Module</dt><dd>{{ inv.moduleTitle }}</dd>
                <dt>Invited by</dt><dd>{{ inv.invitedByName }}</dd>
                <dt>Expires</dt><dd>{{ inv.expiresAt ? (inv.expiresAt | date: 'MMM d, y') : 'Never' }}</dd>
              </dl>
            </section>
          }

          @if (d.fields.length > 0) {
            <section class="approval-card__section">
              <h3>Changes</h3>
              @if (d.currentAllocatedHours !== null && allocationField(); as f) {
                <p class="approval-card__allocation" data-testid="approval-card-allocation">
                  Current allocation <strong>{{ d.currentAllocatedHours }}h</strong>
                  → <strong>{{ allocationAfter() }}h</strong> after approval
                </p>
              }
              <div class="approval-card__table-wrap">
                <table class="approval-card__changes" data-testid="approval-card-changes">
                  <thead>
                    <tr>
                      <th scope="col">Field</th>
                      <th scope="col">Current</th>
                      <th scope="col">Requested</th>
                      @if (lastColumn()) { <th scope="col" data-testid="approval-card-last-col">{{ lastColumn() }}</th> }
                    </tr>
                  </thead>
                  <tbody>
                    @for (f of d.fields; track f.key) {
                      <tr [class.approval-card__row--changed]="f.changed" data-testid="approval-card-field" [attr.data-key]="f.key">
                        <th scope="row">{{ f.label }}</th>
                        <td>{{ display(f, f.current) }}</td>
                        <td class="approval-card__requested">{{ display(f, f.requested) }}</td>
                        @if (lastColumn() === 'Approve value') {
                          <td>
                            @if (f.editable) {
                              @switch (f.kind) {
                                @case ('date') {
                                  <app-date-picker [value]="editValue(f)" [showQuickPresets]="false" [ariaLabel]="f.label" [inputTestId]="'approval-edit-' + f.key"
                                    (valueChange)="setEdit(f.key, $event)" />
                                }
                                @case ('priority') {
                                  <app-work-dropdown size="sm" [options]="priorityOptions" [selected]="editValue(f)" [accessibleLabel]="f.label"
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
                            } @else {
                              {{ display(f, f.requested) }}
                            }
                          </td>
                        } @else if (lastColumn() === 'Approved') {
                          <td class="approval-card__applied">{{ display(f, f.applied ?? f.requested) }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }

          @if (d.note) {
            <section class="approval-card__section">
              <h3>Reason / note</h3>
              <p class="approval-card__note" data-testid="approval-card-note">{{ d.note }}</p>
            </section>
          }

          <section class="approval-card__section">
            <h3>Activity</h3>
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
              <button type="button" class="approval-card__btn approval-card__btn--danger" data-testid="approval-card-reject" [disabled]="busy()" (click)="rejectOpen.set(true)">
                {{ isInvitation() ? 'Decline' : 'Reject' }}
              </button>
              <button type="button" class="approval-card__btn approval-card__btn--primary" data-testid="approval-card-approve" [disabled]="busy()" (click)="onApprove()">
                {{ isInvitation() ? 'Accept' : 'Approve' }}
              </button>
            } @else {
              <button type="button" class="approval-card__btn approval-card__btn--secondary" data-testid="approval-card-cancel" [disabled]="busy()" (click)="cancelRequest.emit()">
                Cancel request
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
    :host { display: block; min-width: 0; height: 100%; }
    .approval-card { position: relative; display: flex; height: 100%; max-height: calc(100vh - 140px); flex-direction: column; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); color: var(--color-text-primary); }
    .approval-card__scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 20px 16px; }
    .approval-card__close { position: absolute; top: 12px; right: 12px; z-index: 1; display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .approval-card__close:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .approval-card__close svg, .approval-card__link svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .approval-card__muted { margin: 0; padding: 24px 20px; color: var(--color-text-secondary); font-size: 13px; }
    .approval-card__error { margin: 8px 0; padding: 8px 10px; border-radius: 8px; background: color-mix(in srgb, var(--color-danger) 10%, transparent); color: var(--color-danger); font-size: 12px; }
    .approval-card__header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-right: 32px; }
    .approval-card__kind { display: inline-flex; align-items: center; gap: 8px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .approval-card__title { margin: 14px 0 2px; font-size: 20px; font-weight: 700; line-height: 1.25; }
    .approval-card__subtitle { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
    .approval-card__section { margin-top: 20px; }
    .approval-card__section h3 { margin: 0 0 8px; font-size: 14px; font-weight: 650; }
    .approval-card__details { display: grid; grid-template-columns: minmax(96px, 36%) 1fr; margin: 0; border: 1px solid var(--color-border); border-radius: 10px; overflow: hidden; font-size: 13px; }
    .approval-card__details dt, .approval-card__details dd { margin: 0; padding: 9px 12px; border-bottom: 1px solid var(--color-border); }
    .approval-card__details dt { color: var(--color-text-secondary); }
    .approval-card__details dd { font-weight: 550; overflow-wrap: anywhere; }
    .approval-card__details dt:nth-last-of-type(1), .approval-card__details dd:last-child { border-bottom: 0; }
    .approval-card__person { display: flex; align-items: center; gap: 8px; }
    .approval-card__cap { text-transform: capitalize; }
    .approval-card__link { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; }
    .approval-card__allocation { margin: 0 0 8px; color: var(--color-text-secondary); font-size: 12px; }
    .approval-card__allocation strong { color: var(--color-text-primary); }
    .approval-card__table-wrap { overflow-x: auto; }
    .approval-card__changes { width: 100%; border-collapse: collapse; font-size: 12px; }
    .approval-card__changes th, .approval-card__changes td { padding: 8px 8px; border-bottom: 1px solid var(--color-border); text-align: left; vertical-align: middle; }
    .approval-card__changes thead th { background: var(--color-surface-secondary); color: var(--color-text-secondary); font-weight: 600; white-space: nowrap; }
    .approval-card__changes tbody th { color: var(--color-text-secondary); font-weight: 550; white-space: nowrap; }
    .approval-card__row--changed .approval-card__requested { background: color-mix(in srgb, var(--color-accent) 9%, transparent); color: var(--color-accent); font-weight: 650; }
    .approval-card__applied { font-weight: 650; }
    .approval-card__input-wrap { display: inline-flex; align-items: center; width: 100%; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .approval-card__input-wrap:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .approval-card__input { width: 100%; min-width: 70px; padding: 6px 8px; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; outline: none; }
    .approval-card__suffix { padding-right: 8px; color: var(--color-text-secondary); }
    .approval-card__field-error { display: block; margin-top: 3px; color: var(--color-danger); font-size: 11px; }
    .approval-card__note { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--color-surface-secondary); font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
    .approval-card__timeline { display: flex; flex-direction: column; gap: 10px; margin: 0 0 16px; padding: 0; list-style: none; }
    .approval-card__event { --tone: var(--color-accent); position: relative; display: grid; grid-template-columns: 12px 1fr; column-gap: 10px; font-size: 12px; }
    .approval-card__event--approved { --tone: var(--color-success); }
    .approval-card__event--rejected { --tone: var(--color-danger); }
    .approval-card__event--cancelled, .approval-card__event--stale { --tone: var(--color-text-secondary); }
    .approval-card__dot { width: 10px; height: 10px; margin-top: 3px; border: 2px solid var(--tone); border-radius: 999px; background: color-mix(in srgb, var(--tone) 25%, transparent); }
    .approval-card__event-text { font-weight: 600; }
    .approval-card__event time { grid-column: 2; color: var(--color-text-secondary); font-size: 11px; }
    .approval-card__footer { position: sticky; bottom: 0; display: flex; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--color-border); border-radius: 0 0 14px 14px; background: var(--color-surface); }
    .approval-card__btn { flex: 1; min-height: 40px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; }
    .approval-card__btn:disabled { opacity: .55; cursor: default; }
    .approval-card__btn--primary { flex: 1.4; border: 1px solid var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast); }
    .approval-card__btn--danger { border: 1px solid var(--color-danger); background: transparent; color: var(--color-danger); }
    .approval-card__btn--secondary { border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); }
    .approval-pill { --tone: var(--color-accent); display: inline-flex; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 14%, transparent); color: color-mix(in srgb, var(--tone) 78%, var(--color-text-primary)); font-size: 12px; font-weight: 600; white-space: nowrap; }
    .approval-pill--success { --tone: var(--color-success); }
    .approval-pill--warning { --tone: var(--color-warning); }
    .approval-pill--danger { --tone: var(--color-danger); }
    .approval-pill--neutral { --tone: var(--color-text-secondary); }
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
