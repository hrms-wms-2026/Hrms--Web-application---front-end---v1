import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type ViewModeIcon = 'list' | 'card' | 'table' | 'tree';

export interface ViewModeOption {
  value: string;
  /** Short name used in the title/aria-label, e.g. "List" -> "List view, switch to Card view". */
  label: string;
  icon: ViewModeIcon;
}

/**
 * The one page-header view switcher (from Work > Projects): a single square button showing the
 * current view's icon; each click moves to the next mode. The caller owns the value and any persistence.
 */
@Component({
  selector: 'app-view-mode-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="ui-square-btn"
      [attr.aria-label]="ariaLabel()"
      [title]="title()"
      [attr.data-testid]="testId()"
      (click)="cycle()"
    >
      @switch (current()?.icon) {
        @case ('list') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        }
        @case ('card') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        }
        @case ('table') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" />
          </svg>
        }
        @case ('tree') {
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="9" y="2" width="6" height="5" rx="1" /><rect x="2" y="17" width="6" height="5" rx="1" />
            <rect x="16" y="17" width="6" height="5" rx="1" /><path d="M12 7v5M5 17v-5h14v5" />
          </svg>
        }
      }
    </button>
  `,
  styles: [':host { display: inline-flex; }']
})
export class ViewModeToggleComponent {
  modes = input.required<readonly ViewModeOption[]>();
  value = input.required<string>();
  testId = input('view-mode-toggle');
  valueChange = output<string>();

  private readonly index = computed(() => Math.max(0, this.modes().findIndex((m) => m.value === this.value())));
  protected readonly current = computed<ViewModeOption | undefined>(() => this.modes()[this.index()]);
  private readonly next = computed<ViewModeOption | undefined>(() => this.modes()[(this.index() + 1) % this.modes().length]);

  protected readonly title = computed(() => `${this.current()?.label ?? ''} view (click to switch to ${this.next()?.label ?? ''})`);
  protected readonly ariaLabel = computed(() => `${this.current()?.label ?? ''} view, switch to ${this.next()?.label ?? ''} view`);

  cycle(): void {
    const next = this.next();
    if (next && next.value !== this.value()) {
      this.valueChange.emit(next.value);
    }
  }
}
