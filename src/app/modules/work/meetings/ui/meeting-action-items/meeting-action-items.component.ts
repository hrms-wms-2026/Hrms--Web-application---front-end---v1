import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../../core/auth/state/auth.store';
import { EmployeeDirectoryStore } from '../../../state/employee-directory.store';
import { TaskFormModalComponent } from '../../../ui/task-form-modal/task-form-modal.component';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingActionItemView } from '../../models/meeting.models';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';

/**
 * A meeting occurrence's action items (spec 5.4, D14): ordinary tasks raised from it. Only the tasks the caller may see
 * are listed, and nothing hints at the others. "Add action item" opens the ordinary task form with the source set; the
 * link's creator or the organizer may unlink (the task itself stays).
 */
@Component({
  selector: 'app-meeting-action-items',
  standalone: true,
  imports: [TaskFormModalComponent],
  template: `
    <div class="flex flex-col gap-2 text-xs">
      @for (item of items(); track item.taskId) {
        <div data-testid="action-item-row" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2">
          <span class="truncate"><span class="text-[var(--color-text-secondary)]">{{ item.shortId }}</span> {{ item.title }}</span>
          <span class="flex shrink-0 items-center gap-2 text-[var(--color-text-secondary)]">
            <span>{{ item.statusName }}</span>
            @if (assigneeName(item); as name) { <span>{{ name }}</span> }
            @if (canUnlink(item)) {
              <button type="button" data-testid="action-item-unlink" [attr.aria-label]="'Unlink ' + item.title" (click)="unlink(item)">Unlink</button>
            }
          </span>
        </div>
      }
      @if (error()) {
        <p class="text-[var(--color-danger)]">{{ error() }}</p>
      }
      <button type="button" data-testid="action-item-add"
        class="flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--color-border-strong)] px-4 py-3 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)]"
        (click)="formOpen.set(true)">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        Add action item
      </button>
    </div>
    @if (formOpen()) {
      <app-task-form-modal [open]="true" mode="create" [projectId]="projectId()" [prefillModuleId]="objectiveId()"
        [sourceMeetingOccurrenceId]="occurrenceTaskId()" (created)="onCreated()" (closed)="formOpen.set(false)" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingActionItemsComponent implements OnInit {
  private readonly api = inject(MeetingApiService);
  private readonly auth = inject(AuthStore);
  private readonly directory = inject(EmployeeDirectoryStore);

  readonly occurrenceTaskId = input.required<string>();
  readonly projectId = input.required<string>();
  /** The meeting's module: the default destination for a new action item. */
  readonly objectiveId = input.required<string>();
  readonly isOrganizer = input(false);

  readonly items = signal<readonly MeetingActionItemView[]>([]);
  readonly formOpen = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  canUnlink(item: MeetingActionItemView): boolean {
    return this.isOrganizer() || item.linkedByEmployeeId === this.auth.employeeId();
  }

  assigneeName(item: MeetingActionItemView): string | null {
    return item.assigneeEmployeeId ? this.directory.get(item.assigneeEmployeeId)?.name ?? null : null;
  }

  async unlink(item: MeetingActionItemView): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.unlinkActionItem(this.occurrenceTaskId(), item.taskId));
      await this.load();
    } catch (e) {
      this.error.set(meetingErrorMessage(e instanceof HttpErrorResponse ? e.error?.code : undefined));
    }
  }

  async onCreated(): Promise<void> {
    this.formOpen.set(false);
    await this.load();
  }

  private async load(): Promise<void> {
    try {
      const items = await firstValueFrom(this.api.listActionItems(this.occurrenceTaskId()));
      this.items.set(items);
      const assignees = items.map((i) => i.assigneeEmployeeId).filter((id): id is string => !!id);
      if (assignees.length > 0) await this.directory.ensureLoaded(assignees);
    } catch {
      this.items.set([]);
    }
  }
}
