import { DatePipe } from '@angular/common';
import { Component, PendingTasks, effect, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { SprintActivityDto } from '../../models/dto/sprint.dto';

const VERBS: Record<SprintActivityDto['action'], string> = {
  created: 'created the sprint',
  edited: 'edited the sprint',
  started: 'started the sprint',
  completed: 'completed the sprint',
  achieved: 'achieved the sprint',
  tasks_added: 'added {n} task(s)',
  tasks_removed: 'removed {n} task(s)'
};

interface HistoryRow {
  id: string;
  employeeName: string;
  verb: string;
  occurredAt: string;
}

@Component({
  selector: 'app-sprint-history',
  standalone: true,
  imports: [DatePipe],
  template: `
    <div class="sprint-history">
      <button type="button" class="sprint-history__toggle" (click)="expanded.set(!expanded())" [attr.aria-expanded]="expanded()">
        <svg class="sprint-history__toggle-icon" [class.rotate-90]="expanded()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
        <span>History ({{ entries().length }})</span>
      </button>

      @if (expanded()) {
        <div class="sprint-history__body">
          @if (loading()) {
            <div class="sprint-history__state">Loading…</div>
          } @else if (error()) {
            <div class="sprint-history__state">Couldn't load history.</div>
          } @else if (entries().length === 0) {
            <div class="sprint-history__state">No activity yet.</div>
          } @else {
            @for (row of entries(); track row.id) {
              <div class="sprint-history__row" data-testid="sprint-history-row">
                <span class="sprint-history__text">{{ row.employeeName }} {{ row.verb }}</span>
                <span class="sprint-history__date">{{ row.occurredAt | date: 'd MMM HH:mm' }}</span>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .sprint-history { margin-top: 10px; border-top: 1px solid var(--color-border); padding-top: 8px; }
    .sprint-history__toggle { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--color-text-secondary); padding: 0; }
    .sprint-history__toggle-icon { width: 12px; height: 12px; transition: transform 150ms ease; }
    .sprint-history__toggle-icon.rotate-90 { transform: rotate(90deg); }
    .sprint-history__body { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
    .sprint-history__row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; color: var(--color-text-secondary); }
    .sprint-history__date { flex: 0 0 auto; color: var(--color-text-tertiary, var(--color-text-secondary)); }
    .sprint-history__state { font-size: 12px; color: var(--color-text-secondary); }
  `]
})
export class SprintHistoryComponent {
  sprintId = input.required<string>();

  private readonly sprintApi = inject(SprintApiService);
  private readonly directory = inject(EmployeeDirectoryStore);
  private readonly pendingTasks = inject(PendingTasks);

  protected readonly expanded = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly entries = signal<HistoryRow[]>([]);

  constructor() {
    effect(() => {
      const id = this.sprintId();
      void this.pendingTasks.run(() => this.load(id));
    });
  }

  private async load(sprintId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const activities = await firstValueFrom(this.sprintApi.getActivity(sprintId));
      const uniqueEmployeeIds = [...new Set(activities.map((a) => a.employeeId))];
      await this.directory.ensureLoaded(uniqueEmployeeIds);

      const sorted = [...activities].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );

      this.entries.set(
        sorted.map((activity) => ({
          id: activity.id,
          employeeName: this.directory.get(activity.employeeId)?.name ?? 'Unknown employee',
          verb: this.formatVerb(activity),
          occurredAt: activity.occurredAt
        }))
      );
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private formatVerb(activity: SprintActivityDto): string {
    const template = VERBS[activity.action];
    if (!template.includes('{n}')) return template;

    let count: number | null;
    try {
      count = activity.detailsJson ? JSON.parse(activity.detailsJson).taskIds.length : null;
    } catch {
      count = null;
    }

    return count == null ? template.replace('{n} ', '') : template.replace('{n}', String(count));
  }
}
