import { Component, inject, input, output } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';
import { injectNow } from '../../../../core/clock/clock.service';

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
            <span class="task-history-feed__icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 5h12M6 12h8M6 19h5" /><circle cx="4" cy="5" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="19" r="1" /></svg></span>
            <div class="task-history-feed__content">
              <div class="task-history-feed__summary-row"><span class="task-history-feed__actor">{{ entry.employeeName }}</span><time class="task-history-feed__time">{{ formatEntryTime(entry.occurredAt) }}</time></div>
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
            </div>
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    .task-history-feed__empty { margin: 0; border: 1px dashed var(--color-border); border-radius: 8px; padding: 16px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .task-history-feed__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .task-history-feed__entry { display: flex; align-items: flex-start; gap: 10px; border: none; border-bottom: 1px solid var(--color-border); border-radius: 0; padding: 10px 4px; background: transparent; font-size: 12.5px; }
    .task-history-feed__entry:last-child { border-bottom: none; }
    .task-history-feed__icon { display: inline-flex; width: 24px; height: 24px; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 6px; background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); margin-top: 1px; }
    .task-history-feed__icon svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .task-history-feed__content { min-width: 0; flex: 1; }
    .task-history-feed__summary-row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .task-history-feed__actor { min-width: 0; overflow: hidden; color: var(--color-text-primary); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .task-history-feed__time { flex: 0 0 auto; color: var(--color-text-secondary); font-size: 11px; }
    .task-history-feed__summary { display: block; margin-top: 2px; color: var(--color-text-secondary); line-height: 1.45; }
    .task-history-feed__note { margin: 5px 0 0; border-left: 2px solid var(--color-accent); padding-left: 7px; color: var(--color-text-secondary); line-height: 1.4; }
    .task-history-feed__entry button { margin-top: 5px; border: 0; padding: 0; background: transparent; color: var(--color-accent); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
    .task-history-feed__entry button:hover { color: var(--color-accent-hover); text-decoration: underline; }
    .task-history-feed__entry button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
  `]
})
export class TaskHistoryFeedComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly now = injectNow('second');

  entries = input.required<TaskHistoryEntryDto[]>();
  reasonSaved = output<void>();

  private formatClockTime(at: string): string {
    return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  private formatElapsedSince(startedAt: string): string {
    const elapsedSeconds = Math.max(0, Math.floor((this.now() - new Date(startedAt).getTime()) / 1000));
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const pad = (value: number) => value.toString().padStart(2, '0');
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  }

  formatEntryTime(at: string): string {
    return new Date(at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  summaryFor(entry: TaskHistoryEntryDto): string {
    switch (entry.type) {
      case 'edit':
        return 'edited this task';
      case 'status_change':
        return 'moved the status';
      case 'clock_session': {
        const cs = entry.clockSession!;
        const duration = cs.durationMinutes !== null
          ? `${cs.durationMinutes} min`
          : `in progress, ${this.formatElapsedSince(cs.clockInAt)}`;
        const percent = cs.pushedPercent !== null ? `, pushed to ${cs.pushedPercent}%` : '';
        return `clocked in at ${this.formatClockTime(cs.clockInAt)} (${duration}${percent})`;
      }
      case 'percentage_change': {
        const pc = entry.percentageChange!;
        return `changed progress from ${pc.previousPercent}% to ${pc.newPercent}%`;
      }
      case 'comment': {
        const c = entry.comment!;
        return c.action === 'deleted' ? 'deleted a comment' : 'edited a comment';
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
