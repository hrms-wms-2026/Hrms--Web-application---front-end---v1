import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, effect, inject, input, output } from '@angular/core';
import { BootstrapWidget } from '../../models/dashboard-layout.model';
import { WIDGET_DATA, WidgetDataStore } from '../../widgets/widget-data';
import { WIDGET_REGISTRY } from '../../widgets/widget-registry';
import { UnsupportedWidgetComponent } from '../unsupported-widget/unsupported-widget.component';

/**
 * Hosts one dashboard widget. Provides the per-widget WidgetDataContext to the card it renders.
 * View mode: no chrome, the card fills the frame. Edit mode: drag handle, remove button, resize handle
 * and an overlay that blocks clicks/focus into the card. The grid (F5) targets
 * `[data-drag-handle]` and `[data-resize-handle]`.
 */
@Component({
  selector: 'app-widget-frame',
  standalone: true,
  imports: [NgComponentOutlet, UnsupportedWidgetComponent],
  providers: [WidgetDataStore, { provide: WIDGET_DATA, useExisting: WidgetDataStore }],
  // The dashboard's load / refresh motion (.dash-motion is this frame's content box). Loaded here, unencapsulated,
  // instead of from the global styles.css, so it ships in the lazy dashboard chunk and not in the initial bundle.
  // Every rule is scoped under .dash-motion / .dash-replay-*, so being global changes nothing outside the dashboard.
  styleUrl: '../../dashboard-motion.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="relative flex h-full w-full flex-col"
      [class.select-none]="editing()"
      [class.rounded-2xl]="editing()"
      [class.bg-[var(--color-surface-secondary)]]="editing()"
      [class.p-1]="editing()"
      [class.ring-1]="editing()"
      [class.ring-[var(--color-border)]]="editing()"
      data-testid="widget-frame"
    >
      @if (editing()) {
        <!-- Edit chrome gets its own strip above the card, so it never covers the card's title or controls. -->
        <div class="flex h-8 shrink-0 items-center gap-1 pl-1" data-testid="widget-edit-bar">
          <div
            class="flex h-7 min-w-0 flex-1 cursor-grab touch-none items-center gap-1.5 rounded-lg px-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] active:cursor-grabbing"
            data-drag-handle
            aria-hidden="true"
          >
            <svg class="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5.5" cy="3.5" r="1.25" /><circle cx="10.5" cy="3.5" r="1.25" />
              <circle cx="5.5" cy="8" r="1.25" /><circle cx="10.5" cy="8" r="1.25" />
              <circle cx="5.5" cy="12.5" r="1.25" /><circle cx="10.5" cy="12.5" r="1.25" />
            </svg>
            <span class="truncate">{{ widget().title }}</span>
          </div>
          <button
            type="button"
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-danger-subtle)] hover:text-[var(--color-danger)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
            [attr.aria-label]="'Remove ' + widget().title"
            (click)="remove.emit()"
          >
            <span aria-hidden="true">&#10005;</span>
          </button>
        </div>
      }

      <div class="relative min-h-0 w-full flex-1">
        <div
          class="dash-motion h-full w-full [&>*]:block [&>*]:h-full"
          data-testid="widget-content"
          [class.overflow-auto]="!overflowVisible() && !editing()"
          [class.overflow-hidden]="editing()"
          [class.overflow-visible]="overflowVisible() && !editing()"
          [attr.inert]="editing() ? '' : null"
        >
          @if (entry(); as e) {
            <ng-container *ngComponentOutlet="e.component; inputs: e.inputs" />
          } @else {
            <app-unsupported-widget [title]="widget().title" />
          }
        </div>
        @if (editing()) {
          <div class="absolute inset-0 z-10 rounded-2xl" data-testid="widget-edit-overlay"></div>
        }
      </div>

      @if (editing()) {
        <div
          class="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-center justify-center rounded-br-2xl rounded-tl-lg bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm ring-1 ring-[var(--color-border)] hover:text-[var(--color-accent)]"
          data-resize-handle
          aria-hidden="true"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
            <path d="M14 6v8H6M14 14 7 7" />
          </svg>
        </div>
      }
    </div>
  `,
  host: { class: 'block h-full w-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetFrameComponent {
  readonly widget = input.required<BootstrapWidget>();
  readonly editing = input(false);
  readonly remove = output<void>();

  private readonly dataStore = inject(WidgetDataStore);

  /** Registry entry to render, or null for the unsupported placeholder. */
  protected readonly entry = computed(() => {
    const w = this.widget();
    if (w.dataState.status === 'error' && w.dataState.error === 'UNSUPPORTED_WIDGET') {
      return null;
    }
    return WIDGET_REGISTRY[w.widgetKey] ?? null;
  });

  protected readonly overflowVisible = computed(() => this.entry()?.overflowVisible === true);

  private boundId: string | null = null;
  private boundState: unknown = null;
  private boundData: unknown = null;

  constructor() {
    effect(() => {
      const w = this.widget();
      // Layout-only changes (move/resize) replace the widget object; only re-seed when the seed itself changed.
      if (w.instanceId === this.boundId && w.dataState === this.boundState && w.data === this.boundData) {
        return;
      }
      this.boundId = w.instanceId;
      this.boundState = w.dataState;
      this.boundData = w.data;
      this.dataStore.bind({ instanceId: w.instanceId, state: w.dataState, data: w.data });
    });
  }
}
