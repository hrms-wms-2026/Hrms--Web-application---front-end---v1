import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingOverviewComponent } from './offboarding-overview.component';

describe('OffboardingOverviewComponent', () => {
  async function setup(canOffboard: boolean): Promise<{ fixture: ComponentFixture<OffboardingOverviewComponent>; router: Router }> {
    await TestBed.configureTestingModule({
      imports: [OffboardingOverviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: OffboardingApiService,
          useValue: {
            getOffboardingOverview: () => of([
              { employeeId: 'emp-1', employeeName: 'Ada Lovelace', departmentName: 'Engineering', positionName: 'Engineer', currentOffboardingStatus: null, canStartOffboarding: true }
            ])
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
    return { fixture, router };
  }

  it('shows Start Offboarding when the caller holds employees:offboard', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Start Offboarding');
  });

  it('hides Start Offboarding when the caller lacks employees:offboard', async () => {
    const { fixture } = await setup(false);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).not.toContain('Start Offboarding');
  });

  it('startOffboarding navigates to the wizard route for that employee', async () => {
    const { fixture, router } = await setup(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.startOffboarding('emp-1');
    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees', 'emp-1', 'offboarding']);
  });
});
