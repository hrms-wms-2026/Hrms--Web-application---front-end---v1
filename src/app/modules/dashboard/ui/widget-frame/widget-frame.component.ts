import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Type,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { BootstrapWidget } from '../../models/dashboard-layout.model';
import { WIDGET_DATA, WidgetDataStore } from '../../widgets/widget-data';
import { WIDGET_REGISTRY, WidgetRegistryEntry } from '../../widgets/widget-registry';
import { UnsupportedWidgetComponent } from '../unsupported-widget/unsupported-widget.component';

/**
 * Hosts one dashboard widget. Provides the per-widget WidgetDataContext to the card it renders.
 * View mode: no chrome, the card fills the frame. Edit mode: an overlay that is the drag handle and blocks
 * clicks/focus into the card, plus floating remove and resize buttons; none of it changes the card's size. The grid (F5) targets
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
    <!-- Edit chrome floats over the card and never takes space from it: the card keeps exactly its saved size,
         so the customize preview shows the same view (same size tier) as the saved dashboard. The chrome eases
         in and out (dash-frame rules in dashboard-motion.css). -->
    <div
      class="dash-frame relative flex h-full w-full flex-col"
      [class.dash-frame--editing]="editing()"
      [class.select-none]="editing()"
      data-testid="widget-frame"
    >
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
            @if (loadFailed()) {
              <app-unsupported-widget [title]="widget().title" />
            } @else if (component(); as c) {
              <ng-container *ngComponentOutlet="c; inputs: e.inputs" />
            }
          } @else {
            <app-unsupported-widget [title]="widget().title" />
          }
        </div>
        @if (editing()) {
          <!-- The whole card is the drag handle while editing; it also blocks clicks into the card. -->
          <div
            class="dash-frame__overlay absolute inset-0 z-10 cursor-grab touch-none rounded-xl active:cursor-grabbing"
            data-testid="widget-edit-overlay"
            data-drag-handle
            aria-hidden="true"
            animate.enter="dash-frame__fade-enter"
            animate.leave="dash-frame__fade-leave"
          >
            <span class="dash-frame__grip">
              <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="3.5" cy="5.5" r="1.25" /><circle cx="8" cy="5.5" r="1.25" /><circle cx="12.5" cy="5.5" r="1.25" />
                <circle cx="3.5" cy="10.5" r="1.25" /><circle cx="8" cy="10.5" r="1.25" /><circle cx="12.5" cy="10.5" r="1.25" />
              </svg>
            </span>
          </div>
          <button
            type="button"
            class="dash-frame__remove absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full"
            [attr.aria-label]="'Remove ' + widget().title"
            [attr.title]="'Remove ' + widget().title"
            animate.enter="dash-frame__pop-enter"
            animate.leave="dash-frame__fade-leave"
            (click)="remove.emit()"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        }
      </div>

      @if (editing()) {
        <div
          class="absolute bottom-0 right-0 z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-center justify-center rounded-br-xl rounded-tl-lg bg-[var(--color-surface)] text-[var(--color-text-secondary)] shadow-sm ring-1 ring-[var(--color-border)] hover:text-[var(--color-accent)]"
          data-resize-handle
          aria-hidden="true"
          animate.enter="dash-frame__pop-enter"
          animate.leave="dash-frame__fade-leave"
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

  /** The card component once its lazy chunk has loaded, tagged with the entry it belongs to. */
  private readonly loaded = signal<{ entry: WidgetRegistryEntry; component: Type<unknown> } | null>(null);
  private readonly failedEntry = signal<WidgetRegistryEntry | null>(null);

  /** Loaded component for the current entry; null while its chunk is still downloading. */
  protected readonly component = computed(() => {
    const l = this.loaded();
    return l && l.entry === this.entry() ? l.component : null;
  });

  protected readonly loadFailed = computed(() => {
    const e = this.entry();
    return e !== null && this.failedEntry() === e;
  });

  private boundId: string | null = null;
  private boundState: unknown = null;
  private boundData: unknown = null;

  constructor() {
    effect(() => {
      const e = this.entry();
      if (!e || this.loaded()?.entry === e) {
        return;
      }
      untracked(() => {
        e.load().then(
          (component) => {
            if (this.entry() === e) {
              this.loaded.set({ entry: e, component });
            }
          },
          () => {
            // Chunk download failed (offline, or a deploy replaced the hashed file): show the placeholder.
            if (this.entry() === e) {
              this.failedEntry.set(e);
            }
          }
        );
      });
    });

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
