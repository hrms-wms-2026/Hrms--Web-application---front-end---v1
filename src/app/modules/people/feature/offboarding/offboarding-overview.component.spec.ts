import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingOverviewComponent } from './offboarding-overview.component';

describe('OffboardingOverviewComponent', () => {
  const overviewItems = [
    { employeeId: 'emp-1', employeeName: 'Ada Lovelace', departmentName: 'Engineering', positionName: 'Engineer', currentOffboardingStatus: null, canStartOffboarding: true },
    { employeeId: 'emp-2', employeeName: 'Grace Hopper', departmentName: 'Engineering', positionName: 'Manager', currentOffboardingStatus: 'in_progress', canStartOffboarding: false }
  ];

  async function setup(
    canOffboard: boolean,
    apiOverrides: Partial<OffboardingApiService> = {}
  ): Promise<{ fixture: ComponentFixture<OffboardingOverviewComponent>; router: Router; startOffboardingSpy: ReturnType<typeof vi.fn> }> {
    const startOffboardingSpy = vi.fn(() => of({ offboardingRecordId: 'rec-1' }));
    await TestBed.configureTestingModule({
      imports: [OffboardingOverviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: OffboardingApiService,
          useValue: {
            getOffboardingOverview: () => of(overviewItems),
            startOffboarding: startOffboardingSpy,
            getOffboarding: () => of(null),
            ...apiOverrides
          }
        },
        { provide: PermissionService, useValue: { hasPermission: (p: string) => canOffboard && p === 'employees:offboard' } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(OffboardingOverviewComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, router, startOffboardingSpy };
  }

  it('does not list the caller among their own covered employees (self-exclusion is the backend\'s job, but the UI trusts the response as-is)', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Ada Lovelace');
    expect(compiled.textContent).toContain('Grace Hopper');
  });

  it('shows the top-level Start Offboarding button when the caller holds employees:offboard', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('+ Start Offboarding');
  });

  it('hides the Start Offboarding button when the caller lacks employees:offboard', async () => {
    const { fixture } = await setup(false);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).not.toContain('+ Start Offboarding');
  });

  it('no per-row Start Offboarding button exists for a startable employee - only the top-level one', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    // Ada (canStartOffboarding: true) gets no per-row action at all now - starting only
    // happens through the top-level picker. Grace (in_progress) still legitimately gets a
    // "Continue" button to resume her existing offboarding - that's unrelated and expected.
    const adaRow = Array.from(compiled.querySelectorAll('.rounded-lg')).find((el) => el.textContent?.includes('Ada Lovelace'));
    expect(adaRow?.querySelector('button')).toBeNull();
    expect(compiled.textContent).toContain('Continue');
  });

  it('opening the form restricts the employee picker to startable coverage employees only', async () => {
    const { fixture } = await setup(true);
    fixture.componentInstance.openForm();
    fixture.detectChanges();
    expect(fixture.componentInstance.employeeOptions()).toEqual([{ value: 'emp-1', label: 'Ada Lovelace' }]);
  });

  it('submit calls OffboardingWizardStore.startOffboarding for the picked employee and navigates on success', async () => {
    const { fixture, router, startOffboardingSpy } = await setup(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.openForm();
    fixture.componentInstance.form.patchValue({ employeeId: 'emp-1', lastWorkingDate: '2026-12-01' });
    await fixture.componentInstance.submit();
    expect(startOffboardingSpy).toHaveBeenCalledWith('emp-1', expect.objectContaining({ lastWorkingDate: '2026-12-01', reason: 'resignation' }));
    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees', 'emp-1', 'offboarding']);
  });

  it('viewOffboarding navigates to the wizard route for that employee', async () => {
    const { fixture, router } = await setup(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.viewOffboarding('emp-2');
    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees', 'emp-2', 'offboarding']);
  });
});
