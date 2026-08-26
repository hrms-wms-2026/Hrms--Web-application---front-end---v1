import { Component, inject, input, output } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

@Component({
  selector: 'app-task-history-feed',
  standalone: true,
  template: `
    @if (entries().length === 0) {
      <p class="task-history-feed__empty">No changes yet</p>
    } @else {
      <ul class="task-history-feed__list">
        @for (entry of entries(); track entry.occurredAt + entry.type + (entry.edit?.logId ?? entry.statusChange?.fromStatusId ?? entry.clockSession?.sessionId ?? entry.percentageChange?.logId ?? '')) {
          <li data-testid="history-entry" class="task-history-feed__entry">
            <span class="task-history-feed__actor">{{ entry.employeeName }}</span>
            <span class="task-history-feed__summary">{{ summaryFor(entry) }}</span>
            @if (entry.type === 'clock_session' && entry.clockSession; as cs) {
              @if (cs.sessionReason) {
                <p class="task-history-feed__note">{{ cs.sessionReason }}</p>
              } @else {
                <button [attr.data-testid]="'add-note-' + cs.sessionId" type="button" (click)="addNote('session', cs.sessionId)">
                  Add a note
                </button>
              }
              @if (cs.percentageReason) {
                <p class="task-history-feed__note">{{ cs.percentageReason }}</p>
              } @else if (cs.percentageLogId) {
                <button [attr.data-testid]="'add-note-' + cs.percentageLogId" type="button" (click)="addNote('percentage', cs.percentageLogId)">
                  Add a note
                </button>
              }
            }
            @if (entry.type === 'percentage_change' && entry.percentageChange; as pc) {
              @if (pc.reason) {
                <p class="task-history-feed__note">{{ pc.reason }}</p>
              } @else {
                <button [attr.data-testid]="'add-note-' + pc.logId" type="button" (click)="addNote('percentage', pc.logId)">
                  Add a note
                </button>
              }
            }
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    .task-history-feed__empty { color: var(--color-text-secondary); font-size: 13px; }
    .task-history-feed__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .task-history-feed__entry { font-size: 13px; border-bottom: 1px solid var(--color-border); padding-bottom: 6px; }
    .task-history-feed__actor { font-weight: 600; margin-right: 6px; }
    .task-history-feed__note { color: var(--color-text-secondary); margin: 2px 0 0; }
  `]
})
export class TaskHistoryFeedComponent {
  private readonly taskApi = inject(TaskApiService);

  entries = input.required<TaskHistoryEntryDto[]>();
  reasonSaved = output<void>();

  summaryFor(entry: TaskHistoryEntryDto): string {
    switch (entry.type) {
      case 'edit':
        return 'edited this task';
      case 'status_change':
        return 'moved the status';
      case 'clock_session': {
        const cs = entry.clockSession!;
        const duration = cs.durationMinutes !== null ? `${cs.durationMinutes} min` : 'in progress';
        const percent = cs.pushedPercent !== null ? `, pushed to ${cs.pushedPercent}%` : '';
        return `clocked in (${duration}${percent})`;
      }
      case 'percentage_change': {
        const pc = entry.percentageChange!;
        return `changed progress from ${pc.previousPercent}% to ${pc.newPercent}%`;
      }
    }
  }

  async addNote(kind: 'session' | 'percentage', id: string): Promise<void> {
    const reason = window.prompt('Add a note:')?.trim();
    if (!reason) return;
    if (kind === 'session') {
      await firstValueFrom(this.taskApi.addClockingSessionReason(id, reason));
    } else {
      await firstValueFrom(this.taskApi.addPercentageLogReason(id, reason));
    }
    this.reasonSaved.emit();
  }
}
