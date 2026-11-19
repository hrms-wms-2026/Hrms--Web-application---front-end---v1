import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-choose-checklist-step',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Choose Exit Checklist Template</h3>
        <p class="obs-step-subtitle">Select an offboarding template tailored to this employee's department and position.</p>
      </div>

      @if (store.loading()) {
        <app-loader label="Loading matching checklists…" />
      } @else if (store.checklistMatches().length === 0) {
        <div class="obs-empty-state">
          <p class="obs-empty-state__text">No active offboarding checklist templates match this employee's company, department, or position.</p>
        </div>
      } @else {
        <div class="obs-card-list">
          @for (match of store.checklistMatches(); track match.id) {
            <label class="obs-checklist-card" [class.obs-checklist-card--selected]="selectedId() === match.id">
              <input
                type="radio"
                name="template"
                [value]="match.id"
                [checked]="selectedId() === match.id"
                (change)="selectedId.set(match.id)"
                class="obs-radio"
              />
              <div class="obs-checklist-card__info">
                <span class="obs-checklist-card__name">{{ match.name }}</span>
                <span class="obs-match-badge">{{ match.matchLevel }} match</span>
              </div>
            </label>
          }
        </div>
      }
      @if (!store.loading()) {
        <div class="obs-actions">
          <app-button variant="secondary" data-testid="skip-checklist" [disabled]="store.saving()" (pressed)="skip()">
            Continue without a checklist
          </app-button>
          @if (store.checklistMatches().length > 0) {
            <app-button variant="primary" [loading]="store.saving()" [disabled]="!selectedId()" (pressed)="confirm()">
              Use This Checklist
            </app-button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .obs-step-container {
      max-width: 42rem;
    }
    .obs-step-header {
      margin-bottom: 1.25rem;
    }
    .obs-step-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .obs-step-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.825rem;
      color: var(--color-text-secondary);
    }
    .obs-card-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }
    .obs-checklist-card {
      display: flex;
      align-items: center;
      gap: 0.875rem;
      padding: 1rem 1.15rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .obs-checklist-card:hover {
      border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
      background: color-mix(in srgb, var(--color-primary) 2%, var(--color-surface));
    }
    .obs-checklist-card--selected {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 4%, var(--color-surface));
      box-shadow: 0 0 0 1px var(--color-primary);
    }
    .obs-radio {
      accent-color: var(--color-primary);
      width: 1.125rem;
      height: 1.125rem;
      cursor: pointer;
    }
    .obs-checklist-card__info {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 0.75rem;
    }
    .obs-checklist-card__name {
      font-size: 0.875rem;
      font-weight: 650;
      color: var(--color-text-primary);
    }
    .obs-match-badge {
      padding: 0.15rem 0.5rem;
      border-radius: 6px;
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
      color: var(--color-primary);
      font-size: 0.725rem;
      font-weight: 650;
      text-transform: capitalize;
    }
    .obs-empty-state {
      margin-bottom: 1.5rem;
      padding: 2rem 1.25rem;
      text-align: center;
      border: 1px dashed var(--color-border);
      border-radius: 12px;
    }
    .obs-empty-state__text {
      margin: 0;
      font-size: 0.85rem;
      color: var(--color-text-secondary);
    }
    .obs-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
  `],
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

  /** Moves the offboarding on with no checklist tasks, e.g. when no template matches the employee. */
  async skip(): Promise<void> {
    await this.store.selectChecklist(this.employeeId(), null);
  }
}
