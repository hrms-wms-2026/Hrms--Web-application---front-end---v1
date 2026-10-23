import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../../shared/ui/loader/loader.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { ProjectDetailStore } from '../../../../work/state/project-detail.store';
import { TaskFormModalComponent } from '../../../../work/ui/task-form-modal/task-form-modal.component';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { EmployeeWorkTaskItem } from '../../../models/employee-overview.model';
import { EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';
import { OffboardingWizardStore, offboardingSkippedChecklist } from '../../../state/offboarding-wizard.store';
import { WorkTaskRowComponent } from '../../../ui/work-task-row/work-task-row.component';

export function overallProgressPercent(tasks: readonly EmployeeChecklistTaskResponse[]): number {
  if (tasks.length === 0) return 100;
  const resolved = tasks.filter((t) => t.status === 'completed' || t.status === 'bypassed').length;
  return Math.round((resolved / tasks.length) * 100);
}

type WorkState = 'loading' | 'ready' | 'unavailable';

/** The work still on the leaver's plate - every open task assigned to them - so it can be handed over
 *  before they go. Checklist progress shows as one line above it, only when a checklist was chosen. */
@Component({
  selector: 'app-offboarding-track-exit-work-step',
  standalone: true,
  imports: [ButtonComponent, EmptyStateComponent, LoaderComponent, ModalComponent, TaskFormModalComponent, WorkTaskRowComponent],
  template: `
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Track Exit Work</h3>
        <p class="obs-step-subtitle">Open tasks still assigned to this employee. Reassign or wrap them up before their last working day.</p>
      </div>

      @if (store.tasks().length > 0) {
        <div class="obs-checklist-line" data-testid="exit-checklist-progress">
          <span>Exit checklist</span>
          <div class="obs-checklist-line__bar"><div class="obs-checklist-line__fill" [style.width.%]="checklistPercent()"></div></div>
          <span class="obs-checklist-line__count">{{ resolvedCount() }} / {{ store.tasks().length }} done</span>
        </div>
      }

      @switch (workState()) {
        @case ('loading') {
          <app-loader label="Loading assigned work…" />
        }
        @case ('unavailable') {
          <app-empty-state
            title="Assigned work isn't available"
            description="Their work tasks couldn't be loaded. You can still continue the offboarding."
          />
        }
        @default {
          @if (workTasks().length === 0) {
            <app-empty-state title="No open work" description="Nothing is assigned to this employee right now." />
          } @else {
            <p class="obs-work-summary" data-testid="exit-work-summary">
              {{ workTasks().length }} open task{{ workTasks().length === 1 ? '' : 's' }}@if (overdueCount() > 0) {<span class="obs-work-summary__late"> · {{ overdueCount() }} overdue</span>}
            </p>
            <ul class="space-y-2" data-testid="exit-work-list">
              @for (task of workTasks(); track task.taskId) {
                <li><app-work-task-row [task]="task" (opened)="openTask($event)" /></li>
              }
            </ul>
          }
        }
      }

      @if (openedTask(); as opened) {
        @if (openedTaskState() === 'ready') {
          <app-task-form-modal
            [open]="true"
            mode="edit"
            [projectId]="opened.projectId"
            [taskId]="opened.taskId"
            (saved)="taskChanged.set(true)"
            (changed)="taskChanged.set(true)"
            (closed)="closeTask()"
          />
        } @else if (openedTaskState() === 'failed') {
          <app-modal [open]="true" [title]="opened.title" size="md" (closed)="closeTask()">
            <p class="text-sm text-[var(--color-text-secondary)]">This task's project could not be opened here.</p>
            <button type="button" data-testid="exit-work-board-fallback" class="obs-board-link" (click)="openOnBoard(opened)">
              Open on board →
            </button>
          </app-modal>
        }
      }

      <div class="obs-actions">
        <app-button variant="primary" (pressed)="store.goToStep('complete_or_bypass')">
          {{ skipsTaskResolution() ? 'Continue to Complete Exit' : 'Continue to Task Resolution' }}
        </app-button>
      </div>
    </div>
  `,
  styles: [`
    .obs-step-header {
      margin-bottom: 1.25rem;
    }
    .obs-step-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .obs-step-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.825rem;
      color: var(--color-text-secondary);
    }
    .obs-checklist-line {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .obs-checklist-line__bar {
      flex: 1;
      max-width: 16rem;
      height: 0.375rem;
      border-radius: 999px;
      background: color-mix(in srgb, var(--color-border) 60%, transparent);
      overflow: hidden;
    }
    .obs-checklist-line__fill {
      height: 100%;
      border-radius: 999px;
      background: var(--color-accent);
    }
    .obs-checklist-line__count {
      font-weight: 500;
      color: var(--color-text-secondary);
    }
    .obs-work-summary {
      margin: 0 0 0.75rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-text-secondary);
    }
    .obs-work-summary__late {
      color: var(--color-danger-text);
    }
    .obs-board-link {
      margin-top: 0.5rem;
      padding: 0;
      border: 0;
      background: none;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--color-accent);
      cursor: pointer;
    }
    .obs-board-link:hover {
      text-decoration: underline;
    }
    .obs-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.5rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingTrackExitWorkStepComponent {
  private readonly api = inject(OffboardingApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projects = inject(ProjectDetailStore);
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  readonly workTasks = signal<readonly EmployeeWorkTaskItem[]>([]);
  readonly workState = signal<WorkState>('loading');
  /** The work item opened in place (Work task detail modal over this step). */
  readonly openedTask = signal<EmployeeWorkTaskItem | null>(null);
  readonly openedTaskState = signal<'loading' | 'ready' | 'failed'>('loading');
  /** Set when the open task was edited, so the list refreshes on close (e.g. reassigned away). */
  readonly taskChanged = signal(false);
  readonly overdueCount = computed(() => this.workTasks().filter((t) => t.bucket === 'overdue').length);

  /** No checklist: Continue goes straight to Complete Employee Exit (the store skips Task Resolution). */
  readonly skipsTaskResolution = computed(() => offboardingSkippedChecklist(this.store.record()));

  readonly checklistPercent = computed(() => overallProgressPercent(this.store.tasks()));
  readonly resolvedCount = computed(() =>
    this.store.tasks().filter((t) => t.status === 'completed' || t.status === 'bypassed').length);

  constructor() {
    effect(() => {
      const id = this.employeeId();
      untracked(() => this.loadWork(id));
    });
  }

  /** Opens the work item in the Work task detail modal right here; the board is only a fallback. */
  async openTask(task: EmployeeWorkTaskItem): Promise<void> {
    this.taskChanged.set(false);
    this.openedTaskState.set('loading');
    this.openedTask.set(task);
    await this.projects.loadProject(task.projectId);
    if (this.openedTask()?.taskId !== task.taskId) return;
    if (this.projects.projectError()) {
      this.openedTaskState.set('failed');
      return;
    }
    await this.projects.loadMyMilestones(task.projectId);
    if (this.openedTask()?.taskId === task.taskId) this.openedTaskState.set('ready');
  }

  closeTask(): void {
    this.openedTask.set(null);
    if (this.taskChanged()) {
      this.taskChanged.set(false);
      this.loadWork(this.employeeId());
    }
  }

  openOnBoard(task: EmployeeWorkTaskItem): void {
    this.openedTask.set(null);
    void this.router.navigate(['/work', task.projectId, 'board'], { queryParams: { taskId: task.taskId } });
  }

  private loadWork(employeeId: string): void {
    this.workState.set('loading');
    this.api.getOpenWorkTasks(employeeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tasks) => {
          this.workTasks.set(tasks);
          this.workState.set('ready');
        },
        // No work module or no access: never block the offboarding over it.
        error: () => this.workState.set('unavailable')
      });
  }
}
