import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CustomSelectComponent } from '../../../../shared/ui/custom-select/custom-select.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EMPLOYMENT_TYPE_OPTIONS } from '../../models/employment-type-options';
import { countActiveFilters, EMPTY_EMPLOYEE_FILTERS, EmployeeListFilters } from '../../utils/employee-list-url-state';

@Component({
  selector: 'app-employee-filter-popover',
  standalone: true,
  imports: [PopoverComponent, CustomSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-popover [open]="open()" align="right" ariaLabel="Filter employees" (closed)="open.set(false)">
      <button popover-trigger type="button" class="efp__trigger" data-testid="filter-trigger" [attr.aria-expanded]="open()" (click)="toggle()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filter
        @if (activeCount() > 0) { <span class="efp__count" data-testid="filter-count">{{ activeCount() }}</span> }
      </button>
      <div popover-panel class="efp__panel">
        <p class="efp__title">Filter</p>
        @if (!legalEntityId()) {
          <p class="efp__hint" data-testid="filter-no-company">Select a company to filter by department, position or manager.</p>
        } @else {
          <app-custom-select label="Department" placeholder="Select department" [options]="departmentOptions()"
            [value]="draft().departmentId ?? ''" (valueChange)="patch({ departmentId: $event || null })" />
          <app-custom-select label="Position" placeholder="Select position" [options]="positionOptions()"
            [value]="draft().positionId ?? ''" (valueChange)="patch({ positionId: $event || null })" />
        }
        <fieldset class="efp__types">
          <legend>Employment Type</legend>
          @for (type of employmentTypes; track type.value) {
            <label class="efp__check">
              <input type="checkbox" [attr.data-testid]="'filter-type-' + type.value"
                [checked]="draft().employmentTypes.includes(type.value)" (change)="toggleType(type.value)" />
              {{ type.label }}
            </label>
          }
        </fieldset>
        @if (legalEntityId()) {
          <app-custom-select label="Reporting Manager" placeholder="Select manager" [options]="managerOptions()"
            [value]="draft().managerId ?? ''" (valueChange)="patch({ managerId: $event || null })" />
        }
        @if (loadError(); as error) { <p class="efp__error">{{ error }}</p> }
        <div class="efp__actions">
          <button type="button" class="efp__btn" data-testid="filter-reset" (click)="draft.set(empty)">Reset</button>
          <button type="button" class="efp__btn efp__btn--primary" data-testid="filter-apply" (click)="apply()">Apply</button>
        </div>
      </div>
    </app-popover>
  `,
  styles: [`
    .efp__trigger { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .efp__trigger:hover { background: var(--color-surface-secondary); }
    .efp__trigger svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .efp__count { min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-accent); color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
    .efp__panel { display: flex; flex-direction: column; gap: 10px; width: 17rem; }
    .efp__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
    .efp__hint { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
    .efp__error { margin: 0; font-size: 12px; color: var(--color-danger-text); }
    .efp__types { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; border: 0; }
    .efp__types legend { margin-bottom: 4px; font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .efp__check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-primary); }
    .efp__check input { accent-color: var(--color-accent); }
    .efp__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .efp__btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; cursor: pointer; }
    .efp__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: #fff; }
  `]
})
export class EmployeeFilterPopoverComponent {
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly peopleApi = inject(PeopleApiService);

  readonly value = input.required<EmployeeListFilters>();
  readonly legalEntityId = input<string | null>(null);
  readonly applied = output<EmployeeListFilters>();

  protected readonly empty = EMPTY_EMPLOYEE_FILTERS;
  protected readonly employmentTypes = EMPLOYMENT_TYPE_OPTIONS;
  protected readonly open = signal(false);
  protected readonly draft = signal<EmployeeListFilters>(EMPTY_EMPLOYEE_FILTERS);
  protected readonly departmentOptions = signal<SelectOption[]>([]);
  protected readonly positionOptions = signal<SelectOption[]>([]);
  protected readonly managerOptions = signal<SelectOption[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly activeCount = computed(() => countActiveFilters(this.value()));
  private loadedForLegalEntityId: string | null = null;

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.draft.set(this.value());
    this.loadOptions();
    this.open.set(true);
  }

  protected patch(change: Partial<EmployeeListFilters>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  protected toggleType(code: string): void {
    this.draft.update((d) => ({
      ...d,
      employmentTypes: d.employmentTypes.includes(code) ? d.employmentTypes.filter((c) => c !== code) : [...d.employmentTypes, code]
    }));
  }

  protected apply(): void {
    this.applied.emit(this.draft());
    this.open.set(false);
  }

  private loadOptions(): void {
    const legalEntityId = this.legalEntityId();
    if (!legalEntityId || legalEntityId === this.loadedForLegalEntityId) return;
    this.loadedForLegalEntityId = legalEntityId;
    this.loadError.set(null);
    forkJoin({
      departments: this.departmentApi.listFlat(legalEntityId, { pageSize: 100 }),
      positions: this.positionApi.listFlat(legalEntityId, { pageSize: 100, includeInactive: false }),
      managers: this.peopleApi.listEmployees({ legalEntityId, pageSize: 100 })
    }).subscribe({
      next: ({ departments, positions, managers }) => {
        this.departmentOptions.set(departments.items.map((d) => ({ value: d.id, label: d.name })));
        this.positionOptions.set(positions.items.map((p) => ({ value: p.id, label: p.name })));
        this.managerOptions.set(managers.items.map((m) => ({ value: m.id, label: m.fullName })));
      },
      error: () => {
        this.loadedForLegalEntityId = null;
        this.loadError.set('Could not load filter options.');
      }
    });
  }
}
