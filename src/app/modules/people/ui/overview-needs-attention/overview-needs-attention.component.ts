import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import {
  EmployeeSignal,
  EmployeeSignalCategory,
  EmployeeSignalSeverity
} from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
import { Delta } from '../../utils/employee-overview.utils';
import { signalFullListUrl } from '../../utils/signal-item-links';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';
import { SignalItemsListComponent } from '../signal-items-list/signal-items-list.component';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

@Component({
  selector: 'app-overview-needs-attention',
  standalone: true,
  imports: [KeyboardClickDirective, StopClickPropagationDirective, DeltaBadgeComponent, SignalItemsListComponent, PopoutPanelComponent, PopoutHeaderActionsComponent],
  template: `
    @if (signals().length > 0) {
      <app-popout-panel [open]="popped()" label="Needs Attention" (closed)="collapse()">
      <div
        role="button"
        tabindex="0"
        appKeyboardClick
        data-testid="needs-attention"
        class="group rounded-2xl border border-[#fef08a] bg-[#fefce8] p-5"
        [class.cursor-pointer]="!popped() && signals().length > collapsedLimit"
        (click)="openAll()"
      >
        <div class="mb-2 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700" aria-hidden="true">!</span>
            <h3 class="text-sm font-bold text-slate-900">Needs Attention</h3>
          </div>
          <div class="flex items-center gap-2">
            <app-popout-header-actions
              style="--popout-actions-bg: #fefce8"
              [refreshedAt]="refreshedAt()"
              [refreshing]="refreshing()"
              [expanded]="popped()"
              [canExpand]="signals().length > collapsedLimit"
              [revealOnHover]="!popped()"
              (refresh)="refresh.emit()"
              (expand)="openAll()"
              (closed)="collapse()"
            />
          </div>
        </div>

        <div class="divide-y divide-amber-200/70" id="needs-attention-list">
          @for (signal of displayedSignals(); track signal.key; let i = $index) {
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 py-3 text-left cursor-pointer"
              data-testid="attention-row"
              [attr.data-key]="signal.key"
              [attr.aria-expanded]="drilldown.openKey() === signal.key"
              (click)="onRowClick($event, signal.key)"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  [class]="dotClass[signal.severity]"
                  aria-hidden="true"
                >{{ icon[signal.category] }}</span>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-900">{{ signal.label }}</p>
                  <p class="mt-0.5 text-[11px] text-slate-500">{{ signal.detail }}</p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <app-delta-badge [delta]="deltas()[i] ?? null" [against]="against()" />
                <span
                  class="rounded px-2 py-0.5 text-[11px] font-semibold"
                  [class]="chipClass[signal.severity]"
                >{{ chipText[signal.severity] }}</span>
                <span class="text-slate-400" aria-hidden="true">{{ drilldown.openKey() === signal.key ? '▾' : '▸' }}</span>
              </div>
            </button>
            @if (drilldown.openKey() === signal.key) {
              <app-signal-items-list
                appStopClickPropagation
                [response]="drilldown.openResponse()"
                [loading]="drilldown.loadingKey() === signal.key"
                [error]="drilldown.errorKey() === signal.key"
                [fullListUrl]="fullListUrl(signal.key)"
                (itemSelected)="drilldown.select($event)"
                (retry)="drilldown.retry()"
              />
            }
          }
        </div>

        @if (signals().length > collapsedLimit) {
          <div class="flex justify-end border-t border-amber-200/70 pt-3">
            <button
              type="button"
              class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
              data-testid="attention-toggle"
              aria-controls="needs-attention-list"
              [attr.aria-expanded]="popped()"
              (click)="onToggleClick($event)"
            >
              {{ popped() ? 'Show less' : 'View all' }}
            </button>
          </div>
        }
      </div>
      </app-popout-panel>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewNeedsAttentionComponent {
  protected readonly drilldown = inject(SignalDrilldownStore);
  private readonly period = inject(EmployeePeriodStore);

  readonly collapsedLimit = 3;
  readonly signals = input.required<readonly EmployeeSignal[]>();
  readonly deltas = input<readonly (Delta | null)[]>([]);
  readonly against = input<string | null>(null);
  /** When the signals last came from the backend (owned by the Overview, which loads them). */
  readonly refreshedAt = input<Date | null>(null);
  readonly refreshing = input(false);
  /** The popup's refresh button; the Overview refetches the signals and any open row. */
  readonly refresh = output<void>();
  readonly showAll = signal(false);
  /**
   * Anything beyond the compact card - the full list or an opened row's items - only ever shows
   * in the popup, so the card never grows inside the grid (which would stretch the chart beside it).
   */
  readonly popped = computed(() => this.showAll() || this.drilldown.openKey() !== null);
  readonly displayedSignals = computed(() =>
    this.popped() ? this.signals() : this.signals().slice(0, this.collapsedLimit)
  );

  /** A click anywhere on the card opens the full list - only when there is more to show. */
  openAll(): void {
    if (!this.popped() && this.signals().length > this.collapsedLimit) this.showAll.set(true);
  }

  /** Closing the popup also folds any opened row, returning the card to its compact form. */
  collapse(): void {
    this.showAll.set(false);
    this.drilldown.close();
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.popped()) this.collapse();
    else this.showAll.set(true);
  }

  onRowClick(event: Event, key: string): void {
    event.stopPropagation();
    this.drilldown.toggle(key);
  }

  fullListUrl(key: string): string | null {
    const employeeId = this.drilldown.employeeId();
    return employeeId ? signalFullListUrl(key, employeeId, this.period.from(), this.period.to()) : null;
  }

  readonly dotClass: Record<EmployeeSignalSeverity, string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  };

  readonly chipClass: Record<EmployeeSignalSeverity, string> = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700'
  };

  readonly chipText: Record<EmployeeSignalSeverity, string> = {
    critical: 'Urgent',
    warning: 'Warning',
    info: 'Review'
  };

  readonly icon: Record<EmployeeSignalCategory, string> = {
    attendance: '⏱',
    work: '!',
    approvals: '✓',
    monitoring: '◉'
  };
}
