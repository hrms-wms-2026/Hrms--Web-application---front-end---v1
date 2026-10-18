import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { StartOffboardingModalComponent } from '../../ui/start-offboarding-modal/start-offboarding-modal.component';
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

  it('lists only employees whose offboarding is still open, not the whole reporting line', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-testid="offboarding-row-emp-2"]')?.textContent).toContain('Grace Hopper');
    expect(compiled.querySelector('[data-testid="offboarding-row-emp-1"]')).toBeNull();
  });

  it('shows totals through the shared KPI tiles', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelectorAll('app-kpi-tiles [data-testid="kpi-tile"]').length).toBe(3);
    expect(compiled.querySelector('[data-testid="kpi-in-progress"]')?.textContent?.trim()).toBe('1');
    expect(compiled.querySelector('[data-testid="kpi-covered"]')?.textContent?.trim()).toBe('2');
  });

  it('shows an empty state when nobody is being offboarded', async () => {
    const { fixture } = await setup(true, { getOffboardingOverview: () => of([overviewItems[0]]) } as Partial<OffboardingApiService>);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('No offboardings in progress');
    expect(compiled.textContent).not.toContain('Ada Lovelace');
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

  it('an in-progress row offers Continue', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-testid="offboarding-row-emp-2"]')?.textContent).toContain('Continue');
  });

  it('Start Offboarding opens a popup on the same page whose picker offers only startable employees', async () => {
    const { fixture, router } = await setup(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[role="dialog"]')).toBeNull();
    fixture.componentInstance.openForm();
    fixture.detectChanges();
    expect(compiled.querySelector('[role="dialog"]')?.textContent).toContain('Start offboarding');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.employeeOptions()).toEqual([{ value: 'emp-1', label: 'Ada Lovelace' }]);
  });

  it('starting from the popup opens that employee\'s offboarding', async () => {
    const { fixture, router, startOffboardingSpy } = await setup(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.openForm();
    fixture.detectChanges();
    const modal = fixture.debugElement.query(By.directive(StartOffboardingModalComponent)).componentInstance as StartOffboardingModalComponent;
    modal.form.patchValue({ employeeId: 'emp-1', lastWorkingDate: '2026-12-01' });
    await modal.submit();
    expect(startOffboardingSpy).toHaveBeenCalledWith('emp-1', expect.objectContaining({ lastWorkingDate: '2026-12-01', reason: 'resignation' }));
    expect(navigateSpy).toHaveBeenCalledWith(['/people/offboarding', 'emp-1']);
    expect(fixture.componentInstance.formOpen()).toBe(false);
  });

  it('viewOffboarding navigates to the wizard route for that employee', async () => {
    const { fixture, router } = await setup(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.viewOffboarding('emp-2');
    expect(navigateSpy).toHaveBeenCalledWith(['/people/offboarding', 'emp-2']);
  });
});
