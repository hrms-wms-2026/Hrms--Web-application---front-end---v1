import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PermissionService } from '../../../../../core/auth/state/permission.service';
import { WorkModeStore } from '../../../../settings/state/work-mode.store';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';
import { EmployeeEmploymentTabComponent } from './employee-employment-tab.component';
import { detailFixture, setupTabTestBed } from './employee-detail-tab.testing';

describe('EmployeeEmploymentTabComponent', () => {
  // EmployeeJobInfoComponent injects the root WorkModeStore, which would otherwise pull in
  // WorkModeApiService -> HttpClient.
  const workModeStoreStub = {
    items: signal([]), atCap: signal(false), loading: signal(false), saving: signal(false), error: signal(null),
    load: vi.fn(), create: vi.fn(), update: vi.fn(), deactivate: vi.fn()
  };

  async function render(
    apiOverrides: Record<string, unknown> = {},
    { canWrite = true, offboardingStatus = null as string | null } = {}
  ) {
    const apiStub: Record<string, ReturnType<typeof vi.fn>> = {
      getEmployeeDetail: vi.fn().mockReturnValue(of(detailFixture)),
      getJobJourney: vi.fn().mockReturnValue(of([])),
      ...apiOverrides
    };
    const notificationsStub = { success: vi.fn(), error: vi.fn() };
    const store = await setupTabTestBed(detailFixture.id, apiStub, notificationsStub, [
      { provide: WorkModeStore, useValue: workModeStoreStub },
      { provide: PermissionService, useValue: { hasPermission: (p: string) => (p === 'employees:write' ? canWrite : true) } },
      { provide: OffboardingWizardStore, useValue: { record: signal(offboardingStatus ? { status: offboardingStatus } : null) } }
    ]);
    const fixture = TestBed.createComponent(EmployeeEmploymentTabComponent);
    fixture.detectChanges();
    return { fixture, store, apiStub, notificationsStub };
  }

  it('renders job information, employment record and the job journey', async () => {
    const { fixture } = await render();

    expect(fixture.nativeElement.querySelector('app-employee-job-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-job-journey')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Employment Record');
  });

  it('allows editing only with employees:write and before offboarding completes', async () => {
    expect((await render()).fixture.componentInstance.canEdit()).toBe(true);
    TestBed.resetTestingModule();
    expect((await render({}, { canWrite: false })).fixture.componentInstance.canEdit()).toBe(false);
    TestBed.resetTestingModule();
    expect((await render({}, { offboardingStatus: 'completed' })).fixture.componentInstance.canEdit()).toBe(false);
  });

  it('reloads and shows a success toast when job details are saved', async () => {
    const { store, apiStub, notificationsStub } = await render({ updateJobDetails: vi.fn().mockReturnValue(of(undefined)) });

    await store.saveJobDetails({ employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: 'wm-2' });

    expect(apiStub['updateJobDetails']).toHaveBeenCalledWith('emp-1', {
      employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: 'wm-2'
    });
    expect(store.savingJobDetails()).toBe(false);
    expect(notificationsStub.success).toHaveBeenCalledWith('Job details updated.');
    expect(apiStub['getEmployeeDetail']).toHaveBeenCalledTimes(2);
  });

  it('surfaces an error toast and stops the saving state when the job details save fails', async () => {
    const { store, apiStub, notificationsStub } = await render({
      updateJobDetails: vi.fn().mockReturnValue(throwError(() => new Error('boom')))
    });

    await store.saveJobDetails({ employeeNumber: 'E-002', employmentTypeCode: 'part_time', workModeId: null });

    expect(store.savingJobDetails()).toBe(false);
    expect(notificationsStub.error).toHaveBeenCalledWith('boom');
    expect(apiStub['getEmployeeDetail']).toHaveBeenCalledTimes(1);
  });
});
