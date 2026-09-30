import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { DEFAULT_EMPLOYEE_COLUMNS, EMPLOYEE_COLUMNS, EmployeeColumnKey } from '../../models/employee-columns';

@Component({
  selector: 'app-employee-column-picker',
  standalone: true,
  imports: [PopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-popover [open]="open()" align="right" ariaLabel="Columns" (closed)="open.set(false)">
      <button popover-trigger type="button" class="ecp__trigger" data-testid="columns-trigger" [attr.aria-expanded]="open()" (click)="toggle()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM10 5v14M15 5v14" /></svg>
        Columns
      </button>
      <div popover-panel class="ecp__panel">
        <p class="ecp__title">Columns</p>
        <input class="ecp__search" type="search" placeholder="Search columns…" data-testid="columns-search"
          [value]="search()" (input)="search.set($any($event.target).value)" />
        <ul class="ecp__list">
          @for (column of filteredColumns(); track column.key) {
            <li>
              <label class="ecp__item">
                <input type="checkbox" [attr.data-testid]="'column-toggle-' + column.key"
                  [checked]="draft().has(column.key)" [disabled]="column.locked" (change)="toggleColumn(column.key)" />
                {{ column.label }}
              </label>
            </li>
          }
        </ul>
        <div class="ecp__actions">
          <button type="button" class="ecp__btn" data-testid="columns-reset" (click)="reset()">Reset</button>
          <button type="button" class="ecp__btn ecp__btn--primary" data-testid="columns-apply" (click)="apply()">Apply</button>
        </div>
      </div>
    </app-popover>
  `,
  styles: [`
    .ecp__trigger { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .ecp__trigger:hover { background: var(--color-surface-secondary); }
    .ecp__trigger svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; }
    .ecp__panel { display: flex; flex-direction: column; gap: 10px; width: 15rem; }
    .ecp__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
    .ecp__search { padding: 6px 9px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 12px; }
    .ecp__list { display: flex; flex-direction: column; gap: 2px; max-height: 16rem; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
    .ecp__item { display: flex; align-items: center; gap: 8px; padding: 4px 2px; color: var(--color-text-primary); font-size: 13px; cursor: pointer; }
    .ecp__item input { accent-color: var(--color-accent); }
    .ecp__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .ecp__btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; cursor: pointer; }
    .ecp__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: #fff; }
  `]
})
export class EmployeeColumnPickerComponent {
  readonly visible = input.required<readonly EmployeeColumnKey[]>();
  readonly applied = output<EmployeeColumnKey[]>();

  protected readonly open = signal(false);
  protected readonly search = signal('');
  protected readonly draft = signal<ReadonlySet<EmployeeColumnKey>>(new Set());

  protected readonly filteredColumns = computed(() => {
    const term = this.search().trim().toLowerCase();
    return EMPLOYEE_COLUMNS.filter((c) => !term || c.label.toLowerCase().includes(term));
  });

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.draft.set(new Set(this.visible()));
    this.search.set('');
    this.open.set(true);
  }

  protected toggleColumn(key: EmployeeColumnKey): void {
    const next = new Set(this.draft());
    if (next.has(key)) next.delete(key); else next.add(key);
    this.draft.set(next);
  }

  protected reset(): void {
    this.draft.set(new Set(DEFAULT_EMPLOYEE_COLUMNS));
  }

  protected apply(): void {
    const draft = this.draft();
    this.applied.emit(EMPLOYEE_COLUMNS.filter((c) => c.locked || draft.has(c.key)).map((c) => c.key));
    this.open.set(false);
  }
}
