import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { MyTasksApiService } from '../../data-access/my-tasks-api.service';
import { MyTaskItem } from '../../models/my-tasks.model';

@Component({
  selector: 'app-my-tasks-card',
  standalone: true,
  imports: [CardComponent, RouterLink],
  templateUrl: './my-tasks-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTasksCardComponent implements OnInit {
  private readonly api = inject(MyTasksApiService);

  protected readonly tasks = signal<MyTaskItem[]>([]);
  protected readonly loading = signal(true);

  protected readonly overdueTasks = computed(() => this.tasks().filter((t) => t.isOverdue));
  protected readonly upcomingTasks = computed(() => this.tasks().filter((t) => !t.isOverdue));

  ngOnInit(): void {
    this.api.getMyTasks().subscribe({
      next: (response) => {
        this.tasks.set(response.tasks);
        this.loading.set(false);
      },
      error: () => {
        this.tasks.set([]);
        this.loading.set(false);
      }
    });
  }

  protected taskLink(task: MyTaskItem): string[] {
    return ['/work', task.projectId, 'milestones', task.objectiveId, 'my-task'];
  }

  protected dueDateLabel(dueDate: string): string {
    const date = new Date(`${dueDate}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? dueDate
      : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }
}
