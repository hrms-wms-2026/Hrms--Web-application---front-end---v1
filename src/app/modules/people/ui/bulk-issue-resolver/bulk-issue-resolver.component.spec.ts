import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { ChecklistApiService } from '../../data-access/checklist-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkIssueResolverComponent } from './bulk-issue-resolver.component';

describe('BulkIssueResolverComponent', () => {
  let fixture: ComponentFixture<BulkIssueResolverComponent>;
  let component: BulkIssueResolverComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BulkIssueResolverComponent],
      providers: [
        {
          provide: DepartmentApiService,
          useValue: {
            listFlat: vi.fn().mockReturnValue(
              of({ items: [{ id: 'dept-1', name: 'People', code: 'PEO' }], totalCount: 1, page: 1, pageSize: 100 })
            )
          }
        },
        {
          provide: PositionApiService,
          useValue: {
            listFlat: vi.fn().mockReturnValue(
              of({
                items: [
                  {
                    id: 'pos-full',
                    name: 'Project Manager',
                    code: 'PM',
                    maxOccupancy: 1,
                    assignedCount: 1,
                    departmentName: 'Engineering',
                    departmentId: 'dept-1',
                    legalEntityId: 'le-1',
                    positionType: 'unique',
                    reportsToPositionId: null,
                    isActive: true,
                    createdAt: '',
                    updatedAt: null
                  },
                  {
                    id: 'pos-open',
                    name: 'Engineer',
                    code: 'ENG',
                    maxOccupancy: 3,
                    assignedCount: 0,
                    departmentName: 'Engineering',
                    departmentId: 'dept-1',
                    legalEntityId: 'le-1',
                    positionType: 'pooled',
                    reportsToPositionId: null,
                    isActive: true,
                    createdAt: '',
                    updatedAt: null
                  }
                ],
                totalCount: 2,
                page: 1,
                pageSize: 100,
                totalPages: 1
              })
            )
          }
        },
        {
          provide: ChecklistApiService,
          useValue: { getOnboardingMatches: vi.fn().mockReturnValue(of([{ id: 't1', name: 'Onboarding' }])) }
        },
        {
          provide: PeopleApiService,
          useValue: {
            getActiveHolders: vi.fn().mockReturnValue(
              of([{ employeeId: 'e1', firstName: 'Ada', lastName: 'Lovelace', workEmail: 'ada@x.com', avatarFileId: null }])
            )
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BulkIssueResolverComponent);
    component = fixture.componentInstance;
  });

  it('position choose existing displays names and vacancy labels', async () => {
    fixture.componentRef.setInput('legalEntityId', 'le-1');
    fixture.componentRef.setInput('canManageOrg', true);
    fixture.componentRef.setInput('action', 'map_existing');
    fixture.componentRef.setInput('workModeOptions', []);
    fixture.componentRef.setInput('issue', {
      issueKey: 'position_not_found:PM',
      issueType: 'position_not_found',
      field: 'position',
      importedValue: 'PM',
      affectedRowNumbers: [1],
      affectedRowCount: 1,
      suggestions: [],
      allowedActions: ['map_existing'],
      context: { positionId: null, positionName: null, departmentId: 'dept-1', departmentName: 'Engineering', maxOccupancy: null, currentPrimaryAssignments: null, availableSeats: null, requiredSeatsInBatch: null, canIncreaseCapacity: false }
    });
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await (component as unknown as { bootstrap(): Promise<void> }).bootstrap();
    fixture.detectChanges();

    const labels = component.selectorOptions().map((o) => o.label);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.some((l) => l.includes('Project Manager') && l.includes('No vacancy'))).toBe(true);
    expect(labels.some((l) => l.includes('Engineer') && l.includes('seats available'))).toBe(true);
  });

  it('create position validates code max 5 and capacity >= 1', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('legalEntityId', 'le-1');
    fixture.componentRef.setInput('canManageOrg', true);
    fixture.componentRef.setInput('action', 'create_position');
    fixture.componentRef.setInput('workModeOptions', []);
    fixture.componentRef.setInput('issue', {
      issueKey: 'position_not_found:Lead',
      issueType: 'position_not_found',
      field: 'position',
      importedValue: 'Lead',
      affectedRowNumbers: [1],
      affectedRowCount: 1,
      suggestions: [],
      allowedActions: ['create_position'],
      context: null
    });
    fixture.detectChanges();

    component.createDepartmentId.set('dept-1');
    component.createName.set('Lead');
    component.createCode.set('TOOLONG');
    component.createCapacity.set('0');
    component.selectedRowNumbers.set([1]);
    expect(component.canSubmit()).toBe(false);

    component.createCode.set('LEAD');
    component.createCapacity.set('2');
    expect(component.canSubmit()).toBe(true);
  });

  it('emits map_existing payload with selected rows', () => {
    const applySpy = vi.fn();
    component.apply.subscribe(applySpy);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('legalEntityId', 'le-1');
    fixture.componentRef.setInput('action', 'map_existing');
    fixture.componentRef.setInput('workModeOptions', [{ value: '1', label: 'Hybrid' }]);
    fixture.componentRef.setInput('issue', {
      issueKey: 'work_mode_not_found:Hybrd',
      issueType: 'work_mode_not_found',
      field: 'workMode',
      importedValue: 'Hybrd',
      affectedRowNumbers: [1, 2],
      affectedRowCount: 2,
      suggestions: [],
      allowedActions: ['map_existing']
    });
    fixture.detectChanges();
    component.selectedTargetId.set('1');
    component.selectedRowNumbers.set([1]);
    component.onSubmit();
    expect(applySpy).toHaveBeenCalledWith({
      issueKey: 'work_mode_not_found:Hybrd',
      action: 'map_existing',
      targetId: '1',
      applyToRowNumbers: [1]
    });
  });

  it('reporting manager choose emits edit with employee email', async () => {
    const applySpy = vi.fn();
    component.apply.subscribe(applySpy);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('legalEntityId', 'le-1');
    fixture.componentRef.setInput('action', 'choose_manager');
    fixture.componentRef.setInput('workModeOptions', []);
    fixture.componentRef.setInput('issue', {
      issueKey: 'reporting_manager_required',
      issueType: 'reporting_manager_required',
      field: 'reportingManager',
      importedValue: null,
      affectedRowNumbers: [3],
      affectedRowCount: 1,
      suggestions: [],
      allowedActions: ['edit_imported_value'],
      context: {
        positionId: 'mgr-pos',
        positionName: null,
        departmentId: null,
        departmentName: null,
        maxOccupancy: null,
        currentPrimaryAssignments: null,
        availableSeats: null,
        requiredSeatsInBatch: null,
        canIncreaseCapacity: false
      }
    });
    fixture.detectChanges();
    await fixture.whenStable();
    component.selectedManagerEmail.set('ada@x.com');
    component.selectedRowNumbers.set([3]);
    component.onSubmit();
    expect(applySpy).toHaveBeenCalledWith({
      issueKey: 'reporting_manager_required',
      action: 'edit_imported_value',
      newValue: 'ada@x.com',
      applyToRowNumbers: [3]
    });
  });
});
