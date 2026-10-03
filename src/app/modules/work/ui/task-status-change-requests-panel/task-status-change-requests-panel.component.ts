import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskStatusChangeRequestApiService } from '../../data-access/task-status-change-request-api.service';
import { TaskStatusChangeRequestDto } from '../../models/dto/task-status-change-request.dto';
import { describeStatusChangeSet } from '../../utils/task-status-change-set';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

/**
 * Pending task-status change requests the caller can decide on (they own or belong to the
 * project's top module). Renders nothing for anyone else.
 */
@Component({
  selector: 'app-task-status-change-requests-panel',
  standalone: true,
  imports: [DatePipe, ButtonComponent],
  template: `
    @if (decidable().length > 0) {
      <section class="status-requests" data-testid="task-status-change-requests">
        <h2>Task Status Change Requests <span>{{ decidable().length }}</span></h2>
        @for (req of decidable(); track req.id) {
          <article class="status-requests__card" [attr.data-testid]="'task-status-change-request-' + req.id">
            <div class="status-requests__body">
              <p class="status-requests__meta">
                <strong>{{ req.requesterDisplayName }}</strong> requested changes to the task statuses
                <span> · {{ req.createdAt | date: 'MMM d, y' }}</span>
              </p>
              <ul class="status-requests__changes">
                @for (line of lines(req); track $index) {
                  <li>{{ line }}</li>
                }
              </ul>
              @if (req.note) {
                <p class="status-requests__note">"{{ req.note }}"</p>
              }
              @if (rejectingId() === req.id) {
                <textarea
                  class="status-requests__comment"
                  aria-label="Reason for rejecting"
                  placeholder="Reason (optional)"
                  rows="2"
                  maxlength="1000"
                  [value]="rejectComment()"
                  (input)="rejectComment.set($any($event.target).value)"
                ></textarea>
              }
              @if (errors()[req.id]) {
                <p class="status-requests__error" role="alert">{{ errors()[req.id] }}</p>
              }
            </div>
            <div class="status-requests__actions">
              @if (rejectingId() === req.id) {
                <app-button variant="secondary" [disabled]="busyId() !== null" (pressed)="rejectingId.set(null)">Back</app-button>
                <app-button variant="danger" [disabled]="busyId() !== null" (pressed)="reject(req)">Confirm reject</app-button>
              } @else {
                <app-button variant="secondary" [disabled]="busyId() !== null" (pressed)="startReject(req)">Reject</app-button>
                <app-button variant="primary" [disabled]="busyId() !== null" [loading]="busyId() === req.id" (pressed)="approve(req)">Approve</app-button>
              }
            </div>
          </article>
        }
      </section>
    }
  `,
  styles: [`
    .status-requests { display: flex; flex-direction: column; gap: 10px; }
    .status-requests h2 { display: flex; align-items: center; gap: 7px; margin: 0; color: var(--color-text-primary); font-size: 14px; font-weight: 650; }
    .status-requests h2 span { display: inline-flex; min-width: 22px; height: 22px; align-items: center; justify-content: center; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; font-weight: 650; }
    .status-requests__card { display: flex; align-items: flex-start; justify-content: space-between; gap: 22px; padding: 12px 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: 0 2px 8px rgb(15 23 42 / .035); }
    .status-requests__body { min-width: 0; flex: 1; }
    .status-requests__meta { margin: 0; color: var(--color-text-secondary); font-size: 12.5px; }
    .status-requests__meta strong { color: var(--color-text-primary); font-weight: 600; }
    .status-requests__changes { margin: 6px 0 0; padding-left: 18px; color: var(--color-text-primary); font-size: 13px; line-height: 1.5; }
    .status-requests__note { margin: 6px 0 0; color: var(--color-text-secondary); font-size: 12.5px; font-style: italic; }
    .status-requests__comment { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 6px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 12.5px; resize: vertical; }
    .status-requests__error { margin: 6px 0 0; color: var(--color-danger-text, #ef4444); font-size: 12px; }
    .status-requests__actions { display: flex; flex-shrink: 0; gap: 8px; }
    @media (max-width: 680px) { .status-requests__card { flex-direction: column; } }
  `],
})
export class TaskStatusChangeRequestsPanelComponent {
  private readonly api = inject(TaskStatusChangeRequestApiService);

  readonly projectId = input.required<string>();
  /** Emits the number of requests the caller can decide, so the host can account for them. */
  readonly countChange = output<number>();

  protected readonly requests = signal<TaskStatusChangeRequestDto[]>([]);
  protected readonly decidable = computed(() => this.requests().filter((r) => r.canDecide));
  protected readonly busyId = signal<string | null>(null);
  protected readonly rejectingId = signal<string | null>(null);
  protected readonly rejectComment = signal('');
  protected readonly errors = signal<Record<string, string>>({});
  private loadVersion = 0;

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      untracked(() => void this.load(projectId));
    });
    effect(() => {
      const count = this.decidable().length;
      untracked(() => this.countChange.emit(count));
    });
  }

  protected lines(request: TaskStatusChangeRequestDto): string[] {
    return describeStatusChangeSet(request.changes);
  }

  async load(projectId = this.projectId()): Promise<void> {
    if (!projectId) return;
    const version = ++this.loadVersion;
    try {
      const result = await firstValueFrom(this.api.getForProject(projectId));
      if (version === this.loadVersion) this.requests.set(result.requests);
    } catch {
      if (version === this.loadVersion) this.requests.set([]);
    }
  }

  protected async approve(request: TaskStatusChangeRequestDto): Promise<void> {
    this.busyId.set(request.id);
    this.setError(request.id, null);
    try {
      await firstValueFrom(this.api.approve(request.id));
      // Approving can close other overlapping requests as stale (and a stale approve closes this
      // one), so refetch rather than filter.
      await this.load();
    } catch (error) {
      this.setError(request.id, this.errorText(error, 'Failed to approve.'));
      if ((error as { status?: number })?.status === 409) await this.load();
    } finally {
      this.busyId.set(null);
    }
  }

  protected startReject(request: TaskStatusChangeRequestDto): void {
    this.rejectComment.set('');
    this.rejectingId.set(request.id);
  }

  protected async reject(request: TaskStatusChangeRequestDto): Promise<void> {
    this.busyId.set(request.id);
    this.setError(request.id, null);
    try {
      await firstValueFrom(this.api.reject(request.id, this.rejectComment().trim() || null));
      this.rejectingId.set(null);
      this.requests.update((list) => list.filter((r) => r.id !== request.id));
    } catch (error) {
      this.setError(request.id, this.errorText(error, 'Failed to reject.'));
    } finally {
      this.busyId.set(null);
    }
  }

  private setError(id: string, message: string | null): void {
    this.errors.update((all) => {
      const next = { ...all };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }

  private errorText(error: unknown, fallback: string): string {
    const e = error as { error?: { detail?: string; message?: string }; message?: string };
    return e?.error?.detail || e?.error?.message || fallback;
  }
}
