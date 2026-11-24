import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { AddEmployeeWizardComponent } from '../../../people/feature/add-employee-wizard/add-employee-wizard.component';
import { SelfPrefill } from '../../../people/models/onboarding-draft.model';
import { SelfSetupApiService } from '../../data-access/self-setup-api.service';
import { SelfSetupStatusDto } from '../../models/self-setup-status.model';
import { NoEmployeeProfilePanelComponent } from './no-employee-profile-panel.component';

@Component({ selector: 'app-add-employee-wizard', template: '' })
class WizardStubComponent {
  readonly isModal = input(true);
  readonly selfPrefill = input<SelfPrefill | null>(null);
  readonly closed = output<void>();
  readonly saved = output<{ finalized: boolean; draftId?: string; self?: boolean }>();
}

const ready: SelfSetupStatusDto = {
  has_employee_profile: false, has_legal_entity: true, has_position: true, can_add_self: true,
  first_name: 'Ada', last_name: 'Owner', work_email: 'ada@acme.test'
};

async function setup(status: SelfSetupStatusDto | 'error') {
  const auth = { checkSession: vi.fn().mockResolvedValue(true), authenticated: signal(true), employeeId: signal<string | null>(null) };
  TestBed.configureTestingModule({
    imports: [NoEmployeeProfilePanelComponent],
    providers: [
      { provide: AuthStore, useValue: auth },
      { provide: SelfSetupApiService, useValue: { getStatus: () => (status === 'error' ? throwError(() => new Error('403')) : of(status)) } }
    ]
  });
  TestBed.overrideComponent(NoEmployeeProfilePanelComponent, {
    remove: { imports: [AddEmployeeWizardComponent] },
    add: { imports: [WizardStubComponent] }
  });
  const fixture = TestBed.createComponent(NoEmployeeProfilePanelComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, auth, el: fixture.nativeElement as HTMLElement };
}

describe('NoEmployeeProfilePanelComponent', () => {
  it('offers "Add yourself as an employee" when the company is ready', async () => {
    const { el } = await setup(ready);

    expect(el.textContent).toContain("Your employee profile isn't set up yet");
    expect(el.textContent).toContain('Add yourself as an employee to see your work here.');
    expect(el.querySelector('[data-testid="add-yourself"]')).not.toBeNull();
  });

  it('opens the wizard prefilled with the login name and email', async () => {
    const { fixture, el } = await setup(ready);

    (el.querySelector('[data-testid="add-yourself"] button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const wizard = fixture.debugElement.query((d) => d.componentInstance instanceof WizardStubComponent);
    expect(wizard).not.toBeNull();
    expect((wizard.componentInstance as WizardStubComponent).selfPrefill()).toEqual({ firstName: 'Ada', lastName: 'Owner', workEmail: 'ada@acme.test' });
  });

  it('says what is missing and offers no button when the company is not ready', async () => {
    const { el } = await setup({ ...ready, has_position: false, can_add_self: false });

    expect(el.textContent).toContain('Add a legal entity and a position first.');
    expect(el.querySelector('[data-testid="add-yourself"]')).toBeNull();
  });

  it('shows only the title when the status cannot be loaded', async () => {
    const { el } = await setup('error');

    expect(el.textContent).toContain("Your employee profile isn't set up yet");
    expect(el.querySelector('[data-testid="add-yourself"]')).toBeNull();
    expect(el.textContent).not.toContain('Add a legal entity and a position first.');
  });

  it('re-checks the session and reports the new profile after a self finalize', async () => {
    const { fixture, el, auth } = await setup(ready);
    const created = vi.fn();
    fixture.componentInstance.profileCreated.subscribe(created);
    (el.querySelector('[data-testid="add-yourself"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const wizard = fixture.debugElement.query((d) => d.componentInstance instanceof WizardStubComponent).componentInstance as WizardStubComponent;

    wizard.saved.emit({ finalized: true, draftId: 'd1', self: true });
    await fixture.whenStable();

    expect(auth.checkSession).toHaveBeenCalled();
    expect(created).toHaveBeenCalled();
  });
});
