import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';
import { KeyboardClickDirective } from '../../../../shared/directives/keyboard-click.directive';

/** Entries on the compact card: the most recent ones, current position last. */
export const JOURNEY_PREVIEW_LIMIT = 3;

const REASON_LABELS: Record<NonNullable<PositionHistoryEntryResponse['changeReason']>, string> = {
  Promotion: 'Promotion',
  Transfer: 'Transfer',
  LateralMove: 'Lateral move'
};

/** 'Jan 10, 2023' from an ISO date ('2023-01-10'), read as a calendar date (no timezone shift). */
export function formatJourneyDate(value: string | null | undefined): string {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Career Journey card. The parent already holds the whole history, so the card shows the latest
 * three and pops out in place (like the Overview cards) to list every entry - no extra request.
 */
@Component({
  selector: 'app-employee-job-journey',
  standalone: true,
  imports: [KeyboardClickDirective, PopoutPanelComponent, PopoutHeaderActionsComponent],
  template: `
    <app-popout-panel class="block h-full" [open]="showAll()" label="Career Journey" (closed)="showAll.set(false)">
      <section role="button" tabindex="0" appKeyboardClick
        data-testid="career-journey-card"
        class="group flex h-full flex-col rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface)] p-4 shadow-xs"
        [class.cursor-pointer]="canExpand() && !showAll()"
        (click)="expand()"
      >
        <header class="mb-3 flex items-start justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)]" aria-hidden="true">
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 20h16M7 16v-5M11 16V7M15 16v-7M19 16V4"></path>
              </svg>
            </span>
            <div>
              <h2 class="text-sm font-bold text-[var(--color-text-primary)]">Career Journey</h2>
              <p class="text-[11px] text-[var(--color-text-secondary)]">Employment history and position changes</p>
            </div>
          </div>
          <app-popout-header-actions
            [refreshedAt]="refreshedAt()"
            [refreshing]="refreshing()"
            [expanded]="showAll()"
            [canExpand]="canExpand()"
            [revealOnHover]="!showAll()"
            (refresh)="refresh.emit()"
            (expand)="expand()"
            (closed)="showAll.set(false)"
          />
        </header>

        @if (sorted().length === 0) {
          <p class="text-xs text-[var(--color-text-secondary)]">No position history entries recorded yet.</p>
        } @else {
          <ol class="flex-1">
            @for (entry of displayed(); track $index; let last = $last) {
              <li data-testid="journey-entry" class="grid grid-cols-[6rem_1rem_1fr] gap-x-2.5">
                <div class="text-[11px] leading-4 text-[var(--color-text-secondary)]">
                  <p class="font-medium text-[var(--color-text-primary)]">{{ date(entry.effectiveFrom) }}</p>
                  <p>– {{ entry.effectiveTo ? date(entry.effectiveTo) : 'Present' }}</p>
                </div>
                <div class="relative flex justify-center">
                  <span
                    class="relative z-[1] mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-[var(--color-surface)]"
                    [class.bg-[var(--color-success)]]="!entry.effectiveTo"
                    [class.bg-[var(--color-accent)]]="!!entry.effectiveTo"
                  ></span>
                  @if (!last) {
                    <span class="absolute top-3.5 bottom-0 w-px bg-[var(--color-border)]" aria-hidden="true"></span>
                  }
                </div>
                <div class="min-w-0 pb-2.5" [class.border-b]="!last" [class.border-[var(--color-border)]]="!last" [class.mb-2.5]="!last">
                  <div class="flex items-start justify-between gap-2">
                    <p class="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">{{ entry.positionName }}</p>
                    @if (!entry.effectiveTo) {
                      <span class="shrink-0 rounded-full bg-[var(--color-success-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-success-text)]">Current</span>
                    }
                  </div>
                  <p class="text-[11px] text-[var(--color-text-secondary)]">{{ entry.departmentName || 'No department' }}</p>
                  <p class="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
                    @if (entry.changeReason) {
                      <span class="font-medium text-[var(--color-text-primary)]">{{ reasonLabel(entry.changeReason) }}</span> ·
                    } @else if (isFirst(entry)) {
                      Initial recorded position ·
                    }
                    Changed by {{ entry.initiatedByName }}
                    @if (entry.approvedByName) {
                      · Approved by {{ entry.approvedByName }}
                    }
                  </p>
                </div>
              </li>
            }
          </ol>

          @if (canExpand()) {
            <div class="mt-auto flex justify-end border-t border-[var(--color-border)] pt-2">
              <button
                type="button"
                class="text-xs font-semibold text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:underline cursor-pointer"
                data-testid="journey-toggle"
                [attr.aria-expanded]="showAll()"
                (click)="onToggleClick($event)"
              >
                {{ showAll() ? 'Show less' : 'View all (' + sorted().length + ')' }}
              </button>
            </div>
          }
        }
      </section>
    </app-popout-panel>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobJourneyComponent {
  readonly entries = input.required<readonly PositionHistoryEntryResponse[]>();
  /** When the parent last loaded the history; drives the header's "Refreshed" label. */
  readonly refreshedAt = input<Date | null>(null);
  readonly refreshing = input(false);
  readonly refresh = output<void>();

  readonly showAll = signal(false);

  /** Oldest first, whatever order the API used. */
  readonly sorted = computed(() =>
    [...this.entries()].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  );
  readonly canExpand = computed(() => this.sorted().length > JOURNEY_PREVIEW_LIMIT);
  readonly displayed = computed(() => {
    const all = this.sorted();
    return this.showAll() ? all : all.slice(-JOURNEY_PREVIEW_LIMIT);
  });

  constructor() {
    // Nothing left to pop out to (e.g. a different employee with a short history).
    effect(() => {
      if (!this.canExpand()) untracked(() => this.showAll.set(false));
    });
  }

  expand(): void {
    if (this.showAll() || !this.canExpand()) return;
    this.showAll.set(true);
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.showAll.set(false);
    else this.expand();
  }

  isFirst(entry: PositionHistoryEntryResponse): boolean {
    return this.sorted()[0] === entry;
  }

  date(value: string): string {
    return formatJourneyDate(value);
  }

  reasonLabel(reason: NonNullable<PositionHistoryEntryResponse['changeReason']>): string {
    return REASON_LABELS[reason] ?? reason;
  }
}
