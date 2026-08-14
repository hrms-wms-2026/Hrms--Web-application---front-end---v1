import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ChecklistTemplateDetailResponse } from '../../models/checklist-template.model';
import { ChecklistTemplateStore } from '../../state/checklist-template.store';
import { ChecklistBuilderComponent } from './checklist-builder.component';

describe('ChecklistBuilderComponent', () => {
  let component: ChecklistBuilderComponent;
  let fixture: ComponentFixture<ChecklistBuilderComponent>;
  let legalEntityStore: InstanceType<typeof LegalEntityStore>;
  let checklistStore: InstanceType<typeof ChecklistTemplateStore>;
  let permissionService: PermissionService;
  let router: Router;
  let httpMock: HttpTestingController;

  const mockCompany = {
    id: 'legal-1',
    code: 'CMP1',
    companyCode: 'CMP1',
    name: 'Test Company',
    tradingName: null,
    registrationNumber: null,
    taxIdentifier: null,
    countryCode: 'US',
    currencyCode: 'USD',
    timeZone: 'UTC',
    isPrimary: true,
    isActive: true,
    logoFileId: null
  };

  const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 25 };
  const assigneePositionPage = {
    items: [{ id: 'pos-hr', name: 'HR Manager', departmentId: 'dept-hr' }],
    totalCount: 1,
    page: 1,
    pageSize: 25
  };

  function flushInitialRequests(): void {
    const deptReq = httpMock.match((r) => r.url.includes('/departments'));
    deptReq.forEach((req) => req.flush(emptyPage));

    const assigneePosReq = httpMock.match(
      (r) => r.url.includes('/positions') && !r.url.includes('departmentId')
    );
    assigneePosReq.forEach((req) => req.flush(assigneePositionPage));

    const scopePosReq = httpMock.match(
      (r) => r.url.includes('/positions') && r.url.includes('departmentId')
    );
    scopePosReq.forEach((req) => req.flush(emptyPage));
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ChecklistBuilderComponent],
      providers: [
        PermissionService,
        LegalEntityStore,
        ChecklistTemplateStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => null } },
            paramMap: of({ get: (key: string) => null })
          }
        }
      ]
    }).compileComponents();

    legalEntityStore = TestBed.inject(LegalEntityStore);
    checklistStore = TestBed.inject(ChecklistTemplateStore);
    permissionService = TestBed.inject(PermissionService);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);

    vi.spyOn(legalEntityStore, 'selectedLegalEntity').mockReturnValue(mockCompany);
    vi.spyOn(permissionService, 'hasPermission').mockReturnValue(true);

    fixture = TestBed.createComponent(ChecklistBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    flushInitialRequests();

    await Promise.resolve();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify({ ignoreCancelled: true });
  });

  it('creates form with default task assigned to Employee using due after days = 0', () => {
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.templateType.value).toBe('onboarding');
    expect(component.scopeLevel()).toBe('company');

    expect(component.tasksArray.length).toBe(1);
    const task = component.tasksArray.at(0).value;
    expect(task.assignmentType).toBe('employee');
    expect(task.dueOffsetDays).toBe(0);
    expect(task.isRequired).toBe(true);
  });

  it('renders Assigned to, Employee, and Company position labels', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Assigned to');
    expect(text).toContain('Employee');
    expect(text).toContain('Company position');

    const assignedSelect = fixture.nativeElement.querySelector('.cb-assigned-field__select') as HTMLSelectElement;
    expect(assignedSelect).not.toBeNull();
    expect(Array.from(assignedSelect.options).map((o) => o.text)).toEqual(['Employee', 'Company position']);
  });

  it('does NOT render forbidden bad labels anywhere in the builder UI', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Due Offset');
    expect(text).not.toContain('relative due offset');
    expect(text).not.toContain('Days relative to start date');
    expect(text).not.toContain('Responsible party');
    expect(text).not.toContain('New employee');
    expect(text).not.toContain('Existing employee');
    expect(text).not.toContain('Someone else');
    expect(text).not.toContain('Scope level');
    expect(text).not.toContain('All employees in this company');
    expect(text).not.toContain('Due after');
    expect(text).not.toContain('days from employee start date');
    expect(text).not.toContain('days after start date');
    expect(text).not.toContain('Required tasks must be completed before onboarding/offboarding is finished.');
    expect(text).not.toContain('Another person');
    expect(text).not.toContain('Selecting a person by position is not available yet.');
  });

  it('renders required HR-facing builder labels and compact task-list structure', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Checklist details');
    expect(text).toContain('Use this checklist for');
    expect(text).toContain('Tasks');
    expect(text).toContain('Company default');
    expect(text).toContain('Department');
    expect(text).toContain('Position');

    const taskList = fixture.nativeElement.querySelector('.cb-task-list');
    expect(taskList).not.toBeNull();

    const header = fixture.nativeElement.querySelector('.cb-task-list__header');
    expect(header?.textContent).toContain('Task');
    expect(header?.textContent).toContain('Assigned to');
    expect(header?.textContent).toContain('Due');
    expect(header?.textContent).toContain('Actions');
    expect(header?.textContent).not.toContain('Required');

    const rows = fixture.nativeElement.querySelectorAll('.cb-task-row');
    expect(rows.length).toBe(1);
    expect(rows[0].querySelector('.cb-due-field__suffix')).toBeNull();
    expect(rows[0].querySelector('.cb-required-toggle')).toBeNull();
  });

  it('shows assignee position dropdown when Company position is selected', () => {
    component.onAssignmentTypeChange(0, 'company_position');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cb-assigned-field__select--position')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Assignee position');
  });

  it('requires assignee position when Company position is selected', () => {
    component.form.patchValue({ name: 'Position Task Checklist', templateType: 'onboarding' });
    component.onAssignmentTypeChange(0, 'company_position');
    component.tasksArray.at(0).patchValue({ title: 'HR review' });

    component.onSubmit();
    fixture.detectChanges();

    expect(component.tasksArray.at(0).get('assigneePositionId')?.invalid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Assignee position is required.');
  });

  it('"Company default" scope emits departmentId: null, positionId: null', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.form.patchValue({
      name: 'Default Onboarding Checklist',
      templateType: 'onboarding'
    });
    component.setScopeLevel('company');

    component.tasksArray.at(0).patchValue({
      title: 'Collect signed contract',
      dueOffsetDays: 0,
      isRequired: true
    });

    const submitPromise = component.onSubmit();
    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url === `${environment.apiUrl}/people/checklist-templates`);
    expect(req.request.body.departmentId).toBeNull();
    expect(req.request.body.positionId).toBeNull();
    req.flush({ id: 'tmpl-101', ...req.request.body, isActive: true });

    await submitPromise;
    expect(navigateSpy).toHaveBeenCalledWith(['/people/checklists']);
  });

  it('"Department" scope requires department and emits departmentId', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.form.patchValue({
      name: 'Engineering Checklist',
      templateType: 'onboarding'
    });
    component.setScopeLevel('department');

    component.onSubmit();
    expect(component.form.invalid).toBe(true);

    component.form.patchValue({ departmentId: 'dept-99' });
    component.tasksArray.at(0).patchValue({ title: 'Prepare laptop' });

    const submitPromise = component.onSubmit();
    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url === `${environment.apiUrl}/people/checklist-templates`);
    expect(req.request.body.departmentId).toBe('dept-99');
    expect(req.request.body.positionId).toBeNull();
    req.flush({ id: 'tmpl-102', ...req.request.body, isActive: true });

    await submitPromise;
    expect(navigateSpy).toHaveBeenCalledWith(['/people/checklists']);
  });

  it('"Position" scope requires department and position and emits both', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.form.patchValue({
      name: 'DevOps Lead Checklist',
      templateType: 'onboarding'
    });
    component.setScopeLevel('position');
    component.form.patchValue({ departmentId: 'dept-99', positionId: 'pos-88' });
    component.tasksArray.at(0).patchValue({ title: 'Review infrastructure access' });

    const submitPromise = component.onSubmit();
    const req = httpMock.expectOne((r) => r.method === 'POST' && r.url === `${environment.apiUrl}/people/checklist-templates`);
    expect(req.request.body.departmentId).toBe('dept-99');
    expect(req.request.body.positionId).toBe('pos-88');
    req.flush({ id: 'tmpl-103', ...req.request.body, isActive: true });

    await submitPromise;
    expect(navigateSpy).toHaveBeenCalledWith(['/people/checklists']);
  });

  it('maps employee assignment to backend employee payload fields', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.form.patchValue({
      name: 'Employee Assignment Checklist',
      templateType: 'onboarding'
    });
    component.setScopeLevel('company');
    component.tasksArray.at(0).patchValue({
      title: 'Collect signed contract',
      assignmentType: 'employee',
      dueOffsetDays: 0,
      isRequired: true
    });

    const submitPromise = component.onSubmit();
    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${environment.apiUrl}/people/checklist-templates`
    );

    expect(req.request.body.tasks[0]).toEqual({
      title: 'Collect signed contract',
      ownerType: 'employee',
      assignedToId: null,
      assigneePositionId: null,
      dueOffsetDays: 0,
      sequence: 1,
      isRequired: true
    });

    req.flush({ id: 'tmpl-104', ...req.request.body, isActive: true });
    await submitPromise;
  });

  it('maps company position assignment to backend-supported assigneePositionId payload', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.form.patchValue({
      name: 'Position Assignment Checklist',
      templateType: 'onboarding'
    });
    component.setScopeLevel('company');
    component.tasksArray.at(0).patchValue({
      title: 'HR policy review',
      assignmentType: 'company_position',
      assigneePositionId: 'pos-hr',
      dueOffsetDays: 2,
      isRequired: true
    });

    const submitPromise = component.onSubmit();
    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${environment.apiUrl}/people/checklist-templates`
    );

    expect(req.request.body.tasks[0]).toEqual({
      title: 'HR policy review',
      ownerType: 'custom_user',
      assignedToId: null,
      assigneePositionId: 'pos-hr',
      dueOffsetDays: 2,
      sequence: 1,
      isRequired: true
    });

    req.flush({ id: 'tmpl-105', ...req.request.body, isActive: true });
    await submitPromise;
  });

  it('validates due input: 0 and positive whole numbers are valid, negative/decimals are invalid', () => {
    component.form.patchValue({ name: 'Due Test Checklist' });
    const task = component.tasksArray.at(0);

    task.patchValue({ title: 'Task 1', dueOffsetDays: -1 });
    component.onSubmit();
    expect(task.get('dueOffsetDays')?.invalid).toBe(true);

    task.patchValue({ dueOffsetDays: 2.5 });
    component.onSubmit();
    expect(task.get('dueOffsetDays')?.invalid).toBe(true);

    task.patchValue({ dueOffsetDays: 0 });
    expect(task.get('dueOffsetDays')?.valid).toBe(true);

    task.patchValue({ dueOffsetDays: 7 });
    expect(task.get('dueOffsetDays')?.valid).toBe(true);
  });

  it('emits dueOffsetDays: 0 in create payload when due is zero', async () => {
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.form.patchValue({ name: 'Zero Due Checklist', templateType: 'onboarding' });
    component.tasksArray.at(0).patchValue({ title: 'Start day task', dueOffsetDays: 0 });

    const submitPromise = component.onSubmit();
    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${environment.apiUrl}/people/checklist-templates`
    );
    expect(req.request.body.tasks[0].dueOffsetDays).toBe(0);
    req.flush({ id: 'tmpl-zero', ...req.request.body, isActive: true });
    await submitPromise;
  });

  it('supports task addition, removal, and reordering with correct button disabled states', () => {
    expect(component.tasksArray.length).toBe(1);

    component.addTask({ title: 'Task 2' });
    component.addTask({ title: 'Task 3' });
    expect(component.tasksArray.length).toBe(3);

    component.tasksArray.at(0).patchValue({ title: 'Task 1' });

    fixture.detectChanges();

    const upButtons = fixture.nativeElement.querySelectorAll('.cb-task-row__actions .cb-icon-btn');
    expect(upButtons[0].disabled).toBe(true);
    expect(upButtons[upButtons.length - 2].disabled).toBe(true);

    component.moveTaskUp(1);
    expect(component.tasksArray.at(0).value.title).toBe('Task 2');
    expect(component.tasksArray.at(1).value.title).toBe('Task 1');

    component.moveTaskDown(0);
    expect(component.tasksArray.at(0).value.title).toBe('Task 1');

    component.removeTask(2);
    expect(component.tasksArray.length).toBe(2);

    component.removeTask(0);
    expect(component.tasksArray.length).toBe(1);
  });

  it('cancel button navigates back to /people/checklists', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.cancel();
    expect(navigateSpy).toHaveBeenCalledWith(['/people/checklists']);
  });

  it('mapTaskFormToRequest documents backend-supported position-only assignee contract', () => {
    const employeePayload = component.mapTaskFormToRequest(
      {
        title: 'Self task',
        assignmentType: 'employee',
        assigneePositionId: '',
        dueOffsetDays: 0,
        isRequired: true
      },
      0
    );
    expect(employeePayload.ownerType).toBe('employee');
    expect(employeePayload.assignedToId).toBeNull();
    expect(employeePayload.assigneePositionId).toBeNull();

    const positionPayload = component.mapTaskFormToRequest(
      {
        title: 'HR task',
        assignmentType: 'company_position',
        assigneePositionId: 'pos-hr',
        dueOffsetDays: 1,
        isRequired: false
      },
      1
    );
    expect(positionPayload.ownerType).toBe('custom_user');
    expect(positionPayload.assignedToId).toBeNull();
    expect(positionPayload.assigneePositionId).toBe('pos-hr');
  });
});

describe('ChecklistBuilderComponent (Edit Mode)', () => {
  let component: ChecklistBuilderComponent;
  let fixture: ComponentFixture<ChecklistBuilderComponent>;
  let checklistStore: InstanceType<typeof ChecklistTemplateStore>;
  let router: Router;
  let httpMock: HttpTestingController;

  const mockCompany = {
    id: 'legal-1',
    code: 'CMP1',
    companyCode: 'CMP1',
    name: 'Test Company',
    tradingName: null,
    registrationNumber: null,
    taxIdentifier: null,
    countryCode: 'US',
    currencyCode: 'USD',
    timeZone: 'UTC',
    isPrimary: true,
    isActive: true,
    logoFileId: null
  };

  const mockDetail: ChecklistTemplateDetailResponse = {
    id: 'tmpl-999',
    name: 'Existing Offboarding Checklist',
    templateType: 'offboarding',
    legalEntityId: 'legal-1',
    departmentId: 'dept-1',
    departmentName: 'HR',
    positionId: null,
    positionName: null,
    isActive: true,
    tasks: [
      {
        title: 'Revoke system access',
        ownerType: 'employee',
        assignedToId: null,
        dueOffsetDays: 1,
        sequence: 1,
        isRequired: true
      }
    ]
  };

  const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 25 };

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ChecklistBuilderComponent],
      providers: [
        PermissionService,
        LegalEntityStore,
        ChecklistTemplateStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'tmpl-999' : null) } },
            paramMap: of({ get: (key: string) => (key === 'id' ? 'tmpl-999' : null) })
          }
        }
      ]
    }).compileComponents();

    checklistStore = TestBed.inject(ChecklistTemplateStore);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);

    vi.spyOn(TestBed.inject(LegalEntityStore), 'selectedLegalEntity').mockReturnValue(mockCompany);
    vi.spyOn(TestBed.inject(PermissionService), 'hasPermission').mockReturnValue(true);

    fixture = TestBed.createComponent(ChecklistBuilderComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify({ ignoreCancelled: true });
  });

  it('loads existing checklist detail in edit mode, populates form, and saves via updateTemplate', async () => {
    fixture.detectChanges();

    const detailReq = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-999`);
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush(mockDetail);

    const deptReq = httpMock.match((r) => r.url.includes('/departments'));
    deptReq.forEach((req) => req.flush(emptyPage));

    await Promise.resolve();
    await Promise.resolve();

    const posReq = httpMock.match((r) => r.url.includes('/positions'));
    posReq.forEach((req) => req.flush(emptyPage));

    await Promise.resolve();
    fixture.detectChanges();

    expect(component.isEdit()).toBe(true);
    expect(component.form.controls.name.value).toBe('Existing Offboarding Checklist');
    expect(component.form.controls.templateType.value).toBe('offboarding');
    expect(component.scopeLevel()).toBe('department');
    expect(component.tasksArray.length).toBe(1);
    expect(component.tasksArray.at(0).value.title).toBe('Revoke system access');
    expect(component.tasksArray.at(0).value.assignmentType).toBe('employee');

    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const updateSpy = vi.spyOn(checklistStore, 'updateTemplate').mockResolvedValue(true);

    await component.onSubmit();

    expect(updateSpy).toHaveBeenCalledWith('tmpl-999', {
      name: 'Existing Offboarding Checklist',
      departmentId: 'dept-1',
      positionId: null,
      tasks: [
        {
          title: 'Revoke system access',
          ownerType: 'employee',
          assignedToId: null,
          assigneePositionId: null,
          dueOffsetDays: 1,
          sequence: 1,
          isRequired: true
        }
      ]
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/people/checklists']);
  });

  it('loads non-employee tasks as Company position assignment in edit mode', async () => {
    const detailWithPositionTask: ChecklistTemplateDetailResponse = {
      ...mockDetail,
      tasks: [
        {
          title: 'Return equipment',
          ownerType: 'custom_user',
          assignedToId: 'user-99',
          dueOffsetDays: 0,
          sequence: 1,
          isRequired: true
        }
      ]
    };

    fixture.detectChanges();

    const detailReq = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-999`);
    detailReq.flush(detailWithPositionTask);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    httpMock.match((r) => r.url.includes('/departments')).forEach((req) => req.flush(emptyPage));
    httpMock.match((r) => r.url.includes('/positions')).forEach((req) => req.flush(emptyPage));
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.tasksArray.at(0).value.assignmentType).toBe('company_position');
  });
});
