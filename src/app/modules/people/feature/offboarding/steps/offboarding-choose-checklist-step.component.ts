import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-choose-checklist-step',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    @if (store.loading()) {
      <app-loader label="Loading matching checklists…" />
    } @else if (store.checklistMatches().length === 0) {
      <p class="text-sm text-[var(--color-text-secondary)]">No active offboarding checklist templates match this employee's company, department, or position.</p>
    } @else {
      <div class="space-y-2 max-w-xl">
        @for (match of store.checklistMatches(); track match.id) {
          <label class="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg cursor-pointer">
            <input type="radio" name="template" [value]="match.id" [checked]="selectedId() === match.id" (change)="selectedId.set(match.id)" />
            <span>{{ match.name }}</span>
            <span class="text-xs text-[var(--color-text-secondary)]">({{ match.matchLevel }} match)</span>
          </label>
        }
      </div>
      <app-button variant="primary" class="mt-4" [loading]="store.saving()" [disabled]="!selectedId()" (pressed)="confirm()">
        Use This Checklist
      </app-button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingChooseChecklistStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);
  readonly selectedId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.employeeId();
      if (id) void this.store.loadChecklistMatches(id);
    });
  }

  async confirm(): Promise<void> {
    const templateId = this.selectedId();
    if (!templateId) return;
    await this.store.selectChecklist(this.employeeId(), templateId);
  }
}
