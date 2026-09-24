import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ChecklistApiService } from '../../data-access/checklist-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkOnboardingStore } from '../../state/bulk-onboarding.store';
import { BulkOnboardingComponent } from './bulk-onboarding.component';

describe('BulkOnboardingComponent', () => {
  let fixture: ComponentFixture<BulkOnboardingComponent>;
  let storeMock: Partial<InstanceType<typeof BulkOnboardingStore>>;
  let permissionHas: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    permissionHas = vi.fn().mockReturnValue(true);
    storeMock = {
      batch: vi.fn().mockReturnValue(null) as any,
      mapping: vi.fn().mockReturnValue({}) as any,
      preview: vi.fn().mockReturnValue(null) as any,
      loading: vi.fn().mockReturnValue(false) as any,
      error: vi.fn().mockReturnValue(null) as any,
      upload: vi.fn(),
      updateMapping: vi.fn(),
      reset: vi.fn(),
      toggleRowSelection: vi.fn(),
      finalizeSelected: vi.fn(),
      createDrafts: vi.fn(),
      validate: vi.fn(),
      validationResult: vi.fn().mockReturnValue(null) as any,
      detail: vi.fn().mockReturnValue(null) as any,
      selectedDraftIds: vi.fn().mockReturnValue([]) as any,
      polling: vi.fn().mockReturnValue(false) as any,
      resolveIssue: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [BulkOnboardingComponent],
      providers: [
        provideRouter([]),
        { provide: BulkOnboardingStore, useValue: storeMock },
        {
          provide: LegalEntityStore,
          useValue: {
            companies: () => [],
            selectedLegalEntity: () => ({ id: 'le-1', name: 'Acme Co' }),
            loadCompanies: vi.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: PeopleApiService,
          useValue: {
            getWorkModes: () => of([{ id: '1', label: 'Hybrid' }]),
            getActiveHolders: () => of([])
          }
        },
        {
          provide: PermissionService,
          useValue: { hasPermission: permissionHas, hasAnyPermission: () => true }
        },
        {
          provide: DepartmentApiService,
          useValue: {
            listFlat: () => of({ items: [{ id: 'dept-1', name: 'HR', code: 'HR' }], totalCount: 1, page: 1, pageSize: 100 })
          }
        },
        {
          provide: PositionApiService,
          useValue: {
            listFlat: () =>
              of({
                items: [
                  {
                    id: 'pos-1',
                    name: 'Project Manager',
                    code: 'PM',
                    maxOccupancy: 1,
                    assignedCount: 1,
                    departmentName: 'Engineering',
                    legalEntityId: 'le-1',
                    departmentId: 'dept-1',
                    positionType: 'unique',
                    reportsToPositionId: null,
                    isActive: true,
                    createdAt: '',
                    updatedAt: null
                  }
                ],
                totalCount: 1,
                page: 1,
                pageSize: 100,
                totalPages: 1
              })
          }
        },
        {
          provide: ChecklistApiService,
          useValue: { getOnboardingMatches: () => of([{ id: 'tmpl-1', name: 'Default onboarding' }]) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BulkOnboardingComponent);
  });

  function goToValidateWithIssues(issues: unknown[], rows: unknown[] = []): void {
    (storeMock.validationResult as any) = vi.fn().mockReturnValue({
      validRows: 0,
      invalidRows: rows.length || 1,
      totalRows: rows.length || 1,
      issues,
      rows:
        rows.length > 0
          ? rows
          : [{ rowNumber: 1, status: 'invalid', errorMessage: 'x', errors: [] }]
    });
    (storeMock.batch as any).mockReturnValue({
      id: 'batch-1',
      status: 'validated',
      totalRows: 1,
      validRows: 0,
      invalidRows: 1,
      detectedColumns: [],
      suggestedMapping: {}
    });
    fixture.componentInstance.goToStep('validate');
    fixture.detectChanges();
  }

  it('starts on the upload step', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.currentStep()).toBe('upload');
  });

  it('does not call window.prompt or window.alert for issue actions', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('x');
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const issue = {
      issueKey: 'department_not_found:Sales',
      issueType: 'department_not_found',
      field: 'department',
      importedValue: 'Sales',
      affectedRowNumbers: [1],
      affectedRowCount: 1,
      suggestions: [],
      allowedActions: ['map_existing', 'edit_imported_value', 'create_department']
    };
    goToValidateWithIssues([issue]);

    fixture.componentInstance.onChooseExisting(issue as any);
    fixture.componentInstance.onEditImportedValue(issue as any);
    fixture.componentInstance.onCreateDepartment(issue as any);
    fixture.componentInstance.onSetDefault({
      ...issue,
      issueType: 'work_mode_missing',
      field: 'workMode',
      allowedActions: ['set_default']
    } as any);

    expect(promptSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.resolverOpen()).toBe(true);
    promptSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('department choose existing opens in-app resolver', () => {
    const issue = {
      issueKey: 'department_not_found:Sales',
      issueType: 'department_not_found',
      field: 'department',
      importedValue: 'Sales',
      affectedRowNumbers: [1, 2],
      affectedRowCount: 2,
      suggestions: [],
      allowedActions: ['map_existing', 'edit_imported_value', 'create_department']
    };
    goToValidateWithIssues([issue]);
    fixture.componentInstance.onChooseExisting(issue as any);
    expect(fixture.componentInstance.resolverAction()).toBe('map_existing');
    expect(fixture.componentInstance.resolverOpen()).toBe(true);
  });

  it('department correct spelling opens in-app input action', () => {
    const issue = {
      issueKey: 'department_not_found:Sales',
      issueType: 'department_not_found',
      field: 'department',
      importedValue: 'Sales',
      affectedRowNumbers: [1],
      affectedRowCount: 1,
      suggestions: [],
      allowedActions: ['edit_imported_value']
    };
    goToValidateWithIssues([issue]);
    fixture.componentInstance.onEditImportedValue(issue as any);
    expect(fixture.componentInstance.resolverAction()).toBe('edit_imported_value');
  });

  it('create department respects org:manage via allowedActions', () => {
    goToValidateWithIssues([
      {
        issueKey: 'department_not_found:Sales',
        issueType: 'department_not_found',
        field: 'department',
        importedValue: 'Sales',
        affectedRowNumbers: [1],
        affectedRowCount: 1,
        suggestions: [],
        allowedActions: ['map_existing', 'edit_imported_value']
      }
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Create department');
  });

  it('work mode selector options use labels not numeric ids in the UI actions', async () => {
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();
    const options = fixture.componentInstance.workModeOptions();
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].label).toBe('Hybrid');
    expect(options[0].label).not.toMatch(/^[0-9]+$/);
    expect(options[0].value).toBe('1');
  });

  it('capacity conflict issue displays available and needed seat counts', () => {
    goToValidateWithIssues([
      {
        issueKey: 'position_capacity_exceeded:Project Manager',
        issueType: 'position_capacity_exceeded',
        field: 'position',
        importedValue: 'Project Manager',
        affectedRowNumbers: [1, 2, 3, 4],
        affectedRowCount: 4,
        suggestions: [],
        allowedActions: ['map_existing', 'create_position', 'increase_capacity'],
        context: {
          positionId: 'pos-1',
          positionName: 'Project Manager',
          departmentId: 'dept-1',
          departmentName: 'Engineering',
          maxOccupancy: 2,
          currentPrimaryAssignments: 1,
          availableSeats: 1,
          requiredSeatsInBatch: 4,
          canIncreaseCapacity: true
        }
      }
    ]);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Not enough seats');
    expect(text).toContain('1 seat available');
    expect(text).toContain('4 needed');
    expect(text).toContain('Resolve capacity');
    expect(text).toContain('Increase capacity');
  });

  it('reporting manager issue opens employee selector action', () => {
    const issue = {
      issueKey: 'reporting_manager_required',
      issueType: 'reporting_manager_required',
      field: 'reportingManager',
      importedValue: null,
      affectedRowNumbers: [2],
      affectedRowCount: 1,
      suggestions: [],
      allowedActions: ['edit_imported_value'],
      context: { positionId: 'mgr-pos', positionName: null, departmentId: null, departmentName: null, maxOccupancy: null, currentPrimaryAssignments: null, availableSeats: null, requiredSeatsInBatch: null, canIncreaseCapacity: false }
    };
    goToValidateWithIssues([issue]);
    fixture.componentInstance.onEditImportedValue(issue as any);
    expect(fixture.componentInstance.resolverAction()).toBe('choose_manager');
  });

  it('resolve issue calls backend with correct payload and refreshes validation', async () => {
    const resolveIssue = vi.fn().mockResolvedValue(true);
    (storeMock as any).resolveIssue = resolveIssue;
    goToValidateWithIssues([]);
    await fixture.componentInstance.onResolverApply({
      issueKey: 'department_not_found:Sales',
      action: 'map_existing',
      targetId: 'dept-1',
      applyToRowNumbers: [1, 2]
    });
    expect(resolveIssue).toHaveBeenCalledWith({
      issueKey: 'department_not_found:Sales',
      action: 'map_existing',
      targetId: 'dept-1',
      applyToRowNumbers: [1, 2]
    });
    expect(fixture.componentInstance.resolverOpen()).toBe(false);
  });

  it('validate step shows grouped issues and friendly row messages', () => {
    goToValidateWithIssues(
      [
        {
          issueKey: 'department_not_found:Human Resorces',
          issueType: 'department_not_found',
          field: 'department',
          importedValue: 'Human Resorces',
          affectedRowNumbers: [2],
          affectedRowCount: 1,
          suggestions: [{ id: 'dept-1', label: 'Human Resources', confidence: 'high' }],
          allowedActions: ['map_existing', 'edit_imported_value', 'create_department']
        }
      ],
      [
        { rowNumber: 1, status: 'valid', errorMessage: null, errors: [] },
        {
          rowNumber: 2,
          status: 'invalid',
          errorMessage: "Department 'Human Resorces' was not found.",
          errors: [{ code: 'department_not_found', field: 'department', message: 'x', importedValue: 'Human Resorces' }]
        }
      ]
    );

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Department not found');
    expect(text).toContain('Human Resources');
    expect(text).toContain('Use Human Resources');
    expect(text).toContain('Create department');
    expect(text).toContain('This department could not be matched');
    expect(text).not.toContain('department_not_found');
  });

  it('use suggested match calls store.resolveIssue', async () => {
    const resolveIssue = vi.fn().mockResolvedValue(true);
    (storeMock as any).resolveIssue = resolveIssue;
    const issue = {
      issueKey: 'department_not_found:Human Resorces',
      issueType: 'department_not_found',
      field: 'department',
      importedValue: 'Human Resorces',
      affectedRowNumbers: [2, 5],
      affectedRowCount: 2,
      suggestions: [{ id: 'dept-1', label: 'Human Resources', confidence: 'high' }],
      allowedActions: ['map_existing'] as const
    };
    await fixture.componentInstance.onUseSuggestedMatch(issue as any);
    expect(resolveIssue).toHaveBeenCalledWith({
      issueKey: 'department_not_found:Human Resorces',
      action: 'map_existing',
      targetId: 'dept-1',
      applyToRowNumbers: [2, 5]
    });
  });
});
