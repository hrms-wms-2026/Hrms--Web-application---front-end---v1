import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-detail-modal',
  standalone: true,
  imports: [ModalComponent, DatePipe],
  template: `
    <app-modal [open]="open()" [title]="task()?.shortId ?? ''" size="lg" (closed)="onClose()">
      @if (task(); as t) {
        <div class="flex flex-col gap-3">
          <h3 class="text-base font-semibold text-[var(--color-text-primary)]">{{ t.title }}</h3>
          @if (t.description) {
            <p class="text-sm text-[var(--color-text-secondary)]">{{ t.description }}</p>
          }
          <dl class="task-detail__grid">
            <dt>Type</dt><dd>{{ t.taskType }}</dd>
            <dt>Priority</dt><dd>{{ t.priority }}</dd>
            <dt>Due date</dt><dd>{{ t.dueDate ? (t.dueDate | date: 'MMM d, y') : '—' }}</dd>
            <dt>Estimated hours</dt><dd>{{ t.estimatedHours ?? '—' }}</dd>
            <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
            <dt>Progress</dt><dd>{{ t.progressPercent }}%</dd>
            @if (t.storyPoints) {
              <dt>Story points</dt><dd>{{ t.storyPoints }}</dd>
            }
          </dl>
        </div>
      }
    </app-modal>
  `,
  styles: [`
    .task-detail__grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; }
    .task-detail__grid dt { color: var(--color-text-secondary); }
    .task-detail__grid dd { margin: 0; color: var(--color-text-primary); }
  `]
})
export class TaskDetailModalComponent {
  open = input(false);
  task = input<WorkTask | null>(null);
  closed = output<void>();

  onClose(): void {
    this.closed.emit();
  }
}
