import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  OwnerSetupGuideService,
  SetupStep,
} from '../../../modules/dashboard/state/owner-setup-guide.service';
import { CreateLegalEntityRequest } from '../../../modules/organization/models/legal-entity.model';
import { LegalEntityStore } from '../../../modules/organization/state/legal-entity.store';
import { CreateCompanyModalComponent } from '../../../modules/organization/ui/create-company-modal/create-company-modal.component';
import { AddEmployeeWizardComponent } from '../../../modules/people/feature/add-employee-wizard/add-employee-wizard.component';
import { SelfPrefill } from '../../../modules/people/models/onboarding-draft.model';

/** While the guide is open the status is re-read this often, so a step done on another page ticks itself off. */
const REFRESH_INTERVAL_MS = 20_000;

const STEP_ROUTES: Partial<Record<SetupStep['key'], string>> = {
  department: '/organization/departments',
  position: '/organization/positions',
};

/**
 * Floating bottom-right "Set up your company" card for an owner with no employee profile: legal entity,
 * department, position, then "Add yourself as an employee". It stays on every page, folds into a small pill,
 * and can be skipped (My Work then offers "Resume setup").
 */
@Component({
  selector: 'app-owner-setup-guide',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CreateCompanyModalComponent, AddEmployeeWizardComponent],
  template: `
    @if (guide.visible()) {
      <section class="setup-guide" data-testid="owner-setup-guide" aria-label="Company setup guide">
        @if (guide.finished()) {
          <div class="setup-guide__card">
            <div class="setup-guide__header">
              <h2 class="setup-guide__title">You're all set</h2>
              <button
                type="button"
                class="setup-guide__icon-button"
                data-testid="setup-guide-close"
                aria-label="Close setup guide"
                (click)="guide.dismissFinished()"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <p class="setup-guide__subtitle">
              Your company is set up and your employee profile is ready.
            </p>
          </div>
        } @else if (expanded()) {
          <div class="setup-guide__card">
            <div class="setup-guide__header">
              <h2 class="setup-guide__title">Set up your company</h2>
              <button
                type="button"
                class="setup-guide__icon-button"
                data-testid="setup-guide-fold"
                aria-label="Fold setup guide"
                (click)="expanded.set(false)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </button>
            </div>
            <p class="setup-guide__subtitle">{{ guide.doneCount() }} of {{ total }} done</p>
            <div
              class="setup-guide__progress"
              role="progressbar"
              aria-label="Setup progress"
              [attr.aria-valuenow]="guide.doneCount()"
              aria-valuemin="0"
              [attr.aria-valuemax]="total"
            >
              <div class="setup-guide__progress-fill" [style.width.%]="progressPercent()"></div>
            </div>
            <ol class="setup-guide__steps">
              @for (step of guide.steps(); track step.key) {
                <li
                  class="setup-guide__step"
                  data-testid="setup-step"
                  [attr.data-state]="step.state"
                  [class.setup-guide__step--current]="step.state === 'current'"
                >
                  <span class="setup-guide__step-icon" aria-hidden="true">
                    @switch (step.state) {
                      @case ('done') {
                        <svg viewBox="0 0 24 24" class="setup-guide__done">
                          <circle cx="12" cy="12" r="10" />
                          <path d="m9 12 2 2 4-4" />
                        </svg>
                      }
                      @case ('current') {
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                      }
                      @default {
                        <svg viewBox="0 0 24 24">
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                      }
                    }
                  </span>
                  <span
                    class="setup-guide__step-label"
                    [class.setup-guide__step-label--done]="step.state === 'done'"
                  >
                    {{ step.label }}
                    @if (step.state === 'done') {
                      <span class="sr-only">(done)</span>
                    } @else if (step.state === 'locked') {
                      <span class="sr-only">(after the step before)</span>
                    }
                  </span>
                  @if (step.state === 'current' && canDo(step)) {
                    <button
                      type="button"
                      class="setup-guide__go"
                      data-testid="setup-step-go"
                      (click)="go(step)"
                    >
                      Go
                    </button>
                  }
                </li>
              }
            </ol>
            <div class="setup-guide__footer">
              <button
                type="button"
                class="setup-guide__skip"
                data-testid="setup-guide-skip"
                (click)="guide.skip()"
              >
                Skip for now
              </button>
            </div>
          </div>
        } @else {
          <button
            type="button"
            class="setup-guide__pill"
            data-testid="setup-guide-pill"
            aria-label="Open setup guide"
            (click)="expanded.set(true)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" />
            </svg>
            Setup {{ guide.doneCount() }}/{{ total }}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>
          </button>
        }
      </section>
    }
    @if (companyFormOpen()) {
      <app-create-company-modal
        [availableParents]="companies.companies()"
        [saving]="companies.saving()"
        (save)="onCreateCompany($event)"
        (cancelled)="companyFormOpen.set(false)"
      />
    }
    @if (wizardOpen() && prefill(); as identity) {
      <app-add-employee-wizard
        [isModal]="true"
        [selfPrefill]="identity"
        (closed)="wizardOpen.set(false)"
        (saved)="onSelfSaved($event)"
      />
    }
  `,
  styles: [
    `
      .setup-guide {
        position: fixed;
        right: 1.5rem;
        bottom: calc(1.5rem + var(--bottom-tray-offset, 0px));
        z-index: 1040;
      }
      .setup-guide__card {
        width: 18rem;
        max-width: calc(100vw - 2rem);
        padding: 0.875rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: 12px;
        background: var(--color-surface);
        box-shadow: var(--shadow-popover);
      }
      .setup-guide__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .setup-guide__title {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .setup-guide__subtitle {
        margin: 0.125rem 0 0.5rem;
        font-size: 0.75rem;
        color: var(--color-text-secondary);
      }
      .setup-guide__progress {
        height: 4px;
        border-radius: 9999px;
        background: var(--color-surface-secondary);
        overflow: hidden;
      }
      .setup-guide__progress-fill {
        height: 100%;
        border-radius: 9999px;
        background: var(--color-success);
        transition: width 200ms ease;
      }
      .setup-guide__steps {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        margin: 0.75rem 0 0;
        padding: 0;
        list-style: none;
      }
      .setup-guide__step {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-height: 2rem;
        padding: 0.25rem 0.5rem;
        border-radius: 8px;
        font-size: 0.8125rem;
        color: var(--color-text-muted);
      }
      .setup-guide__step--current {
        background: var(--color-surface-secondary);
        color: var(--color-text-primary);
      }
      .setup-guide__step[data-state='done'] {
        color: var(--color-text-secondary);
      }
      .setup-guide__step-icon {
        display: inline-flex;
        flex-shrink: 0;
      }
      .setup-guide__step-label {
        flex: 1;
        min-width: 0;
      }
      .setup-guide__step-label--done {
        text-decoration: line-through;
      }
      .setup-guide svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .setup-guide__done {
        color: var(--color-success);
      }
      .setup-guide__go {
        padding: 0.125rem 0.625rem;
        border: 1px solid var(--color-border-strong);
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text-primary);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
      }
      .setup-guide__go:hover {
        border-color: var(--color-accent);
        color: var(--color-accent);
      }
      .setup-guide__footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.5rem;
      }
      .setup-guide__skip,
      .setup-guide__icon-button {
        padding: 0.25rem;
        border: 0;
        border-radius: 6px;
        background: none;
        color: var(--color-text-secondary);
        font-size: 0.75rem;
        cursor: pointer;
      }
      .setup-guide__skip:hover,
      .setup-guide__icon-button:hover {
        color: var(--color-text-primary);
      }
      .setup-guide__icon-button {
        display: inline-flex;
      }
      .setup-guide__pill {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0.375rem 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 9999px;
        background: var(--color-surface);
        box-shadow: var(--shadow-popover);
        color: var(--color-text-primary);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
      }
      .setup-guide button:focus-visible {
        outline: 2px solid var(--color-focus-ring);
        outline-offset: 2px;
      }
      @media (max-width: 768px) {
        .setup-guide {
          right: 0.75rem;
          /* Above the mobile bottom nav and the drafts pill that floats over it. */
          bottom: calc(7.5rem + var(--bottom-tray-offset, 0px));
        }
      }
    `,
  ],
})
export class OwnerSetupGuideComponent {
  protected readonly guide = inject(OwnerSetupGuideService);
  protected readonly companies = inject(LegalEntityStore);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStore);
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationService);

  protected readonly total = 4;
  protected readonly expanded = signal(true);
  protected readonly companyFormOpen = signal(false);
  protected readonly wizardOpen = signal(false);

  protected readonly progressPercent = computed(() =>
    Math.round((this.guide.doneCount() / this.total) * 100),
  );

  protected readonly prefill = computed<SelfPrefill | null>(() => {
    const status = this.guide.status();
    return status
      ? { firstName: status.first_name, lastName: status.last_name, workEmail: status.work_email }
      : null;
  });

  constructor() {
    effect(() => {
      if (this.guide.eligible()) untracked(() => void this.guide.refresh());
    });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.refreshIfOpen());

    const timer = setInterval(() => void this.refreshIfOpen(), REFRESH_INTERVAL_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected canDo(step: SetupStep): boolean {
    return step.key !== 'legal-entity' || this.permissions.hasPermission('legal_entity:create');
  }

  protected go(step: SetupStep): void {
    if (step.key === 'legal-entity') {
      this.companyFormOpen.set(true);
      return;
    }
    if (step.key === 'add-yourself') {
      this.wizardOpen.set(true);
      return;
    }
    const route = STEP_ROUTES[step.key];
    if (route) void this.router.navigate([route]);
  }

  protected async onCreateCompany(payload: CreateLegalEntityRequest): Promise<void> {
    if (await this.companies.createCompany(payload)) {
      this.notifications.success(`Company '${payload.name}' created.`);
      this.companyFormOpen.set(false);
      await this.guide.refresh();
    } else {
      this.notifications.error(this.companies.createError() ?? 'Failed to create company.');
    }
  }

  protected async onSelfSaved(event: { finalized: boolean; self?: boolean }): Promise<void> {
    if (!event.finalized || !event.self) return;
    this.wizardOpen.set(false);
    this.guide.markFinished();
    await this.auth.checkSession();
  }

  private async refreshIfOpen(): Promise<void> {
    if (this.guide.visible() && !this.guide.finished()) await this.guide.refresh();
  }
}
