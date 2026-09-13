import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { WorkTask } from '../../models/task.model';
import { toWorkTask } from '../../utils/task.mapper';

@Component({
  selector: 'app-task-clock-widget',
  standalone: true,
    template: `
    <div class="task-clock-widget" [class.task-clock-widget--compact]="compact()">
    <div class="task-clock-widget__controls" [class.task-clock-widget__controls--active]="hasOpenSessionMine()">
      <span class="task-clock-widget__timer-label"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg><span>Tracked time</span></span>
      <span data-testid="clock-timer" class="task-clock-widget__timer">{{ totalTimeLabel() }}</span>
    </div>
    @if (hasOpenSessionMine()) {
        <button data-testid="push-button" type="button" class="task-clock-widget__button task-clock-widget__button--active" (click)="openPushPopup()">
        Push
      </button>
      @if (pushPopupOpen()) {
        <div class="task-clock-widget__overlay" aria-hidden="true" (click)="closePushPopup()"></div>
        <div class="task-clock-widget__popup" role="dialog" aria-modal="true" aria-label="Push task progress" (click)="$event.stopPropagation()">
          <p data-testid="push-current-percent">Current: {{ task().progressPercent }}%</p>
          <input
            data-testid="push-percent-input"
            type="number"
            min="0"
            max="100"
            [value]="pushPercent() ?? ''"
            (input)="onPercentInput($event)"
          />
          <input
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
      <div class="task-clock-widget__action-row">
        <button
          data-testid="clock-in-button"
          type="button"
          class="task-clock-widget__button task-clock-widget__button--clock-in"
          [disabled]="clockInDisabled()"
          [title]="clockInDisabledReason()"
          (click)="onClockIn()"
        >
          Clock In
        </button>
      </div>
    }
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .task-clock-widget { position: relative; min-width: 0; }
    .task-clock-widget--compact { display: flex; align-items: center; gap: 6px; width: max-content; max-width: 100%; }
    .task-clock-widget__controls { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid var(--color-border); border-radius: 9px; padding: 9px 10px; background: var(--color-surface-secondary); }
    .task-clock-widget__controls--active { border-color: color-mix(in srgb, var(--color-accent) 55%, var(--color-border)); background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface)); }
    .task-clock-widget__timer-label { display: inline-flex; align-items: center; gap: 6px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .task-clock-widget__timer-label svg { width: 15px; height: 15px; fill: none; stroke: var(--color-accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .task-clock-widget__action-row { display: flex; align-items: center; padding-top: 2px; }
    .task-clock-widget--compact .task-clock-widget__controls { flex: 1 1 auto; min-width: 0; gap: 4px; border-radius: 6px; padding: 4px 6px; }
    .task-clock-widget--compact .task-clock-widget__timer-label span { display: none; }
    .task-clock-widget--compact .task-clock-widget__timer-label svg { width: 13px; height: 13px; }
    .task-clock-widget--compact .task-clock-widget__timer { font-size: 11px; letter-spacing: .02em; }
    .task-clock-widget--compact .task-clock-widget__action-row { flex: 0 0 auto; padding-top: 0; }
    .task-clock-widget--compact .task-clock-widget__button { min-height: 28px; padding: 4px 8px; font-size: 11px; }
    .task-clock-widget--compact .task-clock-widget__button--clock-in { animation: none; box-shadow: none; }
    .task-clock-widget__button { min-height: 36px; border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 14px; font: inherit; font-size: 13px; font-weight: 600; background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 160ms ease; }
    .task-clock-widget__button:hover:not(:disabled) { border-color: var(--color-accent); background: var(--color-surface-secondary); }
    .task-clock-widget__button--clock-in { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast); box-shadow: 0 5px 12px color-mix(in srgb, var(--color-accent) 22%, transparent); animation: task-clock-attention 2.4s ease-in-out infinite; }
    .task-clock-widget__button--active { border-color: var(--color-accent); background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); }
    .task-clock-widget__button:disabled { opacity: 0.5; cursor: not-allowed; animation: none; }
    .task-clock-widget__button:focus-visible, .task-clock-widget__popup button:focus-visible, .task-clock-widget__popup input:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .task-clock-widget__overlay { position: fixed; z-index: 90; inset: 0; background: rgb(15 23 42 / .22); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); animation: task-clock-overlay-in 160ms ease-out; }
    .task-clock-widget__popup { position: fixed; z-index: 91; top: 50%; left: 50%; display: flex; flex-direction: column; gap: 9px; width: min(320px, calc(100vw - 32px)); margin: 0; padding: 16px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: 0 20px 50px rgb(15 23 42 / .24); transform: translate(-50%, -50%); animation: task-clock-popup-in 160ms ease-out; }
    .task-clock-widget__popup p { margin: 0; color: var(--color-text-primary); font-size: 13px; font-weight: 600; }
    .task-clock-widget__popup input { width: 100%; height: 34px; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; }
    .task-clock-widget__popup input::placeholder { color: var(--color-text-secondary); }
    .task-clock-widget__popup [role="alert"] { color: var(--color-danger-text); font-size: 12px; line-height: 1.35; }
    .task-clock-widget__popup > div { display: flex; justify-content: flex-end; gap: 8px; padding-top: 2px; }
    .task-clock-widget__popup button { min-height: 30px; padding: 5px 10px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .task-clock-widget__popup button:first-child { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast); }
    .task-clock-widget__popup button:hover:not(:disabled) { border-color: var(--color-accent); }
    .task-clock-widget__popup button:disabled { opacity: .55; cursor: not-allowed; }
    .task-clock-widget__timer { font-variant-numeric: tabular-nums; font-size: 15px; font-weight: 700; letter-spacing: .04em; color: var(--color-text-primary); }
    .task-clock-widget__controls--active .task-clock-widget__timer { color: var(--color-accent); animation: task-clock-timer-pulse 2s ease-in-out infinite; }
    @keyframes task-clock-attention { 0%, 100% { box-shadow: 0 5px 12px color-mix(in srgb, var(--color-accent) 18%, transparent); } 50% { box-shadow: 0 6px 18px color-mix(in srgb, var(--color-accent) 34%, transparent); } }
    @keyframes task-clock-timer-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .72; } }
    @keyframes task-clock-overlay-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes task-clock-popup-in { from { opacity: 0; transform: translate(-50%, calc(-50% + 8px)) scale(.98); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
    @media (prefers-reduced-motion: reduce) { .task-clock-widget__button--clock-in, .task-clock-widget__controls--active .task-clock-widget__timer, .task-clock-widget__overlay, .task-clock-widget__popup { animation: none; } }
  `]
})
export class TaskClockWidgetComponent {
  private readonly taskApi = inject(TaskApiService);
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
    await firstValueFrom(this.taskApi.clockIn(this.task().id));
    this.clockedIn.emit();
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
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.pushError.set(detail || 'Failed to push.');
    } finally {
      this.pushSubmitting.set(false);
    }
  }
}
