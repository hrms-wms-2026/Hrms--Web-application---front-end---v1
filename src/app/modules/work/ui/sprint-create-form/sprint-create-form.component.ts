import { Component, computed, inject, input, output, signal } from '@angular/core';
import { SprintListStore } from '../../state/sprint-list.store';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';

export interface SprintCreateModuleOption {
  objectiveId: string;
  title: string;
  isOwner: boolean;
}

@Component({
  selector: 'app-sprint-create-form',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, SelectComponent],
  template: `
    <app-modal [open]="open()" title="Create sprint" (closed)="cancelled.emit()">
      <div class="sprint-create-form">
        @if (modules().length > 0) {
          <app-select
            [options]="moduleOptions()"
            [value]="selectedObjectiveId()"
            label="Module"
            placeholder="Select a module"
            [error]="moduleError() || ''"
            [icon]="'module'"
            (valueChange)="selectedObjectiveId.set($event)"
          />
        }
        <app-input label="Name" [value]="newName()" (valueChange)="newName.set($event)" />
        <app-input label="Start date" type="date" [value]="newStart()" (valueChange)="newStart.set($event)" />
        <app-input label="End date" type="date" [value]="newEnd()" (valueChange)="newEnd.set($event)" />

        @if (store.error()) {
          <p class="sprint-create-form__error" role="alert">{{ store.error() }}</p>
        }

        <div class="sprint-create-form__actions">
          <app-button variant="secondary" [disabled]="submitting()" (pressed)="cancelled.emit()">Cancel</app-button>
          <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Save</app-button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .sprint-create-form { display: flex; flex-direction: column; gap: 8px; }
    .sprint-create-form__field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-text-primary); }
    .sprint-create-form__select { border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
    .sprint-create-form__field-error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-create-form__error { color: var(--color-danger-text); font-size: 12px; }
    .sprint-create-form__actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class SprintCreateFormComponent {
  protected readonly store = inject(SprintListStore);

  open = input(false);
  /** Fixed target module - used as-is when no `modules` list is provided (Tree's context,
   *  where the module is already implicit from where "Create sprint" was clicked). */
  objectiveId = input<string>('');
  isObjectiveOwner = input(false);
  /** When provided (Backlog's project-wide context), renders a required Module picker instead
   *  of relying on `objectiveId`/`isObjectiveOwner`. Unlike task creation, sprint creation has no
   *  pending/request path - `SprintApiService.create` always creates for real, so callers MUST
   *  only pass modules the user actually owns; `isOwner` here only feeds the post-create reload
   *  filter (`activeOnly`), it is not an authorization check. */
  modules = input<readonly SprintCreateModuleOption[]>([]);

  created = output<void>();
  cancelled = output<void>();

  protected readonly newName = signal('');
  protected readonly newStart = signal('');
  protected readonly newEnd = signal('');
  protected readonly submitting = signal(false);
  protected readonly selectedObjectiveId = signal('');
  protected readonly moduleError = signal<string | null>(null);

  protected readonly moduleOptions = computed<SelectOption[]>(() =>
    this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
  );

  private readonly effectiveObjectiveId = computed(() =>
    this.modules().length > 0 ? this.selectedObjectiveId() : this.objectiveId()
  );

  private readonly effectiveIsObjectiveOwner = computed(() => {
    if (this.modules().length === 0) return this.isObjectiveOwner();
    return this.modules().find((m) => m.objectiveId === this.selectedObjectiveId())?.isOwner ?? false;
  });

  async submit(): Promise<void> {
    this.moduleError.set(null);
    const objectiveId = this.effectiveObjectiveId();
    if (!objectiveId) {
      this.moduleError.set('Select a module first.');
      return;
    }

    this.submitting.set(true);
    try {
      const ok = await this.store.create(objectiveId, {
        name: this.newName().trim(),
        startDate: this.newStart(),
        endDate: this.newEnd()
      }, !this.effectiveIsObjectiveOwner());
      if (ok) {
        this.newName.set('');
        this.newStart.set('');
        this.newEnd.set('');
        this.selectedObjectiveId.set('');
        this.created.emit();
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
