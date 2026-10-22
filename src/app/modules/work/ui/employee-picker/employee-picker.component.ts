import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../../people/models/employee.model';

@Component({
  selector: 'app-employee-picker',
  standalone: true,
  imports: [ModalComponent, NgTemplateOutlet],
  template: `
    @if (inline()) {
      <ng-container [ngTemplateOutlet]="body" />
    } @else {
      <app-modal [open]="open()" title="Choose a person" (closed)="onClose()">
        <ng-container [ngTemplateOutlet]="body" />
      </app-modal>
    }

    <ng-template #body>
      <input
        data-testid="employee-picker-search"
        type="text"
        placeholder="Search by name or email"
        class="mb-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]"
        (input)="onSearchInput($event)"
      />
      <div class="flex max-h-64 flex-col gap-1 overflow-y-auto scroll-fade">
        @for (employee of results(); track employee.id) {
          <button
            type="button"
            data-testid="employee-picker-row"
            class="flex flex-col items-start rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface-secondary)]"
            (click)="selected.emit(employee.id)"
          >
            <span class="font-medium text-[var(--color-text-primary)]">{{ employee.fullName }}</span>
            <span class="text-[10px] text-[var(--color-text-secondary)]">{{ employee.email }} · {{ employee.departmentName }}</span>
          </button>
        }
      </div>
      <span data-testid="employee-picker-close" (click)="onClose()"></span>
    </ng-template>
  `
})
export class EmployeePickerComponent {
  private readonly peopleApi = inject(PeopleApiService);

  open = input(false);
  inline = input(false);
  selected = output<string>();
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

  onClose(): void {
    this.closed.emit();
  }

  private query(search: string): void {
    this.peopleApi.listEmployees({ search, page: 1, pageSize: 20 }).subscribe((page) => {
      this.results.set(page.items);
    });
  }
}
