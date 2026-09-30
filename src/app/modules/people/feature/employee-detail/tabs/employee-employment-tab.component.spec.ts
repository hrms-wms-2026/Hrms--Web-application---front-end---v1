import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PermissionService } from '../../../../../core/auth/state/permission.service';
import { WorkModeStore } from '../../../../settings/state/work-mode.store';
import { EmployeeDetailResponse } from '../../../models/employee.model';
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
    { canWrite = true, offboardingStatus = null as string | null, employee = detailFixture as EmployeeDetailResponse } = {}
  ) {
    const apiStub: Record<string, ReturnType<typeof vi.fn>> = {
      getEmployeeDetail: vi.fn().mockReturnValue(of(employee)),
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
    expect(fixture.nativeElement.textContent).toContain('Employment History');
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

  it('shows work arrangement time zone and probation status', async () => {
    const { fixture } = await render({}, {
      employee: {
        ...detailFixture,
        jobInformation: { ...detailFixture.jobInformation, timezone: 'Asia/Colombo', probationEndDate: '2024-05-01' }
      }
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="employment-timezone"]')?.textContent).toContain('Asia/Colombo');
    expect(root.querySelector('[data-testid="probation-status"]')?.textContent).toContain('Completed');
    expect(root.textContent).toContain('Probation ends');
  });

  it('lists shared project memberships, and says so when there are none', async () => {
    const withProjects = await render({}, {
      employee: {
        ...detailFixture,
        projectMemberships: [
          { projectId: 'p1', projectName: 'Watercraft Platform', memberSince: '2025-08-15T00:00:00Z', isActive: true },
          { projectId: 'p2', projectName: 'Legacy Portal', memberSince: '2024-02-01T00:00:00Z', isActive: false }
        ]
      }
    });
    const rows = Array.from(withProjects.fixture.nativeElement.querySelectorAll('[data-testid="project-membership-row"]')) as HTMLElement[];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Watercraft Platform.*Active/),
      expect.stringMatching(/Legacy Portal.*Removed/)
    ]);

    TestBed.resetTestingModule();
    const empty = await render();
    expect(empty.fixture.nativeElement.querySelector('[data-testid="no-shared-projects"]')).toBeTruthy();
  });

  it('opens the job details form from "Edit details" and hides the read-only rows', async () => {
    const { fixture } = await render();
    const root = fixture.nativeElement as HTMLElement;

    (root.querySelector('[data-testid="edit-employment-details"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isEditing()).toBe(true);
    expect(root.querySelector('form')).toBeTruthy();
    expect(root.querySelector('[data-testid="edit-employment-details"]')).toBeNull();
  });

  it('closes the form after a successful save', async () => {
    const { fixture } = await render({ updateJobDetails: vi.fn().mockReturnValue(of(undefined)) });
    fixture.componentInstance.startEdit();
    fixture.detectChanges();

    await fixture.componentInstance.onJobDetailsSave({ employeeNumber: 'E-001', employmentTypeCode: 'full_time', workModeId: null });
    fixture.detectChanges();

    expect(fixture.componentInstance.isEditing()).toBe(false);
  });

  it('hides "Edit details" without employees:write', async () => {
    const { fixture } = await render({}, { canWrite: false });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-employment-details"]')).toBeNull();
  });
});
