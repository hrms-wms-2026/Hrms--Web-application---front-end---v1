import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';

/** "Undo — available until 10:42" with a live countdown, shown while the 30-minute revert window is open;
 *  hides itself at expiry. `until` is the revert action's Meta "revertableUntil". */
@Component({
  selector: 'app-inbox-revert-banner',
  standalone: true,
  template: `
    @if (remainingMs() > 0) {
      <div class="irb" data-testid="inbox-revert-banner" role="status">
        <span class="irb__text">Undo — available until {{ untilLabel() }}</span>
        <span class="irb__count" aria-label="Time left">{{ countdown() }}</span>
        <button type="button" class="irb__btn" data-testid="inbox-revert-undo" [disabled]="busy()" (click)="undo.emit()">Undo</button>
      </div>
    }
  `,
  styles: [`
    .irb { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid color-mix(in srgb, var(--color-accent) 35%, var(--color-border)); border-radius: 10px; background: color-mix(in srgb, var(--color-accent) 8%, transparent); font-size: 12px; }
    .irb__text { flex: 1; min-width: 0; color: var(--color-text-primary); font-weight: 600; }
    .irb__count { color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
    .irb__btn { padding: 4px 10px; border: 1px solid var(--color-accent); border-radius: 8px; background: var(--color-surface); color: var(--color-accent); font: inherit; font-weight: 600; cursor: pointer; }
    .irb__btn:disabled { opacity: .55; cursor: default; }
  `]
})
export class InboxRevertBannerComponent {
  until = input.required<string>();
  busy = input(false);
  undo = output<void>();

  private readonly now = signal(Date.now());
  protected readonly remainingMs = computed(() => {
    const end = new Date(this.until()).getTime();
    return isNaN(end) ? 0 : end - this.now();
  });
  protected readonly untilLabel = computed(() =>
    new Date(this.until()).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
  protected readonly countdown = computed(() => {
    const total = Math.max(0, Math.ceil(this.remainingMs() / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
