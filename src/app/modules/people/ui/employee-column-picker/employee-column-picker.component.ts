import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, output, signal } from '@angular/core';
import { FieldIconComponent } from '../../../../shared/ui/field-icon/field-icon.component';
import { DEFAULT_EMPLOYEE_COLUMNS, EMPLOYEE_COLUMNS, EmployeeColumnDef, EmployeeColumnKey } from '../../models/employee-columns';

/**
 * "Employee fields" side panel (ClickUp People-fields style). It floats over the right edge of the
 * page's content area - flush to its right and bottom edges, just under the sticky page header - so it
 * takes no layout space. Each switch applies straight away; the caller owns the open state and saves it.
 */
@Component({
  selector: 'app-employee-column-picker',
  standalone: true,
  imports: [FieldIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ecp', role: 'complementary', 'aria-label': 'Employee fields', '(keydown.escape)': 'closed.emit()',
    '(window:resize)': 'measure()',
    '[style.top.px]': 'box().top', '[style.right.px]': 'box().right', '[style.bottom.px]': 'box().bottom',
    '[style.border-bottom-right-radius]': 'box().radius'
  },
  template: `
    <div class="ecp__head">
      <h2 class="ecp__title">Employee fields</h2>
      <button type="button" class="ecp__close" data-testid="columns-close" aria-label="Close employee fields" (click)="closed.emit()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <input class="ecp__search" type="search" placeholder="Search fields" aria-label="Search fields" data-testid="columns-search"
      [value]="search()" (input)="search.set($any($event.target).value)" />

    <div class="ecp__body scroll-fade">
      @for (group of groups(); track group.id) {
        <section class="ecp__group" [attr.aria-label]="group.title">
          <div class="ecp__group-head">
            <span>{{ group.title }}</span>
            <span class="ecp__count" [attr.data-testid]="'columns-count-' + group.id">{{ group.columns.length }}</span>
          </div>
          @for (column of group.columns; track column.key) {
            <div class="ecp__item" [class.ecp__item--locked]="column.locked">
              <app-field-icon class="ecp__icon" [name]="column.icon" />
              <span class="ecp__label" [id]="'ecp-label-' + column.key">{{ column.label }}</span>
              <button type="button" role="switch" class="ecp__switch"
                [attr.data-testid]="'column-toggle-' + column.key"
                [attr.aria-checked]="isShown(column.key)"
                [attr.aria-labelledby]="'ecp-label-' + column.key"
                [disabled]="column.locked"
                [title]="column.locked ? 'Always shown' : ''"
                (click)="toggleColumn(column.key)">
                <span class="ecp__knob"></span>
              </button>
            </div>
          } @empty {
            <p class="ecp__none">{{ search() ? 'No matching fields' : 'None' }}</p>
          }
        </section>
      }
    </div>

    <div class="ecp__foot">
      <button type="button" class="ecp__reset" data-testid="columns-reset" (click)="reset()">Reset to default</button>
    </div>
  `,
  styles: [`
    :host { position: fixed; z-index: 40; display: flex; flex-direction: column; width: 320px; max-width: 100vw; padding-top: 12px; box-sizing: border-box;
      border-left: 1px solid var(--color-border); background: var(--color-content-bg); box-shadow: var(--shadow-popover);
      color: var(--color-text-primary); animation: ecp-in 180ms var(--ease-out, ease-out); }
    @keyframes ecp-in { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    .ecp__head { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 12px; }
    .ecp__title { margin: 0; font-size: 14px; font-weight: 600; }
    .ecp__close { display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%;
      background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); color: var(--color-text-secondary); cursor: pointer; }
    .ecp__close:hover { color: var(--color-text-primary); background: color-mix(in srgb, var(--color-text-primary) 10%, transparent); }
    .ecp__close svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .ecp__search { margin: 0 16px 8px; padding: 7px 10px; border: 1px solid var(--color-border); border-radius: 8px; background: transparent;
      color: var(--color-text-primary); font: inherit; font-size: 13px; outline: none; }
    .ecp__search:focus { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }
    .ecp__body { flex: 1; min-height: 0; overflow-y: auto; }
    .ecp__group { padding: 8px 0; }
    .ecp__group + .ecp__group { border-top: 1px solid var(--color-border); }
    .ecp__group-head { display: flex; justify-content: space-between; padding: 6px 16px; color: var(--color-text-secondary); font-size: 12px; }
    .ecp__item { display: flex; align-items: center; gap: 10px; padding: 6px 16px; font-size: 13px; }
    .ecp__item:hover { background: color-mix(in srgb, var(--color-text-primary) 3%, transparent); }
    .ecp__icon { color: var(--color-text-secondary); }
    .ecp__label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ecp__item--locked .ecp__label { color: var(--color-text-secondary); }
    .ecp__switch { position: relative; width: 26px; height: 15px; flex-shrink: 0; padding: 0; border: 0; border-radius: 999px;
      background: color-mix(in srgb, var(--color-text-primary) 22%, transparent); cursor: pointer; transition: background-color 150ms ease; }
    .ecp__switch[aria-checked="true"] { background: var(--color-accent); }
    .ecp__switch:disabled { opacity: .5; cursor: default; }
    .ecp__switch:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
    .ecp__knob { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: var(--color-text-inverse);
      transition: transform 150ms var(--ease-out, ease-out); }
    .ecp__switch[aria-checked="true"] .ecp__knob { transform: translateX(11px); }
    .ecp__none { margin: 0; padding: 4px 16px; color: var(--color-text-secondary); font-size: 12px; }
    .ecp__foot { padding: 10px 16px; border-top: 1px solid var(--color-border); }
    .ecp__reset { padding: 0; border: 0; background: none; color: var(--color-text-secondary); font: inherit; font-size: 12px; cursor: pointer; }
    .ecp__reset:hover { color: var(--color-accent); }
  `]
})
export class EmployeeColumnPickerComponent {
  readonly visible = input.required<readonly EmployeeColumnKey[]>();
  /** Fires on every switch with the new visible keys in canonical order. */
  readonly applied = output<EmployeeColumnKey[]>();
  readonly closed = output<void>();

  protected readonly search = signal('');
  /** Fixed-position box: matches the content area's right/bottom edges, starts under the page header. */
  protected readonly box = signal({ top: 0, right: 0, bottom: 0, radius: '0px' });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      this.measure();
      this.host.nativeElement.querySelector<HTMLInputElement>('.ecp__search')?.focus();
    });
    // The content area can move when the sidebar collapses; re-measure on the next frames too.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.measure());
    afterNextRender(() => { const area = this.contentArea(); if (ro && area) ro.observe(area); });
    inject(DestroyRef).onDestroy(() => ro?.disconnect());
  }

  protected measure(): void {
    const area = this.contentArea();
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const header = document.querySelector('.emp-page-header')?.getBoundingClientRect();
    const top = header && header.bottom > rect.top ? header.bottom : rect.top;
    this.box.set({
      top: Math.round(top),
      right: Math.max(0, Math.round(window.innerWidth - rect.right)),
      bottom: Math.max(0, Math.round(window.innerHeight - rect.bottom)),
      radius: getComputedStyle(area).borderBottomRightRadius
    });
  }

  private contentArea(): HTMLElement | null {
    return this.host.nativeElement.closest<HTMLElement>('.main-content') ?? document.querySelector<HTMLElement>('.main-content');
  }

  private readonly visibleSet = computed(() => new Set(this.visible()));
  private readonly matching = computed(() => {
    const term = this.search().trim().toLowerCase();
    return EMPLOYEE_COLUMNS.filter((c) => !term || c.label.toLowerCase().includes(term));
  });
  protected readonly groups = computed<{ id: 'shown' | 'hidden'; title: string; columns: EmployeeColumnDef[] }[]>(() => [
    { id: 'shown', title: 'Shown', columns: this.matching().filter((c) => c.locked || this.visibleSet().has(c.key)) },
    { id: 'hidden', title: 'Hidden', columns: this.matching().filter((c) => !c.locked && !this.visibleSet().has(c.key)) }
  ]);

  protected isShown(key: EmployeeColumnKey): boolean {
    return this.visibleSet().has(key) || !!EMPLOYEE_COLUMNS.find((c) => c.key === key)?.locked;
  }

  protected toggleColumn(key: EmployeeColumnKey): void {
    const next = new Set(this.visible());
    if (next.has(key)) next.delete(key); else next.add(key);
    this.emit(next);
  }

  protected reset(): void {
    this.emit(new Set(DEFAULT_EMPLOYEE_COLUMNS));
  }

  private emit(keys: ReadonlySet<EmployeeColumnKey>): void {
    this.applied.emit(EMPLOYEE_COLUMNS.filter((c) => c.locked || keys.has(c.key)).map((c) => c.key));
  }
}
