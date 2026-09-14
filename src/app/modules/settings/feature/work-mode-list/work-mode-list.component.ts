import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WorkModeStore } from '../../state/work-mode.store';
import { UpsertWorkModeRequest } from '../../models/work-mode.model';

function emptyDraft(): UpsertWorkModeRequest {
  return { name: '', biometricEnabled: false, webEnabled: true, trayEnabled: false, photoRequired: false };
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
  imports: [FormsModule],
  templateUrl: './work-mode-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkModeListComponent {
  readonly legalEntityId = input.required<string>();
  /** Controls whether toggles/add/deactivate are interactive. Defaults to true for read/write callers. */
  readonly canEdit = input<boolean>(true);

  readonly store = inject(WorkModeStore);

  draft: UpsertWorkModeRequest = emptyDraft();
  addingNew = false;

  constructor() {
    effect(() => this.store.load(this.legalEntityId()));
  }

  startAdd(): void {
    this.draft = emptyDraft();
    this.addingNew = true;
  }

  confirmAdd(): void {
    if (!this.draft.name.trim()) {
      return;
    }
    this.store.create(this.draft);
    this.addingNew = false;
  }

  cancelAdd(): void {
    this.addingNew = false;
  }

  save(id: string, payload: UpsertWorkModeRequest): void {
    this.store.update(id, payload);
  }

  deactivate(id: string, name: string): void {
    if (window.confirm(`Deactivate "${name}"? Employees assigned to it will need to be reassigned.`)) {
      this.store.deactivate(id);
    }
  }
}
