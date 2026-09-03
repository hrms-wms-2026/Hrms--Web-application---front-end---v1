import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { MyTasksApiService } from '../../data-access/my-tasks-api.service';
import { MyTaskItem } from '../../models/my-tasks.model';

/** "Show only the most relevant tasks, not the full task list" (dashboard spec) - the card
 * shows at most this many rows total, overdue first, then upcoming filling the rest. */
const MAX_VISIBLE_TASKS = 4;

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

  private readonly allOverdueTasks = computed(() => this.tasks().filter((t) => t.isOverdue));
  private readonly allUpcomingTasks = computed(() => this.tasks().filter((t) => !t.isOverdue));

  protected readonly overdueTasks = computed(() => this.allOverdueTasks().slice(0, MAX_VISIBLE_TASKS));
  protected readonly upcomingTasks = computed(() =>
    this.allUpcomingTasks().slice(0, Math.max(0, MAX_VISIBLE_TASKS - this.overdueTasks().length))
  );

  protected readonly hasMoreTasks = computed(() => this.tasks().length > MAX_VISIBLE_TASKS);
  protected readonly hiddenTaskCount = computed(() => Math.max(0, this.tasks().length - MAX_VISIBLE_TASKS));

  // No dedicated cross-project "all tasks" page exists yet - "View all tasks" links to
  // the most urgent task's project My Task view instead, since that's the closest thing
  // to a full list.
  protected readonly viewAllTasksLink = computed<string[] | null>(() => {
    const first = this.tasks()[0];
    return first ? this.myTaskListLink(first) : null;
  });

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
    return ['/work', task.projectId, 'task', task.taskId];
  }

  private myTaskListLink(task: MyTaskItem): string[] {
    return ['/work', task.projectId, 'milestones', task.objectiveId, 'my-task'];
  }

  protected dueDateLabel(dueDate: string): string {
    const date = new Date(`${dueDate}T00:00:00Z`);
    return Number.isNaN(date.getTime())
      ? dueDate
      : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  }
}
