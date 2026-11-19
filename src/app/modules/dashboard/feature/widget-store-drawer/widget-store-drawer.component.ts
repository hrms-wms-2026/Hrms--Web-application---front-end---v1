import { ChangeDetectionStrategy, Component, Injector, effect, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import { AvailableWidget } from '../../models/dashboard-layout.model';

/**
 * Right-side panel listing the widgets that are not on the dashboard yet. Adding does not close it
 * (the added widget just leaves the list). Escape or the close button emits `closed`.
 */
@Component({
  selector: 'app-widget-store-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <aside
        class="fixed inset-y-0 right-0 z-[1100] flex w-full max-w-sm flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl outline-none"
        role="dialog"
        aria-label="Widget store"
        data-testid="widget-store-drawer"
        tabindex="-1"
        (keydown.escape)="$event.stopPropagation(); closed.emit()"
      >
        <header class="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div>
            <h2 class="text-base font-semibold text-[var(--color-text-primary)]">Widget store</h2>
            <p class="text-xs text-[var(--color-text-secondary)]">Add widgets to your dashboard.</p>
          </div>
          <button
            #closeButton
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            aria-label="Close widget store"
            data-testid="widget-store-close"
            (click)="closed.emit()"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto p-4">
          @if (items().length === 0) {
            <p class="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]" data-testid="widget-store-empty">
              All widgets are on your dashboard
            </p>
          } @else {
            <ul class="flex flex-col gap-3">
              @for (item of items(); track item.key) {
                <li class="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3" [attr.data-testid]="'widget-store-item-' + item.key">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-[var(--color-text-primary)]">{{ item.title }}</p>
                    <p class="mt-0.5 text-xs text-[var(--color-text-secondary)]">{{ item.description }}</p>
                    <p class="mt-1 text-[11px] text-[var(--color-text-muted)]">Default size {{ item.defaultW }} × {{ item.defaultH }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-on-solid)] hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1"
                    [attr.aria-label]="'Add ' + item.title"
                    [attr.data-testid]="'widget-store-add-' + item.key"
                    (click)="onAdd(item, $index)"
                  >
                    Add
                  </button>
                </li>
              }
            </ul>
          }
        </div>
        <p class="sr-only" role="status" aria-live="polite" data-testid="widget-store-live">{{ announcement() }}</p>
      </aside>
    }
  `
})
export class WidgetStoreDrawerComponent {
  readonly open = input(false);
  readonly items = input<AvailableWidget[]>([]);
  readonly added = output<string>();
  readonly closed = output<void>();

  protected readonly announcement = signal('');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected onAdd(item: AvailableWidget, index: number): void {
    const nextKey = this.items()[index + 1]?.key ?? null;
    this.announcement.set(`Added ${item.title}`);
    this.added.emit(item.key);
    // The added item leaves the list: hand focus to the next item's Add button, else the close button.
    afterNextRender(
      () => {
        const next = nextKey ? this.host.nativeElement.querySelector<HTMLElement>(`[data-testid="widget-store-add-${nextKey}"]`) : null;
        (next ?? this.closeButton()?.nativeElement)?.focus();
      },
      { injector: this.injector }
    );
  }

  constructor() {
    // Move focus into the panel when it opens (the shell puts it back on the opener when it closes).
    effect(() => {
      if (this.open()) {
        afterNextRender(() => this.closeButton()?.nativeElement.focus(), { injector: this.injector });
      }
    });
  }
}
