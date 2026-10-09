import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardLayoutService } from '../../state/dashboard-layout.service';
import { DASHBOARD_CARD_META, DashboardCardKey } from '../../utils/dashboard-layout.util';

/** The Customize list: tick a card to show it, untick to remove it, ↑ / ↓ to move it (for keyboard
 * and phones, where dragging is awkward). Edits the layout service's draft. */
@Component({
  selector: 'app-dashboard-customize-panel',
  standalone: true,
  template: `
    <aside class="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs" aria-labelledby="customize-panel-title" data-testid="customize-panel">
      <h2 id="customize-panel-title" class="text-sm font-bold text-slate-800">Cards</h2>
      <p class="mb-3 text-xs text-slate-500">Tick to show, untick to remove. Drag cards on the left to move them.</p>

      @for (group of layout.customizeGroups(); track group.id) {
        <div class="mb-3 last:mb-0" [attr.data-testid]="'customize-group-' + group.id">
          <p class="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{{ group.label }}</p>
          <ul class="flex flex-col gap-0.5">
            @for (key of group.keys; track key) {
              <li class="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    class="h-4 w-4 cursor-pointer accent-blue-600"
                    [checked]="layout.isShown(key)"
                    [attr.data-testid]="'customize-toggle-' + key"
                    (change)="layout.toggle(key)"
                  />
                  <span class="truncate" [class.text-slate-400]="!layout.isShown(key)">{{ label(key) }}</span>
                </label>
                @if (layout.isShown(key)) {
                  <button
                    type="button"
                    class="customize-step"
                    [attr.aria-label]="'Move ' + label(key) + ' up'"
                    title="Move up"
                    [attr.data-testid]="'customize-up-' + key"
                    (click)="layout.step(key, -1)"
                  >↑</button>
                  <button
                    type="button"
                    class="customize-step"
                    [attr.aria-label]="'Move ' + label(key) + ' down'"
                    title="Move down"
                    [attr.data-testid]="'customize-down-' + key"
                    (click)="layout.step(key, 1)"
                  >↓</button>
                }
              </li>
            }
          </ul>
        </div>
      }
    </aside>
  `,
  styles: `
    .customize-step {
      display: inline-flex; width: 24px; height: 24px; align-items: center; justify-content: center;
      border-radius: 6px; border: 1px solid #e2e8f0; background: #ffffff; color: #475569;
      font-size: 12px; cursor: pointer; transition: background-color 0.15s ease;
    }
    .customize-step:hover { background: #f1f5f9; }
    .customize-step:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardCustomizePanelComponent {
  protected readonly layout = inject(DashboardLayoutService);

  label(key: DashboardCardKey): string {
    return DASHBOARD_CARD_META[key].label;
  }
}
