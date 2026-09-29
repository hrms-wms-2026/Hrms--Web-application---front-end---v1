import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CustomSelectComponent } from '../../../../shared/ui/custom-select/custom-select.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';

export type BulkTaskPickerMode = 'status' | 'priority' | 'assignee' | 'dueDate' | 'parent';

const TITLES: Record<BulkTaskPickerMode, string> = {
  status: 'Change status',
  priority: 'Set priority',
  assignee: 'Add assignee',
  dueDate: 'Set due date',
  parent: 'Convert to subtask'
};

const LABELS: Record<Exclude<BulkTaskPickerMode, 'dueDate'>, string> = {
  status: 'Status',
  priority: 'Priority',
  assignee: 'Assignee',
  parent: 'Parent task'
};

const PRIORITIES: SelectOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

@Component({
  selector: 'app-bulk-task-picker-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, CustomSelectComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="mode() !== null" [title]="title()" (closed)="closed.emit()">
      <div class="flex flex-col gap-4">
        @if (mode() === 'dueDate') {
          <app-date-picker label="Due date" [value]="value()" (valueChange)="value.set($event)" />
        } @else if (mode()) {
          <app-custom-select [label]="label()" placeholder="Select…" [options]="effectiveOptions()"
            [value]="value()" (valueChange)="value.set($event)" />
        }
        @if (mode() === 'parent') {
          <p class="text-xs text-[var(--color-text-secondary)]">Subtasks leave their sprint. Tasks that already have subtasks bring them along.</p>
        }
        @if (error(); as message) {
          <p class="text-xs text-[var(--color-danger-text)]">{{ message }}</p>
        }
        <div class="flex justify-end gap-2">
          @if (mode() === 'dueDate') {
            <app-button variant="secondary" data-testid="bulk-picker-clear-date" [disabled]="submitting()" (pressed)="clearDate()">Clear due date</app-button>
          }
          <app-button variant="secondary" (pressed)="closed.emit()">Cancel</app-button>
          <app-button data-testid="bulk-picker-submit" [loading]="submitting()" [disabled]="!canSubmit()" (pressed)="submit()">Apply</app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class BulkTaskPickerDialogComponent {
  readonly mode = input.required<BulkTaskPickerMode | null>();
  readonly count = input.required<number>();
  readonly options = input<readonly SelectOption[]>([]);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly confirmed = output<string | null>();
  readonly closed = output<void>();

  protected readonly value = signal('');
  protected readonly title = computed(() => {
    const mode = this.mode();
    return mode ? `${TITLES[mode]} · ${this.count()} task${this.count() === 1 ? '' : 's'}` : '';
  });
  protected readonly label = computed(() => {
    const mode = this.mode();
    return mode && mode !== 'dueDate' ? LABELS[mode] : '';
  });
  protected readonly effectiveOptions = computed(() =>
    this.mode() === 'priority' ? PRIORITIES : [...this.options()]);
  protected readonly canSubmit = computed(() => !!this.value() && !this.submitting());

  constructor() {
    effect(() => {
      this.mode();
      this.value.set('');
    });
  }

  protected submit(): void {
    if (this.canSubmit()) this.confirmed.emit(this.value());
  }

  protected clearDate(): void {
    this.confirmed.emit(null);
  }
}
