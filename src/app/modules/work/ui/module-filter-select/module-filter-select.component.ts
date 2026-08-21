import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-module-filter-select',
  standalone: true,
  imports: [FormsModule],
  template: `
    <label class="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
      <span class="font-medium">Module</span>
      <select
        data-testid="module-filter-select"
        class="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
        [ngModel]="selected()"
        (ngModelChange)="selectionChanged.emit($event)"
      >
        <option value="all">All modules</option>
        @for (option of options(); track option.id) {
          <option [value]="option.id">{{ option.title }}</option>
        }
      </select>
    </label>
  `
})
export class ModuleFilterSelectComponent {
  options = input.required<{ id: string; title: string }[]>();
  selected = input.required<string>();
  selectionChanged = output<string>();
}
