import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
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
  template: `
    <div class="relative h-full w-full" [class.select-none]="editing()" data-testid="widget-frame">
      <div
        class="h-full w-full overflow-hidden rounded-2xl [&>*]:block [&>*]:h-full"
        [class.ring-1]="editing()"
        [class.ring-slate-300]="editing()"
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
        <div
          class="absolute left-2 top-2 z-20 flex cursor-grab touch-none items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-600 shadow-sm active:cursor-grabbing"
          data-drag-handle
          [attr.aria-label]="'Move ' + widget().title"
        >
          <span aria-hidden="true">&#8942;&#8942;</span>
          <span class="max-w-[10rem] truncate">{{ widget().title }}</span>
        </div>
        <button
          type="button"
          class="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500"
          [attr.aria-label]="'Remove ' + widget().title"
          (click)="remove.emit()"
        >
          <span aria-hidden="true">&#10005;</span>
        </button>
        <div
          class="absolute bottom-1 right-1 z-20 h-5 w-5 cursor-nwse-resize touch-none rounded-br-xl border-b-2 border-r-2 border-slate-400"
          data-resize-handle
          [attr.aria-label]="'Resize ' + widget().title"
        ></div>
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

  constructor() {
    effect(() => {
      const w = this.widget();
      this.dataStore.bind({ instanceId: w.instanceId, state: w.dataState, data: w.data });
    });
  }
}
