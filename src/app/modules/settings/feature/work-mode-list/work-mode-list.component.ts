import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { WorkModeStore } from '../../state/work-mode.store';
import { UpsertWorkModeRequest } from '../../models/work-mode.model';

function emptyDraft(): UpsertWorkModeRequest {
  return {
    name: '',
    biometricEnabled: false,
    webEnabled: true,
    trayEnabled: false,
    photoRequired: false,
    selfRegistersLocation: false,
    allowsDailyLocationChoice: false
  };
}

/**
 * Settings → Clock-in Policy — dynamic list of a legal entity's Work Modes
 * (replaces the old fixed Onsite/Remote/Hybrid/Field panels). Consumes the
 * root-provided WorkModeStore (Task 15) directly; no component-level
 * re-provision, matching this codebase's convention for other root stores
 * (see MonitoringStore/DepartmentStore consumers).
 */
@Component({
  selector: 'app-work-mode-list',
  standalone: true,
  imports: [FormsModule, ButtonComponent, InputComponent, ModalComponent],
  templateUrl: './work-mode-list.component.html',
  styleUrl: './work-mode-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkModeListComponent {
  readonly legalEntityId = input.required<string>();
  /** Controls whether toggles/add/deactivate are interactive. Defaults to true for read/write callers. */
  readonly canEdit = input<boolean>(true);
  readonly changed = output<void>();

  readonly store = inject(WorkModeStore);

  draft: UpsertWorkModeRequest = emptyDraft();
  readonly addingNew = signal(false);

  constructor() {
    effect(() => this.store.load(this.legalEntityId()));
  }

  startAdd(): void {
    this.draft = emptyDraft();
    this.addingNew.set(true);
  }

  confirmAdd(): void {
    const trimmedName = this.draft.name.trim();
    if (!trimmedName) {
      return;
    }
    this.store.create({ ...this.draft, name: trimmedName });
    this.addingNew.set(false);
    this.changed.emit();
  }

  cancelAdd(): void {
    this.addingNew.set(false);
  }

  save(id: string, payload: UpsertWorkModeRequest): void {
    this.store.update(id, payload);
    this.changed.emit();
  }

  /**
   * Flipping one of the two location-behavior toggles on always turns the other off - a work mode
   * can't both self-register a fixed location and let the employee choose daily (enforced again
   * server-side by the command validators as the source of truth; this just avoids a round-trip
   * error for the obvious case).
   */
  setLocationBehavior(
    payload: UpsertWorkModeRequest,
    field: 'selfRegistersLocation' | 'allowsDailyLocationChoice',
    checked: boolean
  ): UpsertWorkModeRequest {
    return {
      ...payload,
      selfRegistersLocation: field === 'selfRegistersLocation' ? checked : !checked && payload.selfRegistersLocation,
      allowsDailyLocationChoice:
        field === 'allowsDailyLocationChoice' ? checked : !checked && payload.allowsDailyLocationChoice
    };
  }

  deactivate(id: string, name: string): void {
    if (window.confirm(`Delete "${name}"? Employees assigned to it will need to be reassigned.`)) {
      this.store.deactivate(id);
      this.changed.emit();
    }
  }
}
