import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { AttendanceDetailDrawerComponent } from '../../../attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
import { taskBoardUrl } from '../../utils/signal-item-links';

/** Opens a selected signal item in its existing attendance or task detail UI; an exception case opens in the Inbox,
 *  where it is reviewed. */
@Component({
  selector: 'app-signal-item-detail',
  standalone: true,
  imports: [AttendanceDetailDrawerComponent, ModalComponent, TaskFormModalComponent],
  template: `
    @if (selected(); as s) {
      @switch (s.item.kind) {
        @case ('attendance_day') {
          <app-attendance-detail-drawer [selection]="daySelection()" [displayTimezone]="s.timezone ?? 'UTC'" (closed)="close()" />
        }
        @case ('monitoring_alert') {
          <app-attendance-detail-drawer [selection]="daySelection()" [displayTimezone]="s.timezone ?? 'UTC'" (closed)="close()" />
        }
        @case ('task') {
          @if (taskState() === 'ready') {
            <app-task-form-modal [open]="true" mode="edit" [projectId]="s.item.projectId!" [taskId]="s.item.id"
                                 (saved)="changed.emit()" (closed)="close()" />
          } @else if (taskState() === 'failed') {
            <app-modal [open]="true" [title]="s.item.title" size="md" (closed)="close()">
              <p class="text-sm text-slate-600">This task's project could not be opened here.</p>
              <a data-testid="task-board-fallback" class="mt-2 inline-block text-sm font-semibold text-blue-600 hover:underline"
                 [href]="boardUrl()" (click)="openBoard($event)">Open on board →</a>
            </app-modal>
          }
        }
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignalItemDetailComponent {
  private readonly drilldown = inject(SignalDrilldownStore);
  private readonly projects = inject(ProjectDetailStore);
  private readonly router = inject(Router);

  readonly employeeId = input.required<string>();
  readonly changed = output<void>();

  protected readonly selected = computed(() => this.drilldown.selected());
  protected readonly daySelection = computed(() => {
    const selected = this.selected();
    return selected ? { employeeId: this.employeeId(), workDate: selected.item.date } : null;
  });
  protected readonly taskState = signal<'loading' | 'ready' | 'failed'>('loading');
  protected readonly boardUrl = computed(() => {
    const selected = this.selected();
    return selected?.item.kind === 'task' ? taskBoardUrl(selected.item) : '';
  });

  constructor() {
    effect(() => {
      const selected = this.selected();
      if (selected?.item.kind !== 'exception_case') return;
      const id = selected.item.id;
      untracked(() => {
        this.close();
        void this.router.navigate(['/inbox', 'monitoring', 'exception_case', id]);
      });
    });
    effect(() => {
      const selected = this.selected();
      if (selected?.item.kind !== 'task' || !selected.item.projectId) return;
      const projectId = selected.item.projectId;
      untracked(() => {
        this.taskState.set('loading');
        void (async () => {
          await this.projects.loadProject(projectId);
          if (this.projects.projectError()) {
            this.taskState.set('failed');
            return;
          }
          await this.projects.loadMyMilestones(projectId);
          this.taskState.set('ready');
        })();
      });
    });
  }

  close(): void {
    this.drilldown.clearSelection();
  }

  openBoard(event: MouseEvent): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.close();
    void this.router.navigateByUrl(this.boardUrl());
  }
}
