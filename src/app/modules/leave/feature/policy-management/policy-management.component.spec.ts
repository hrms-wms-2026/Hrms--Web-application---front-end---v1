import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LegalEntityApiService } from '../../../organization/data-access/legal-entity-api.service';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeavePolicyStore } from '../../state/leave-policy.store';
import { PolicyManagementComponent } from './policy-management.component';

describe('PolicyManagementComponent', () => {
  const departmentList = vi.fn(() => of({ items: [{ id: 'd1', name: 'Sales' }] }));
  function setup() {
    const policy = {
      items: signal([]), selectedPolicy: signal(null), loading: signal(false), loadError: signal(null),
      saving: signal(false), actionError: signal(null), conflicts: signal([]),
      loadPolicies: vi.fn(async () => {}), loadPolicy: vi.fn(async () => {}), create: vi.fn(async () => 'saved'),
      saveEdit: vi.fn(async () => 'saved'), deleteVersion: vi.fn(async () => 'saved'), setActive: vi.fn(async () => 'saved'),
      clone: vi.fn(async () => 'saved'), clearConflicts: vi.fn()
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionService, useValue: { hasPermission: () => true } },
        { provide: NotificationService, useValue: { error: vi.fn(), success: vi.fn() } },
        { provide: LegalEntityApiService, useValue: { getLegalEntities: () => of([{ id: 'le1', name: 'Dapi Technologies' }]) } },
        { provide: DepartmentApiService, useValue: { listFlat: departmentList } },
        { provide: PositionApiService, useValue: { listFlat: () => of({ items: [{ id: 'p1', name: 'Developer' }] }) } },
        { provide: LeavePolicyStore, useValue: policy },
        { provide: LeaveTypeStore, useValue: { items: signal([]), load: async () => {} } }
      ]
    });
    const fixture = TestBed.createComponent(PolicyManagementComponent);
    fixture.detectChanges();
    return { fixture, policy };
  }

  it('loads companies, departments and positions for the wizard', async () => {
    const { fixture } = setup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.componentInstance.legalEntities()).toEqual([{ id: 'le1', name: 'Dapi Technologies' }]);
    expect(fixture.componentInstance.departmentOptions()).toEqual([{ value: 'd1', label: 'Sales' }]);
    expect(fixture.componentInstance.positionOptions()).toEqual([{ value: 'p1', label: 'Developer' }]);
    // The org list endpoints reject page sizes above 100.
    expect(departmentList).toHaveBeenCalledWith('le1', { page: 1, pageSize: 100 });
  });

  it('closes the wizard without saving when an edit changed nothing', async () => {
    const { fixture, policy } = setup();
    fixture.componentInstance.openEdit();
    await fixture.componentInstance.onSaveEdit({ policyId: 'p1', edit: { details: null, version: null, assignments: null, replaceConflicts: false } });
    expect(policy.saveEdit).not.toHaveBeenCalled();
    expect(fixture.componentInstance.wizardMode()).toBeNull();
  });

  it('keeps the wizard open when the save needs conflict confirmation', async () => {
    const { fixture, policy } = setup();
    policy.create.mockResolvedValueOnce('conflicts');
    fixture.componentInstance.openCreate();
    await fixture.componentInstance.onCreate({ leaveTypeId: 't', name: 'x', description: null, rules: {} as never, assignments: [], replaceConflicts: false });
    expect(fixture.componentInstance.wizardMode()).toBe('create');
  });
});
