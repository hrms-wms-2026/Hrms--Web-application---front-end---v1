import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { PermissionService } from '../../../core/auth/state/permission.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  OwnerSetupGuideService,
  SetupStep,
} from '../../../modules/dashboard/state/owner-setup-guide.service';
import { LegalEntityStore } from '../../../modules/organization/state/legal-entity.store';
import { CreateCompanyModalComponent } from '../../../modules/organization/ui/create-company-modal/create-company-modal.component';
import { AddEmployeeWizardComponent } from '../../../modules/people/feature/add-employee-wizard/add-employee-wizard.component';
import { SelfPrefill } from '../../../modules/people/models/onboarding-draft.model';
import { OwnerSetupGuideComponent } from './owner-setup-guide.component';

@Component({ selector: 'app-add-employee-wizard', template: '' })
class WizardStubComponent {
  readonly isModal = input(true);
  readonly selfPrefill = input<SelfPrefill | null>(null);
  readonly closed = output<void>();
  readonly saved = output<{ finalized: boolean; draftId?: string; self?: boolean }>();
}

@Component({ selector: 'app-create-company-modal', template: '' })
class CompanyModalStubComponent {
  @Input() availableParents: readonly { id: string; name: string }[] = [];
  @Input() saving = false;
  @Output() save = new EventEmitter<unknown>();
  @Output() cancelled = new EventEmitter<void>();
}

const ORDER: SetupStep['key'][] = ['legal-entity', 'department', 'position', 'add-yourself'];
const LABELS = [
  'Create your legal entity',
  'Add a department',
  'Add a position',
  'Add yourself as an employee',
];

function stepsWithDone(done: number): SetupStep[] {
  return ORDER.map((key, i) => ({
    key,
    label: LABELS[i],
    state: i < done ? 'done' : i === done ? 'current' : 'locked',
  }));
}

function setup(opts: { done?: number; finished?: boolean } = {}) {
  const steps = signal(stepsWithDone(opts.done ?? 0));
  const guide = {
    visible: signal(true),
    finished: signal(opts.finished ?? false),
    eligible: signal(true),
    steps,
    doneCount: computed(() => steps().filter((s) => s.state === 'done').length),
    status: signal({ first_name: 'Ada', last_name: 'Owner', work_email: 'ada@acme.test' }),
    refresh: vi.fn().mockResolvedValue(undefined),
    skip: vi.fn(),
    markFinished: vi.fn(),
    dismissFinished: vi.fn(),
  };
  const router = { navigate: vi.fn().mockResolvedValue(true), events: new Subject<unknown>() };
  const auth = { checkSession: vi.fn().mockResolvedValue(true) };
  const companies = {
    createCompany: vi.fn().mockResolvedValue(true),
    saving: signal(false),
    companies: signal([]),
    createError: signal(null),
  };
  TestBed.configureTestingModule({
    imports: [OwnerSetupGuideComponent],
    providers: [
      { provide: OwnerSetupGuideService, useValue: guide },
      { provide: Router, useValue: router },
      { provide: AuthStore, useValue: auth },
      { provide: PermissionService, useValue: { hasPermission: () => true } },
      { provide: LegalEntityStore, useValue: companies },
      { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(OwnerSetupGuideComponent, {
    remove: { imports: [AddEmployeeWizardComponent, CreateCompanyModalComponent] },
    add: { imports: [WizardStubComponent, CompanyModalStubComponent] },
  });
  const fixture = TestBed.createComponent(OwnerSetupGuideComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const goButton = () =>
    el.querySelector('[data-testid="setup-step-go"]') as HTMLButtonElement | null;
  return { fixture, el, guide, router, auth, companies, goButton };
}

describe('OwnerSetupGuideComponent', () => {
  it('shows the four steps in order with progress', () => {
    const { el } = setup({ done: 2 });

    const labels = [...el.querySelectorAll('[data-testid="setup-step"]')].map((s) =>
      s.textContent?.trim(),
    );
    expect(labels.map((l) => LABELS.find((label) => l?.includes(label)))).toEqual(LABELS);
    expect(el.textContent).toContain('Set up your company');
    expect(el.textContent).toContain('2 of 4 done');
  });

  it('offers Go only on the current step', () => {
    const { el } = setup({ done: 1 });

    expect(el.querySelectorAll('[data-testid="setup-step-go"]').length).toBe(1);
    const current = el.querySelector('[data-state="current"]') as HTMLElement;
    expect(current.textContent).toContain('Add a department');
    expect(current.querySelector('[data-testid="setup-step-go"]')).not.toBeNull();
  });

  it('opens Departments for the department step and Positions for the position step', () => {
    const first = setup({ done: 1 });
    first.goButton()!.click();
    expect(first.router.navigate).toHaveBeenCalledWith(['/organization/departments']);

    TestBed.resetTestingModule();
    const second = setup({ done: 2 });
    second.goButton()!.click();
    expect(second.router.navigate).toHaveBeenCalledWith(['/organization/positions']);
  });

  it('opens the create company form for the legal entity step and re-checks after creating', async () => {
    const { fixture, goButton, companies, guide } = setup({ done: 0 });

    goButton()!.click();
    fixture.detectChanges();
    const modal = fixture.debugElement.query(
      (d) => d.componentInstance instanceof CompanyModalStubComponent,
    );
    expect(modal).not.toBeNull();

    (modal.componentInstance as CompanyModalStubComponent).save.emit({ name: 'Unicom' });
    await fixture.whenStable();

    expect(companies.createCompany).toHaveBeenCalled();
    expect(guide.refresh).toHaveBeenCalled();
  });

  it('opens the prefilled wizard for the last step and shows "all set" after a self finalize', async () => {
    const { fixture, goButton, guide, auth } = setup({ done: 3 });

    goButton()!.click();
    fixture.detectChanges();
    const wizard = fixture.debugElement.query(
      (d) => d.componentInstance instanceof WizardStubComponent,
    ).componentInstance as WizardStubComponent;
    expect(wizard.selfPrefill()).toEqual({
      firstName: 'Ada',
      lastName: 'Owner',
      workEmail: 'ada@acme.test',
    });

    wizard.saved.emit({ finalized: true, draftId: 'd1', self: true });
    await fixture.whenStable();

    expect(auth.checkSession).toHaveBeenCalled();
    expect(guide.markFinished).toHaveBeenCalled();
  });

  it('folds into a small pill and opens again', () => {
    const { fixture, el } = setup({ done: 2 });

    (el.querySelector('[data-testid="setup-guide-fold"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="setup-step"]')).toBeNull();
    const pill = el.querySelector('[data-testid="setup-guide-pill"]') as HTMLButtonElement;
    expect(pill.textContent).toContain('Setup 2/4');

    pill.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('[data-testid="setup-step"]').length).toBe(4);
  });

  it('skips for now', () => {
    const { el, guide } = setup();

    (el.querySelector('[data-testid="setup-guide-skip"]') as HTMLButtonElement).click();

    expect(guide.skip).toHaveBeenCalled();
  });

  it('shows "You\'re all set" once finished and closes it', () => {
    const { el, guide } = setup({ done: 4, finished: true });

    expect(el.textContent).toContain("You're all set");
    expect(el.querySelector('[data-testid="setup-step"]')).toBeNull();

    (el.querySelector('[data-testid="setup-guide-close"]') as HTMLButtonElement).click();

    expect(guide.dismissFinished).toHaveBeenCalled();
  });

  it('renders nothing when the guide is not for this account', () => {
    const { fixture, el, guide } = setup();
    guide.visible.set(false);
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="owner-setup-guide"]')).toBeNull();
  });
});
