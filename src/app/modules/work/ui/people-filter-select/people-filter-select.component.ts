import { Component, computed, input, output, signal } from '@angular/core';

export interface PeopleFilterOption {
  employeeId: string;
  name: string;
}

@Component({
  selector: 'app-people-filter-select',
  standalone: true,
  template: `
    <div class="people-filter" data-testid="people-filter">
      <button
        type="button"
        class="people-filter__button"
        [class.people-filter__button--active]="selected().length > 0"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
        (click)="open.set(!open())"
        data-testid="people-filter-toggle"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M15 7a3 3 0 0 1 0 6M20 20c0-2.5-1.7-4.3-4-4.8" /></svg>
        <span>{{ selected().length ? 'People (' + selected().length + ')' : 'People' }}</span>
      </button>

      @if (open()) {
        <div class="people-filter__menu" role="listbox" aria-label="Filter by assignee">
          @if (selected().length) {
            <button type="button" class="people-filter__clear" (click)="clear()" data-testid="people-filter-clear">Clear</button>
          }
          @for (option of options(); track option.employeeId) {
            <label class="people-filter__row">
              <input
                type="checkbox"
                data-testid="people-filter-option"
                [value]="option.employeeId"
                [checked]="selectedSet().has(option.employeeId)"
                (change)="toggle(option.employeeId)"
              />
              <span class="people-filter__name">{{ option.name }}</span>
            </label>
          } @empty {
            <p class="people-filter__empty">No project members.</p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .people-filter { position: relative; display: inline-block; }
    .people-filter__button { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .people-filter__button--active { border-color: var(--color-accent); color: var(--color-accent); }
    .people-filter__button svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
    .people-filter__menu { position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; min-width: 200px; max-height: 260px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); padding: 6px; box-shadow: 0 8px 24px rgb(15 23 42 / .14); }
    .people-filter__clear { width: 100%; margin-bottom: 4px; padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--color-accent); font: inherit; font-size: 11px; font-weight: 600; text-align: left; cursor: pointer; }
    .people-filter__row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; font-size: 13px; cursor: pointer; }
    .people-filter__row:hover { background: var(--color-surface-secondary); }
    .people-filter__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .people-filter__empty { padding: 8px; color: var(--color-text-secondary); font-size: 12px; }
  `]
})
export class PeopleFilterSelectComponent {
  readonly options = input.required<readonly PeopleFilterOption[]>();
  readonly selected = input<readonly string[]>([]);
  readonly selectionChanged = output<string[]>();

  readonly open = signal(false);
  readonly selectedSet = computed(() => new Set(this.selected()));

  toggle(employeeId: string): void {
    const next = new Set(this.selected());
    next.has(employeeId) ? next.delete(employeeId) : next.add(employeeId);
    this.selectionChanged.emit([...next]);
  }

  clear(): void {
    this.selectionChanged.emit([]);
  }
}
