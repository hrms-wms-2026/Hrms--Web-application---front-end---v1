import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { TaskProgressApiService } from '../../data-access/task-progress-api.service';
import { TaskProgressResponse } from '../../models/task-progress.model';

export type TaskProgressBucket = 'completed' | 'inProgress' | 'overdue' | 'notStarted';

export interface TaskProgressSegment {
  readonly bucket: TaskProgressBucket;
  readonly count: number;
  readonly dashArray: string;
  readonly dashOffset: number;
}

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BUCKET_LABELS: Record<TaskProgressBucket, string> = {
  completed: 'Completed',
  inProgress: 'In Progress',
  overdue: 'Overdue',
  notStarted: 'Not Started'
};

const BUCKET_COLORS: Record<TaskProgressBucket, string> = {
  completed: 'var(--color-widget-shade-1)',
  inProgress: 'var(--color-widget-shade-2)',
  overdue: 'var(--color-widget-maroon)',
  notStarted: 'var(--color-widget-shade-4)'
};

@Component({
  selector: 'app-task-progress-card',
  standalone: true,
  imports: [CardComponent],
  templateUrl: './task-progress-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TaskProgressCardComponent implements OnInit {
  private readonly api = inject(TaskProgressApiService);

  protected readonly progress = signal<TaskProgressResponse | null>(null);
  protected readonly loading = signal(true);

  protected readonly total = computed(() => this.progress()?.total ?? 0);

  protected readonly bucketOrder: readonly TaskProgressBucket[] = ['completed', 'inProgress', 'overdue', 'notStarted'];

  protected readonly completionPercent = computed(() => {
    const data = this.progress();
    if (!data || data.total === 0) return 0;
    return Math.round((data.completed / data.total) * 100);
  });

  protected readonly segments = computed<TaskProgressSegment[]>(() => {
    const data = this.progress();
    if (!data || data.total === 0) return [];

    const buckets: { bucket: TaskProgressBucket; count: number }[] = [
      { bucket: 'completed', count: data.completed },
      { bucket: 'inProgress', count: data.inProgress },
      { bucket: 'overdue', count: data.overdue },
      { bucket: 'notStarted', count: data.notStarted }
    ];

    let cumulative = 0;
    return buckets
      .filter((b) => b.count > 0)
      .map((b) => {
        const length = (b.count / data.total) * CIRCUMFERENCE;
        const segment: TaskProgressSegment = {
          bucket: b.bucket,
          count: b.count,
          dashArray: `${length} ${CIRCUMFERENCE - length}`,
          dashOffset: -cumulative
        };
        cumulative += length;
        return segment;
      });
  });

  ngOnInit(): void {
    this.api.getMyTaskProgress().subscribe({
      next: (response) => {
        this.progress.set(response);
        this.loading.set(false);
      },
      error: () => {
        this.progress.set(null);
        this.loading.set(false);
      }
    });
  }

  protected bucketLabel(bucket: TaskProgressBucket): string {
    return BUCKET_LABELS[bucket];
  }

  protected bucketColor(bucket: TaskProgressBucket): string {
    return BUCKET_COLORS[bucket];
  }

  protected bucketCount(bucket: TaskProgressBucket): number {
    return this.progress()?.[bucket] ?? 0;
  }
}
