import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';

const OPEN_MS = 260;
const CLOSE_MS = 200;
const EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

/**
 * Wraps a card so it can "pop out" in place: when `open` turns true the card lifts off the page
 * at exactly the position and width it already has, and smoothly grows to its full content
 * height as a floating panel (shadow + light dim over the whole app, sticky headers included).
 * A same-height placeholder stays behind, so nothing around it moves. The dim is visual only
 * (pointer-events: none) so the page keeps scrolling underneath; a press anywhere outside the
 * panel, Esc, or the parent setting `open` false shrinks it back into the layout.
 *
 * The wrapped content decides what it shows when open (e.g. all rows instead of the first three).
 */
@Component({
  selector: 'app-popout-panel',
  standalone: true,
  template: `
    @if (popped()) {
      <div class="ui-fade-in popout-backdrop" data-testid="popout-backdrop" aria-hidden="true"></div>
    }
    <div
      #panel
      class="popout-panel"
      data-testid="popout-panel"
      [class.popout-panel--open]="popped()"
      [class.popout-panel--wide]="popped() && panelWidth() !== null"
      [style.width]="popped() ? panelWidth() : null"
      [style.max-height]="popped() ? expandedMaxHeight() : null"
      [attr.role]="popped() ? 'dialog' : null"
      [attr.tabindex]="popped() ? -1 : null"
      [attr.aria-label]="popped() ? label() : null"
      (keydown.escape)="closed.emit()"
    >
      <ng-content />
    </div>
  `,
  styles: `
    :host { position: relative; display: block; }
    .popout-panel:focus { outline: none; }
    /* In flow it fills the host, so a card stretched by its grid row keeps that height. */
    .popout-panel:not(.popout-panel--open) { height: 100%; }
    /* Scrolls when taller than the cap, but never shows a scrollbar. */
    .popout-panel, .popout-panel * { scrollbar-width: none; }
    .popout-panel::-webkit-scrollbar, .popout-panel *::-webkit-scrollbar { display: none; }
    /* Above the app's sticky page headers (z-index 50) so they dim too. */
    /* Grows to the right past its card; the width binding keeps it inside the viewport. */
    .popout-panel--wide { right: auto; }
    .popout-backdrop { position: fixed; inset: 0; z-index: 60; background: rgb(15 23 42 / 0.1); pointer-events: none; }
    .popout-panel--open {
      position: absolute; top: 0; left: 0; right: 0; z-index: 61;
      max-height: min(70vh, 40rem); overflow-y: auto; overflow-x: hidden;
      border-radius: 1rem;
      box-shadow: 0 24px 48px -12px rgb(15 23 42 / 0.28), 0 8px 16px -8px rgb(15 23 42 / 0.12);
    }
  `,
  host: {
    '[style.height.px]': 'placeholderHeight()',
    '(document:pointerdown)': 'onDocumentPointerDown($event)'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PopoutPanelComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  readonly open = input(false);
  /** Accessible name of the floating panel. */
  readonly label = input('Expanded panel');
  /**
   * Optional width when open (any CSS length, e.g. '60rem'). The panel keeps its left edge and grows
   * right, never narrower than the card and never past the viewport's right edge. Null keeps the card's width.
   */
  readonly expandedWidth = input<string | null>(null);
  /** Optional max height when open (CSS length); defaults to min(70vh, 40rem). */
  readonly expandedMaxHeight = input<string | null>(null);
  /** The resolved width while open, or null when the panel keeps the card's width. */
  readonly panelWidth = signal<string | null>(null);
  readonly closed = output<void>();

  /** True while the panel floats (stays true through the closing animation). */
  readonly popped = signal(false);
  /** Keeps the card's in-flow height while it floats, so the layout does not jump. */
  readonly placeholderHeight = signal<number | null>(null);
  private running: Animation | null = null;
  /**
   * The card's last in-flow height. The wrapped content usually grows in the same change-detection
   * pass that opens the panel (e.g. extra rows render), so measuring at open time would reserve the
   * already-expanded height and stretch the row. A ResizeObserver keeps the resting height instead.
   */
  private restingHeight: number | null = null;

  constructor() {
    afterNextRender(() => {
      const host = this.host.nativeElement;
      this.restingHeight = host.offsetHeight;
      if (typeof ResizeObserver !== 'function') return;
      const observer = new ResizeObserver(() => {
        if (!this.popped()) this.restingHeight = host.offsetHeight;
      });
      observer.observe(host);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    // Component effects run before the template updates, so the DOM still shows the old state here.
    effect(() => {
      const open = this.open();
      untracked(() => (open ? this.popOut() : this.popIn()));
    });
  }

  /** Any press outside the floating panel closes it; the dim never blocks scrolling or clicks. */
  onDocumentPointerDown(event: Event): void {
    if (!this.popped() || !this.open()) return;
    const target = event.target as Node | null;
    if (target && this.panel().nativeElement.contains(target)) return;
    // A modal opened from inside the panel (e.g. an item's detail) sits on top; presses there don't count.
    if (target instanceof Element && target.closest('[aria-modal="true"]')) return;
    this.closed.emit();
  }

  private popOut(): void {
    if (this.popped()) {
      // Reopened mid-close: drop the shrink and stay floating at full height.
      this.running?.cancel();
      this.running = null;
      return;
    }
    const host = this.host.nativeElement;
    const from = this.restingHeight ?? host.offsetHeight;
    const fromWidth = host.offsetWidth;
    const wide = this.expandedWidth();
    if (wide) {
      const left = host.getBoundingClientRect().left;
      this.panelWidth.set(`max(${fromWidth}px, min(${wide}, calc(100vw - ${Math.round(left)}px - 1.5rem)))`);
    }
    this.placeholderHeight.set(from);
    this.popped.set(true);
    afterNextRender(() => {
      const el = this.panel().nativeElement;
      const to = el.offsetHeight;
      const toWidth = el.offsetWidth;
      el.focus?.();
      this.running = this.animate(el, [
        { height: `${from}px`, ...(wide ? { width: `${fromWidth}px` } : {}), boxShadow: '0 0 0 0 rgb(15 23 42 / 0)', overflow: 'hidden' },
        { height: `${to}px`, ...(wide ? { width: `${toWidth}px` } : {}), overflow: 'hidden' }
      ], OPEN_MS);
    }, { injector: this.injector });
  }

  private popIn(): void {
    if (!this.popped()) return;
    this.running?.cancel();
    const el = this.panel().nativeElement;
    const from = el.offsetHeight;
    const to = this.placeholderHeight() ?? from;
    const wide = this.panelWidth() !== null;
    const widths = wide ? [{ width: `${el.offsetWidth}px` }, { width: `${this.host.nativeElement.offsetWidth}px` }] : [{}, {}];
    const finish = () => {
      this.running = null;
      this.popped.set(false);
      this.placeholderHeight.set(null);
      this.panelWidth.set(null);
    };
    this.running = this.animate(el, [
      { height: `${from}px`, ...widths[0], overflow: 'hidden' },
      { height: `${to}px`, ...widths[1], boxShadow: '0 0 0 0 rgb(15 23 42 / 0)', overflow: 'hidden' }
    ], CLOSE_MS, finish);
  }

  /** Web Animations when available and motion is allowed; otherwise the end state applies at once. */
  private animate(el: HTMLElement, frames: Keyframe[], duration: number, done?: () => void): Animation | null {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof el.animate !== 'function') {
      done?.();
      return null;
    }
    const animation = el.animate(frames, { duration, easing: EASING });
    if (done) animation.onfinish = done;
    return animation;
  }
}
