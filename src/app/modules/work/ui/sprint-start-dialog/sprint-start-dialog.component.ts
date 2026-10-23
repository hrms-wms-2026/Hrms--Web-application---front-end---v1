import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';
import { calculateUpcomingSprintDates } from '../../utils/sprint-date.utils';
import { LegalEntityStore, SELECTED_LEGAL_ENTITY_STORAGE_KEY } from '../../../organization/state/legal-entity.store';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';

@Component({
  selector: 'app-sprint-start-dialog',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, DateRangePickerComponent],
  template: `
    <app-modal [open]="open()" [title]="'Start ' + (sprint()?.name ?? 'sprint')" (closed)="cancelled.emit()">
      <div class="sprint-start-dialog">
        <p class="sprint-start-dialog__summary">
          {{ taskCount() }} task{{ taskCount() === 1 ? '' : 's' }} ·
          {{ totalEstimatedHours() }}h estimated ·
          {{ assigneeCount() }} member{{ assigneeCount() === 1 ? '' : 's' }} assigned
        </p>

        <div class="sprint-start-dialog__date-range" data-testid="sprint-date-range">
          <label class="sprint-start-dialog__label">Sprint dates *</label>
          <app-date-range-picker
            [from]="startDate()"
            [to]="endDate()"
            placeholder="Select start and end date"
            (rangeChange)="onDateRangeChange($event)"
          />
        </div>
        <app-input label="Sprint goal (optional)" [value]="goal()" (valueChange)="goal.set($event)" />

        @if (hasUnestimatedTasks()) {
          <p class="sprint-start-dialog__warning">⚠ Some tasks have no estimate.</p>
        }
        @if (hasUnassignedTasks()) {
          <p class="sprint-start-dialog__warning">⚠ Some tasks have no assignee.</p>
        }
        <p class="sprint-start-dialog__hint">You can still start the sprint.</p>

        @if (dateError()) {
          <p class="sprint-start-dialog__error" role="alert">{{ dateError() }}</p>
        }
        @if (store.error()) {
          <p class="sprint-start-dialog__error" role="alert">{{ store.error() }}</p>
        }

        <div class="sprint-start-dialog__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Start sprint</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .sprint-start-dialog { display: flex; flex-direction: column; gap: 8px; }
    .sprint-start-dialog__summary { font-size: 12px; color: var(--color-text-secondary); margin: 0 0 4px; }
    .sprint-start-dialog__warning { color: var(--color-warning-text, #92400e); font-size: 12px; margin: 0; }
    .sprint-start-dialog__hint { font-size: 12px; color: var(--color-text-secondary); margin: 0; }
    .sprint-start-dialog__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-start-dialog__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .sprint-start-dialog__actions ::ng-deep app-button > button {
      width: auto;
      height: 30px;
      padding: 0 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
    }
    .sprint-start-dialog__date-range { display: flex; flex-direction: column; gap: 4px; }
    .sprint-start-dialog__label { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); }
    :host ::ng-deep .sprint-start-dialog__date-range app-date-range-picker { width: 100%; display: block; }
    :host ::ng-deep .sprint-start-dialog__date-range .drp-container { width: 100%; display: flex; }
    :host ::ng-deep .sprint-start-dialog__date-range .drp-trigger {
      width: 100%;
      min-height: 38px;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 400;
      justify-content: flex-start;
      gap: 0.5rem;
      border: 1px solid var(--color-border);
      background-color: var(--color-surface);
      color: var(--color-text-primary);
    }
    :host ::ng-deep .sprint-start-dialog__date-range .drp-popover { z-index: 100; }
  `]
})
export class SprintStartDialogComponent {
  protected readonly store = inject(SprintListStore);
  protected readonly legalEntityStore = inject(LegalEntityStore);
  protected readonly generalSettingsStore = inject(GeneralSettingsStore);
  // Company General Settings is an admin endpoint (legal_entity:read/update) - anyone else
  // would get a 403, so they get calculateUpcomingSprintDates' Monday-start default instead.
  private readonly canReadCompanySettings = inject(PermissionService).hasAnyPermission(['legal_entity:read', 'legal_entity:update']);

  open = input(false);
  sprint = input<Sprint | null>(null);
  tasks = input<readonly WorkTask[]>([]);
  projectId = input.required<string>();

  started = output<void>();
  cancelled = output<void>();

  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly goal = signal('');
  protected readonly submitting = signal(false);
  protected readonly dateError = signal<string | null>(null);
  private userModifiedDates = false;

  protected readonly taskCount = computed(() => this.tasks().length);
  protected readonly totalEstimatedHours = computed(() =>
    this.tasks().reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0)
  );
  protected readonly assigneeCount = computed(() =>
    new Set(this.tasks().flatMap((t) => t.assigneeEmployeeIds)).size
  );
  protected readonly hasUnestimatedTasks = computed(() =>
    this.tasks().some((t) => t.estimatedHours == null)
  );
  protected readonly hasUnassignedTasks = computed(() =>
    this.tasks().some((t) => t.assigneeEmployeeIds.length === 0)
  );

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.userModifiedDates = false;
        return;
      }
      const current = this.sprint();
      this.goal.set(current?.goal ?? '');
      this.dateError.set(null);

      // Trigger legal entity settings load if needed
      const legalEntityId =
        this.legalEntityStore.selectedLegalEntityId() ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY) : null);
      if (this.canReadCompanySettings && legalEntityId && !this.generalSettingsStore.settings() && !this.generalSettingsStore.loading()) {
        void this.generalSettingsStore.load(legalEntityId);
      }

      if (current?.startDate && current?.endDate) {
        this.startDate.set(current.startDate.toISOString().slice(0, 10));
        this.endDate.set(current.endDate.toISOString().slice(0, 10));
      } else if (!this.userModifiedDates) {
        const settings = this.generalSettingsStore.settings();
        const { startDate, endDate } = calculateUpcomingSprintDates(settings);
        this.startDate.set(startDate);
        this.endDate.set(endDate);
      }
    });
  }

  onDateRangeChange(range: { from: string; to: string }): void {
    this.userModifiedDates = true;
    this.startDate.set(range.from);
    this.endDate.set(range.to);
    this.dateError.set(null);
  }

  async submit(): Promise<void> {
    this.dateError.set(null);
    const current = this.sprint();
    if (!current || !this.startDate() || !this.endDate()) {
      this.dateError.set('Start and end dates are required.');
      return;
    }

    this.submitting.set(true);
    try {
      const ok = await this.store.start(current.id, {
        startDate: this.startDate(),
        endDate: this.endDate(),
        goal: this.goal().trim() || undefined
      }, this.projectId());
      if (ok) this.started.emit();
    } finally {
      this.submitting.set(false);
    }
  }
}
