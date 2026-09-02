import { Component, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../../people/models/employee.model';

@Component({
  selector: 'app-calendar-participant-picker',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open()" title="Add participants" (closed)="closed.emit()">
      <input
        data-testid="calendar-participant-picker-search"
        type="text"
        placeholder="Search by name or email"
        class="mb-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]"
        (input)="onSearchInput($event)"
      />
      <div class="flex max-h-64 flex-col gap-1 overflow-y-auto">
        @for (employee of results(); track employee.id) {
          <button
            type="button"
            data-testid="calendar-participant-picker-row"
            [attr.data-selected]="isSelected(employee.id)"
            class="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface-secondary)]"
            (click)="toggle(employee.id)"
          >
            <span class="flex flex-col items-start">
              <span class="font-medium text-[var(--color-text-primary)]">{{ employee.fullName }}</span>
              <span class="text-[10px] text-[var(--color-text-secondary)]">{{ employee.email }} · {{ employee.departmentName }}</span>
            </span>
            @if (isSelected(employee.id)) {
              <span class="text-[var(--color-accent)]">✓</span>
            }
          </button>
        }
      </div>
    </app-modal>
  `
})
export class CalendarParticipantPickerComponent {
  private readonly peopleApi = inject(PeopleApiService);

  open = input(false);
  selectedIds = input<readonly string[]>([]);
  selectedIdsChange = output<readonly string[]>();
  closed = output<void>();

  results = signal<readonly EmployeeListItemResponse[]>([]);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.query('');
      }
    });
  }

  onSearchInput(event: Event): void {
    this.query((event.target as HTMLInputElement).value);
  }

  isSelected(employeeId: string): boolean {
    return this.selectedIds().includes(employeeId);
  }

  toggle(employeeId: string): void {
    const current = this.selectedIds();
    const next = current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId];
    this.selectedIdsChange.emit(next);
  }

  private query(search: string): void {
    this.peopleApi.listEmployees({ search, page: 1, pageSize: 20 }).subscribe((page) => this.results.set(page.items));
  }
}
