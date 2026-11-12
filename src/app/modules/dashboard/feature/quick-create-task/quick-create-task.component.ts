import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { ProjectListItemDto } from '../../../work/models/dto/project.dto';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { widgetInkOn, widgetShadeFor } from '../../utils/widget-palette';

/** Same cap as the Active projects card: `/work/projects/mine` has no status filter. */
const PROJECT_PAGE_SIZE = 100;

type Step = 'idle' | 'loading' | 'pick' | 'none' | 'error' | 'form';

/**
 * "Create Task" from the dashboard: a task always belongs to a project, so this asks which one
 * (skipped when the viewer has exactly one active project) and then opens Work's own task form
 * popup for it - the same form as a project's backlog, which loads that project's modules,
 * sprints and categories itself, and shows its own success / sent-for-approval toast. Like the
 * backlog, a created task closes it. The form is lazy-loaded the first time it is needed.
 */
@Component({
  selector: 'app-quick-create-task',
  standalone: true,
  imports: [ModalComponent, TaskFormModalComponent],
  template: `
    <app-modal
      [open]="pickerOpen()"
      title="Create task"
      subtitle="Choose the project this task belongs to"
      icon="checklist"
      (closed)="close()"
    >
      @switch (step()) {
        @case ('loading') {
          <div class="flex flex-col gap-2 animate-pulse" data-testid="quick-create-task-loading">
            @for (row of [1, 2, 3]; track row) {
              <div class="h-12 rounded-xl bg-[var(--color-surface-secondary)]"></div>
            }
          </div>
        }
        @case ('error') {
          <p class="text-sm text-[var(--color-text-secondary)]" data-testid="quick-create-task-error">
            Couldn't load your projects.
            <button type="button" class="ml-1 font-semibold text-[var(--color-accent)] hover:underline" (click)="load()">Retry</button>
          </p>
        }
        @case ('none') {
          <p class="text-sm text-[var(--color-text-secondary)]" data-testid="quick-create-task-none">
            You're not on any active project yet, so there is nowhere to add a task.
          </p>
        }
        @default {
          <ul class="flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
            @for (project of projects(); track project.id) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-left transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]/40"
                  [attr.data-testid]="'quick-create-task-project-' + project.id"
                  (click)="choose(project.id)"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                    [style.background-color]="shade(project)"
                    [style.color]="ink(project)"
                    aria-hidden="true"
                  >{{ initial(project) }}</span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-semibold text-[var(--color-text-primary)]">{{ project.name }}</span>
                    <span class="block truncate text-xs text-[var(--color-text-secondary)]">{{ project.identifier }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      }
    </app-modal>

    @if (projectId(); as id) {
      @defer (on immediate) {
        <app-task-form-modal
          [open]="step() === 'form'"
          mode="create"
          [projectId]="id"
          (created)="close()"
          (closed)="close()"
        />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickCreateTaskComponent {
  private readonly api = inject(ProjectApiService);
  private readonly destroyRef = inject(DestroyRef);

  /** Set true to start; the host sets it false again on `closed`. */
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly step = signal<Step>('idle');
  protected readonly projects = signal<ProjectListItemDto[]>([]);
  protected readonly projectId = signal<string | null>(null);
  protected readonly pickerOpen = computed(() => ['loading', 'pick', 'none', 'error'].includes(this.step()));

  constructor() {
    effect(() => {
      const open = this.open();
      untracked(() => {
        if (open && this.step() === 'idle') this.load();
        if (!open) this.reset();
      });
    });
  }

  load(): void {
    this.step.set('loading');
    this.api
      .listMine(1, PROJECT_PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const active = page.items.filter((p) => p.isActive && !p.isAchieved);
          this.projects.set(active);
          if (active.length === 1) this.choose(active[0].id);
          else this.step.set(active.length === 0 ? 'none' : 'pick');
        },
        error: () => this.step.set('error')
      });
  }

  protected choose(projectId: string): void {
    this.projectId.set(projectId);
    this.step.set('form');
  }

  /** Monochrome widgets: a theme shade picked from the project id, never the stored project colour. */
  protected shade(project: ProjectListItemDto): string {
    return widgetShadeFor(project.id);
  }

  protected ink(project: ProjectListItemDto): string {
    return widgetInkOn(widgetShadeFor(project.id));
  }

  protected initial(project: ProjectListItemDto): string {
    return (project.name.trim()[0] ?? '?').toUpperCase();
  }

  protected close(): void {
    this.reset();
    this.closed.emit();
  }

  private reset(): void {
    this.step.set('idle');
    this.projectId.set(null);
  }
}
