import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { WorkTask } from '../../models/task.model';
import { toWorkTask } from '../../utils/task.mapper';
import { safeServerDetail } from '../../../../core/services/error-handler.service';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

@Component({
  selector: 'app-task-clock-widget',
  imports: [StopClickPropagationDirective],
  standalone: true,
    template: `
    <div class="task-clock-widget" [class.task-clock-widget--compact]="compact()">
      @if (hasOpenSessionMine()) {
        <button
          data-testid="push-button"
          type="button"
          class="task-clock-widget__button task-clock-widget__button--active"
          title="Pause task progress"
          aria-label="Pause tracking time"
          (click)="openPushPopup()"
        >
          <svg class="task-clock-widget__symbol" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" />
            <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" />
          </svg>
          <span data-testid="clock-timer" class="task-clock-widget__timer">{{ totalTimeLabel() }}</span>
          <span class="task-clock-widget__sr-only">Pause</span>
        </button>

        @if (pushPopupOpen()) {
          <div class="task-clock-widget__overlay" aria-hidden="true" (click)="closePushPopup()"></div>
          <div class="task-clock-widget__popup" role="dialog" aria-modal="true" aria-label="Pause task progress" appStopClickPropagation>
            <p data-testid="push-current-percent">Current: {{ task().progressPercent }}%</p>
            <input class="ui-input ui-input--sm"
              data-testid="push-percent-input"
              type="number"
              min="0"
              max="100"
              [value]="pushPercent() ?? ''"
              (input)="onPercentInput($event)"
            />
            <input class="ui-input ui-input--sm"
              data-testid="push-reason-input"
              type="text"
              placeholder="Optional note"
              [value]="pushReason()"
              (input)="onReasonInput($event)"
            />
            @if (pushError()) {
              <p data-testid="push-error" role="alert">{{ pushError() }}</p>
            }
            <div>
              <button data-testid="push-submit-button" type="button" [disabled]="pushSubmitting()" (click)="submitPush()">
                Submit
              </button>
              <button type="button" [disabled]="pushSubmitting()" (click)="closePushPopup()">Cancel</button>
            </div>
          </div>
        }
      } @else {
        <button
          data-testid="clock-in-button"
          type="button"
          class="task-clock-widget__button task-clock-widget__button--clock-in"
          [disabled]="clockInDisabled()"
          [title]="clockInDisabledReason() || 'Resume task'"
          aria-label="Resume tracking time"
          (click)="onClockIn()"
        >
          <svg class="task-clock-widget__symbol" viewBox="0 0 24 24" aria-hidden="true">
            <polygon points="7 4 19 12 7 20 7 4" fill="currentColor" />
          </svg>
          <span data-testid="clock-timer" class="task-clock-widget__timer">{{ totalTimeLabel() }}</span>
          <span class="task-clock-widget__sr-only">Clock In</span>
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; min-width: 0; vertical-align: middle; }
    .task-clock-widget { position: relative; display: inline-flex; align-items: center; min-width: 0; }
    .task-clock-widget--compact { width: max-content; max-width: 100%; }

    .task-clock-widget__button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      height: 28px;
      min-height: 28px;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      padding: 0 8px;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      background: var(--color-surface);
      color: var(--color-text-primary);
      cursor: pointer;
      transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 160ms ease;
      white-space: nowrap;
    }
    .task-clock-widget__button:hover:not(:disabled) {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface));
      color: var(--color-accent);
    }
    .task-clock-widget__button--clock-in {
      border-color: var(--color-border);
      background: var(--color-surface-secondary);
      color: var(--color-text-primary);
    }
    .task-clock-widget__button--clock-in .task-clock-widget__symbol {
      color: var(--color-accent);
    }
    .task-clock-widget__button--active {
      border-color: var(--color-accent);
      background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface));
      color: var(--color-accent);
    }
    .task-clock-widget__button--active .task-clock-widget__timer {
      color: var(--color-accent);
      animation: task-clock-timer-pulse 2s ease-in-out infinite;
    }
    .task-clock-widget__button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      animation: none;
    }
    .task-clock-widget__button:focus-visible, .task-clock-widget__popup button:focus-visible {
      outline: 2px solid var(--color-focus-ring);
      outline-offset: 2px;
    }

    .task-clock-widget--compact .task-clock-widget__button {
      height: 24px;
      min-height: 24px;
      padding: 0 7px;
      gap: 4px;
      font-size: 11px;
    }
    .task-clock-widget--compact .task-clock-widget__symbol {
      width: 9px;
      height: 9px;
    }

    .task-clock-widget__symbol {
      width: 11px;
      height: 11px;
      flex-shrink: 0;
    }
    .task-clock-widget__timer {
      font-variant-numeric: tabular-nums;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: .02em;
    }
    .task-clock-widget__sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }

    .task-clock-widget__overlay { position: fixed; z-index: 90; inset: 0; background: rgb(15 23 42 / .22); animation: task-clock-overlay-in 160ms ease-out; }
    .task-clock-widget__popup { position: fixed; z-index: 91; top: 50%; left: 50%; display: flex; flex-direction: column; gap: 9px; width: min(320px, calc(100vw - 32px)); margin: 0; padding: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: var(--shadow-modal); transform: translate(-50%, -50%); animation: task-clock-popup-in 160ms ease-out; }
    .task-clock-widget__popup p { margin: 0; color: var(--color-text-primary); font-size: 13px; font-weight: 600; }

    .task-clock-widget__popup [role="alert"] { color: var(--color-danger-text); font-size: 12px; line-height: 1.35; }
    .task-clock-widget__popup > div { display: flex; justify-content: flex-end; gap: 8px; padding-top: 2px; }
    .task-clock-widget__popup button { min-height: 30px; padding: 5px 10px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .task-clock-widget__popup button:first-child { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast); }
    .task-clock-widget__popup button:hover:not(:disabled) { border-color: var(--color-accent); }
    .task-clock-widget__popup button:disabled { opacity: .55; cursor: not-allowed; }
    @keyframes task-clock-timer-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .72; } }
    @keyframes task-clock-overlay-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes task-clock-popup-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 8px)) scale(.98); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
    @media (prefers-reduced-motion: reduce) { .task-clock-widget__button--active .task-clock-widget__timer, .task-clock-widget__overlay, .task-clock-widget__popup { animation: none; } }
  `]
})
export class TaskClockWidgetComponent {
  private readonly taskApi = inject(TaskApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  task = input.required<WorkTask>();
  hasOpenSessionMine = input(false);
  hasOpenSessionOtherEmployee = input(false);
  compact = input(false);
  isAssignee = input.required<boolean>();
  clockedIn = output<void>();
  pushed = output<WorkTask>();

  pushPopupOpen = signal(false);
  pushPercent = signal<number | null>(null);
  pushReason = signal('');
  pushError = signal<string | null>(null);
  pushSubmitting = signal(false);
  private readonly now = signal(Date.now());

  constructor() {
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      if (this.tickTimer !== null) clearInterval(this.tickTimer);
    });
  }

  // Total time spent on this task: the persisted total from all past closed sessions, plus the
  // live-running elapsed time of the current session while clocked in. Always visible - frozen
  // at the accumulated total when not clocked in, resumes counting up (never resets to 0) the
  // moment a new Clock In starts, and freezes again at the new total the moment Push closes it.
  totalTimeLabel = computed(() => {
    const baseSeconds = this.task().totalLoggedMinutes * 60;
    const clockInAt = this.task().openClockSessionClockInAt;
    const liveSeconds = this.hasOpenSessionMine() && clockInAt
      ? Math.max(0, Math.floor((this.now() - clockInAt.getTime()) / 1000))
      : 0;
    const totalSeconds = baseSeconds + liveSeconds;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (value: number) => value.toString().padStart(2, '0');
    return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  });

  isLockedAt100 = computed(() => this.task().progressPercent === 100);

  clockInDisabled = computed(() =>
    this.isLockedAt100() || this.hasOpenSessionOtherEmployee() || !this.isAssignee()
  );

  clockInDisabledReason = computed(() => {
    if (this.isLockedAt100()) return 'This task is complete - reduce its percentage before clocking in again.';
    if (this.hasOpenSessionOtherEmployee()) return 'Another teammate has this task in progress.';
    if (!this.isAssignee()) return 'Only an assignee of this task can clock in.';
    return '';
  });

  async onClockIn(): Promise<void> {
    try {
      const response = await firstValueFrom(this.taskApi.clockIn(this.task().id));
      if (response?.movedToStatus) {
        this.notificationService.success(`Moved to "${response.movedToStatus.name}" to start tracking time.`);
      }
      this.clockedIn.emit();
    } catch (err: unknown) {
      const detail = safeServerDetail(err);
      this.notificationService.error(detail || 'Failed to clock in.');
    }
  }

  openPushPopup(): void {
    this.pushPopupOpen.set(true);
    this.pushPercent.set(null);
    this.pushReason.set('');
    this.pushError.set(null);
  }

  closePushPopup(): void {
    this.pushPopupOpen.set(false);
  }

  onPercentInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.pushPercent.set(value === '' ? null : Number(value));
  }

  onReasonInput(event: Event): void {
    this.pushReason.set((event.target as HTMLInputElement).value);
  }

  async submitPush(): Promise<void> {
    const percent = this.pushPercent();
    const current = this.task().progressPercent;
    if (percent === null || percent <= current) {
      this.pushError.set(`Percent must be greater than the current progress (${current}%).`);
      return;
    }

    this.pushSubmitting.set(true);
    this.pushError.set(null);
    try {
      const dto = await firstValueFrom(this.taskApi.push(this.task().id, {
        percent,
        reason: this.pushReason() || undefined
      }));
      this.pushed.emit(toWorkTask(dto));
      this.pushPopupOpen.set(false);
    } catch (err: unknown) {
      const detail = safeServerDetail(err);
      this.pushError.set(detail || 'Failed to push.');
    } finally {
      this.pushSubmitting.set(false);
    }
  }
}
