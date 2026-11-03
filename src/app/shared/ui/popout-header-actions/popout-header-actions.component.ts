import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { StopClickPropagationDirective } from '../../directives/stop-click-propagation.directive';

const TICK_MS = 30_000;

/** The two classes a refresh alternates between to restart the dashboard's load animation (dashboard-motion.css). */
const REPLAY = ['dash-replay-a', 'dash-replay-b'] as const;

/** Replays the load animation of the popup or dashboard widget around `el`; a no-op outside the dashboard. */
export function replayDashboardMotion(el: HTMLElement): void {
  const target = el.closest<HTMLElement>('app-modal') ?? el.closest<HTMLElement>('.dash-motion');
  if (!target?.closest('.dash-motion')) return;
  const next = target.classList.contains(REPLAY[0]) ? REPLAY[1] : REPLAY[0];
  target.classList.remove(...REPLAY);
  target.classList.add(next);
}

/** 'just now' / '5 min ago' / '2 h ago' / 'Sep 30, 14:05' for when data last came from the backend. */
export function formatRefreshedAgo(at: Date, now: Date): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return at.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/**
 * Header controls for a card and its popup: when its data last came from the backend (a page reload
 * counts - it is whenever the data was fetched), a refresh button, and expand (on the card, shown on
 * hover) or close (in the open popup). The label
 * re-renders every 30 seconds so "just now" ages on its own.
 */
@Component({
  selector: 'app-popout-header-actions',
  imports: [StopClickPropagationDirective],
  standalone: true,
  template: `
    <div
      class="flex items-center gap-1"
      [class.reveal]="revealOnHover()"
      data-testid="popout-header-actions"
      appStopClickPropagation
    >
      @if (refreshedAt(); as at) {
        <span class="mr-1 whitespace-nowrap text-xs text-slate-500" data-testid="refreshed-label" [title]="'Last loaded ' + at.toLocaleString()">
          Refreshed {{ ago() }}
        </span>
      }
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer disabled:cursor-default disabled:opacity-60"
        data-testid="popout-refresh"
        aria-label="Refresh"
        title="Refresh"
        [disabled]="refreshing()"
        (click)="refresh.emit()"
      >
        <svg class="h-4 w-4" [class.animate-spin]="refreshing()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"></path>
          <path d="M3 21v-5h5"></path>
          <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"></path>
          <path d="M21 3v5h-5"></path>
        </svg>
      </button>
      @if (expanded()) {
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          data-testid="popout-close"
          aria-label="Close"
          title="Close"
          (click)="closed.emit()"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      } @else if (canExpand()) {
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          data-testid="popout-expand"
          aria-label="Expand"
          title="Expand"
          (click)="expand.emit()"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        </button>
      }
    </div>
  `,
  // Hover reveal: the host takes no width, and the controls float over the right end of the card header
  // (on the card's own background, --popout-actions-bg) only while an ancestor `group` is hovered or a
  // control has focus - so hidden controls never squeeze or push the header's own content.
  styles: `
    :host { display: block; }
    :host(.overlay) { position: relative; width: 0; height: 2rem; flex: none; align-self: center; }
    .reveal {
      position: absolute; right: 0; top: 0; height: 2rem; padding-left: 0.75rem;
      background: var(--popout-actions-bg, #ffffff); border-radius: 0.5rem;
      opacity: 0; pointer-events: none; transition: opacity 150ms ease;
    }
    :host-context(.group:hover) .reveal, .reveal:focus-within { opacity: 1; pointer-events: auto; }
  `,
  host: { '[class.overlay]': 'revealOnHover()' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PopoutHeaderActionsComponent {
  /** When the shown data last came from the backend; null hides the label. */
  readonly refreshedAt = input<Date | null>(null);
  readonly refreshing = input(false);
  /** True in an open popup (shows close); false on the card (shows expand, when canExpand). */
  readonly expanded = input(true);
  readonly canExpand = input(true);
  /** Hidden until the card (an ancestor with the `group` class) is hovered or a control is focused. */
  readonly revealOnHover = input(false);
  readonly refresh = output<void>();
  readonly closed = output<void>();
  readonly expand = output<void>();

  private readonly now = signal(new Date());
  readonly ago = computed(() => {
    const at = this.refreshedAt();
    return at ? formatRefreshedAgo(at, this.now()) : '';
  });

  constructor() {
    // A refresh that finished (refreshing true -> false) plays the card's load animation again with the new data.
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    let wasRefreshing = false;
    effect(() => {
      const refreshing = this.refreshing();
      if (wasRefreshing && !refreshing) replayDashboardMotion(host);
      wasRefreshing = refreshing;
    });

    const timer = setInterval(() => this.now.set(new Date()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}

/** The later of several "loaded at" times (e.g. a card and its pop-out list); null when none. */
export function latestDate(...dates: readonly (Date | null | undefined)[]): Date | null {
  return dates.reduce<Date | null>((latest, d) => (d && (!latest || d > latest) ? d : latest), null);
}
