import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
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
    // Asserting length === 1 (not just flushing whatever matched) is the actual
    // regression check for "no duplicate list API calls" — the constructor effect()
    // reading selectedCompany() is the thing that can double-fire these.
    const deptReq = httpMock.match((r) => r.url.includes('/departments'));
    expect(deptReq.length).toBe(1);
    deptReq.forEach((req) => req.flush(emptyPage));

    const assigneePosReq = httpMock.match(
      (r) => r.url.includes('/positions') && !r.url.includes('departmentId')
    );
    expect(assigneePosReq.length).toBe(1);
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
        provideRouter([{ path: 'people/checklists', component: ChecklistBuilderComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => null } },
            paramMap: of({ get: () => null })
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

  it('creates form with default unassigned task using due after days = 0', () => {
    expect(component.form.controls.name.value).toBe('');
    expect(component.form.controls.templateType.value).toBe('onboarding');
    expect(component.scopeLevel()).toBe('company');

    expect(component.tasksArray.length).toBe(1);
    const task = component.tasksArray.at(0).value;
    expect(task.assignmentType).toBe('unassigned');
    expect(task.dueOffsetDays).toBe(0);
    expect(task.isRequired).toBe(true);
  });

  it('renders Assigned to and + Assign in the default row state', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Assigned to');
    expect(text).toContain('+ Assign');
  });

  it('does NOT render forbidden bad labels anywhere in the builder UI', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Due Offset');
    expect(text).not.toContain('relative due offset');
    expect(text).not.toContain('Days relative to start date');
    expect(text).not.toContain('Responsible party');
    expect(text).not.toContain('Someone else');
    expect(text).not.toContain('Scope level');
    expect(text).not.toContain('All employees in this company');
    expect(text).not.toContain('Due after');
    expect(text).not.toContain('days from employee start date');
    expect(text).not.toContain('days after start date');
    expect(text).not.toContain('Required tasks must be completed before onboarding/offboarding is finished.');
    expect(text).not.toContain('Selecting a person by position is not available yet.');
    expect(text).toContain('+ Assign');
  });

  it('renders required HR-facing builder labels and compact task-list structure', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Checklist details');
    expect(text).toContain('Create checklist');
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

  it('shows pill controls for existing-employee assignment when position flow is chosen', async () => {
    await component.chooseExistingEmployee(0);
    fixture.detectChanges();

    // The picker renders in the CDK overlay container (outside the fixture) so it isn't clipped.
    expect(document.querySelector('.cdk-overlay-container')?.textContent).toContain('Select position');
  });

  it('allows an optional employee picker in the template builder after position selection', async () => {
    await component.chooseExistingEmployee(0);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('+ Choose employee');
  });

  it('requires assignee position when Company position is selected', () => {
    component.form.patchValue({ name: 'Position Task Checklist', templateType: 'onboarding' });
    component.onAssignmentTypeChange(0, 'company_position');
    component.tasksArray.at(0).patchValue({ title: 'HR review' });

    component.onSubmit();
    fixture.detectChanges();

    expect(component.tasksArray.at(0).get('assigneePositionId')?.invalid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Choose who this task is for.');
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
      assignmentType: 'employee',
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
    component.tasksArray.at(0).patchValue({ assignmentType: 'employee' });

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
    component.tasksArray.at(0).patchValue({ title: 'Review infrastructure access', assignmentType: 'employee' });

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
      isRequired: true,
      isBypassable: false,
      bypassPenaltyDescription: null,
      category: null,
      description: null,
      priority: 'medium',
      attachmentFileIds: []
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
      isRequired: true,
      isBypassable: false,
      bypassPenaltyDescription: null,
      category: null,
      description: null,
      priority: 'medium',
      attachmentFileIds: []
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
    component.tasksArray.at(0).patchValue({ title: 'Start day task', dueOffsetDays: 0, assignmentType: 'employee' });

    const submitPromise = component.onSubmit();
    const req = httpMock.expectOne(
      (r) => r.method === 'POST' && r.url === `${environment.apiUrl}/people/checklist-templates`
    );
    expect(req.request.body.tasks[0].dueOffsetDays).toBe(0);
    req.flush({ id: 'tmpl-zero', ...req.request.body, isActive: true });
    await submitPromise;
  });

  it('supports task addition, removal, and drag reordering, with a details button per row', () => {
    expect(component.tasksArray.length).toBe(1);

    component.addTask({ title: 'Task 2' });
    component.addTask({ title: 'Task 3' });
    expect(component.tasksArray.length).toBe(3);

    component.tasksArray.at(0).patchValue({ title: 'Task 1' });

    fixture.detectChanges();

    const rowButtons = fixture.nativeElement.querySelectorAll('.cb-task-row__actions .cb-icon-btn');
    expect(rowButtons.length).toBe(6);
    expect(fixture.nativeElement.querySelector('[aria-label="Move task up"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.cb-icon-btn--details').length).toBe(3);

    component.onDropTask({ previousIndex: 1, currentIndex: 0 } as CdkDragDrop<unknown>);
    expect(component.tasksArray.at(0).value.title).toBe('Task 2');
    expect(component.tasksArray.at(1).value.title).toBe('Task 1');

    component.onDropTask({ previousIndex: 0, currentIndex: 1 } as CdkDragDrop<unknown>);
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
        selectedAssigneeUserId: '',
        dueOffsetDays: 0,
        isRequired: true,
        isBypassable: false,
        bypassPenaltyDescription: '',
        category: ''
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
        selectedAssigneeUserId: '',
        dueOffsetDays: 1,
        isRequired: false,
        isBypassable: false,
        bypassPenaltyDescription: '',
        category: ''
      },
      1
    );
    expect(positionPayload.ownerType).toBe('custom_user');
    expect(positionPayload.assignedToId).toBeNull();
    expect(positionPayload.assigneePositionId).toBe('pos-hr');
  });

  it('shows bypass/penalty/category fields only for offboarding templates', () => {
    component.form.controls.templateType.setValue('onboarding');
    fixture.detectChanges();
    let compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('[data-testid="task-0-bypassable"]')).toBeNull();

    component.form.controls.templateType.setValue('offboarding');
    fixture.detectChanges();
    compiled = fixture.nativeElement;
    expect(compiled.querySelector('[data-testid="task-0-bypassable"]')).not.toBeNull();
  });

  it('mapTaskFormToRequest carries isBypassable/bypassPenaltyDescription/category through', () => {
    component.form.controls.templateType.setValue('offboarding');
    const value = {
      title: 'Return laptop', assignmentType: 'employee' as const, assigneePositionId: '',
      selectedAssigneeUserId: '',
      dueOffsetDays: 1, isRequired: true, isBypassable: true, bypassPenaltyDescription: 'Deduct from settlement', category: 'asset_return' as const
    };
    const request = component.mapTaskFormToRequest(value, 0);
    expect(request.isBypassable).toBe(true);
    expect(request.bypassPenaltyDescription).toBe('Deduct from settlement');
    expect(request.category).toBe('asset_return');
  });

  it('mapTaskFormToRequest sends description, priority and attachment ids from task details', () => {
    const request = component.mapTaskFormToRequest(
      {
        title: 'Return laptop', assignmentType: 'employee', assigneePositionId: '', selectedAssigneeUserId: '',
        dueOffsetDays: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: '', category: '',
        description: '<p>Bring the charger</p>', priority: 'high',
        attachments: [{ fileId: 'file-1', name: 'policy.pdf', sizeBytes: 10 }], pendingFileIds: ['file-1']
      },
      0
    );
    expect(request.description).toBe('<p>Bring the charger</p>');
    expect(request.priority).toBe('high');
    expect(request.attachmentFileIds).toEqual(['file-1']);
  });

  it('opens the task details popup from the row details button', () => {
    component.tasksArray.at(0).patchValue({ title: 'Collect contract' });
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="task-0-details"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.openTaskDetailIndex()).toBe(0);
    expect(document.querySelector('.ctd')).not.toBeNull();
    expect((document.querySelector('.ctd-title-input') as HTMLInputElement).value).toBe('Collect contract');

    component.closeTaskDetail();
    fixture.detectChanges();
    expect(document.querySelector('.ctd')).toBeNull();
  });

  it('keeps the builder open when Escape is pressed while task details are open', () => {
    const closedSpy = vi.fn();
    component.closed.subscribe(closedSpy);
    component.openTaskDetail(0);
    fixture.detectChanges();

    const detailsButton = fixture.nativeElement.querySelector('[data-testid="task-0-details"]') as HTMLButtonElement;
    detailsButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    component.onBackdrop();
    fixture.detectChanges();

    expect(closedSpy).not.toHaveBeenCalled();
    expect(component.openTaskDetailIndex()).toBe(0);

    (document.querySelector('.ctd') as HTMLElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(component.openTaskDetailIndex()).toBeNull();
    expect(closedSpy).not.toHaveBeenCalled();
  });

  it('adds a new task row when Enter is pressed on the last row with a non-empty title', () => {
    expect(component.tasksArray.length).toBe(1);
    component.tasksArray.at(0).get('title')?.setValue('First Task');
    
    component.onTaskTitleEnter(0);
    expect(component.tasksArray.length).toBe(2);
  });

  it('does not add a new task row when Enter is pressed on a row with an empty title', () => {
    expect(component.tasksArray.length).toBe(1);
    component.tasksArray.at(0).get('title')?.setValue('   ');
    
    component.onTaskTitleEnter(0);
    expect(component.tasksArray.length).toBe(1);
  });

  it('renders relative due caption for start date and offset days', () => {
    fixture.detectChanges();
    const caption = fixture.nativeElement.querySelector('.cb-due-caption');
    expect(caption).not.toBeNull();
    expect(caption?.textContent?.trim()).toBe('Start date');

    component.tasksArray.at(0).get('dueOffsetDays')?.setValue(3);
    component['cdr'].markForCheck();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.cb-due-caption')?.textContent?.trim()).toBe('+3d');
  });

  it('renders drag handles for reordering on task rows', () => {
    fixture.detectChanges();
    const handle = fixture.nativeElement.querySelector('.cb-task-row__drag-handle');
    expect(handle).not.toBeNull();
    expect(handle?.getAttribute('title')).toBe('Drag to reorder');
  });

  it('reorders tasks via onDropTask', () => {
    component.tasksArray.clear();
    component.addTask({ title: 'Task A' });
    component.addTask({ title: 'Task B' });
    component.addTask({ title: 'Task C' });
    expect(component.tasksArray.length).toBe(3);

    // Reorder task from index 0 to index 2
    component.onDropTask({ previousIndex: 0, currentIndex: 2 } as any);
    expect(component.tasksArray.at(0).get('title')?.value).toBe('Task B');
    expect(component.tasksArray.at(1).get('title')?.value).toBe('Task C');
    expect(component.tasksArray.at(2).get('title')?.value).toBe('Task A');

    // No-op when dropped at same position
    component.onDropTask({ previousIndex: 1, currentIndex: 1 } as any);
    expect(component.tasksArray.at(0).get('title')?.value).toBe('Task B');
    expect(component.tasksArray.at(1).get('title')?.value).toBe('Task C');
    expect(component.tasksArray.at(2).get('title')?.value).toBe('Task A');
  });

  it('dispatches warning toast when submitting without checklist name', async () => {
    const notifyService = TestBed.inject(NotificationService);
    const warnSpy = vi.spyOn(notifyService, 'warning');

    component.form.patchValue({ name: '' });
    await component.onSubmit();

    expect(warnSpy).toHaveBeenCalledWith('Please enter a checklist name.');
  });

  it('dispatches warning toast when submitting with zero tasks', async () => {
    const notifyService = TestBed.inject(NotificationService);
    const warnSpy = vi.spyOn(notifyService, 'warning');

    component.form.patchValue({ name: 'Valid Name' });
    component.tasksArray.clear();
    await component.onSubmit();

    expect(warnSpy).toHaveBeenCalledWith('Please add at least one task to the checklist.');
  });

  it('dispatches success toast when creating checklist template successfully', async () => {
    const notifyService = TestBed.inject(NotificationService);
    const successSpy = vi.spyOn(notifyService, 'success');
    vi.spyOn(checklistStore, 'createTemplate').mockResolvedValue(true);

    component.form.patchValue({ name: 'Valid Onboarding Checklist' });
    component.tasksArray.clear();
    component.addTask({ title: 'Task 1', ownerType: 'employee' });

    await component.onSubmit();

    expect(successSpy).toHaveBeenCalledWith('Checklist created successfully.');
  });

  it('dispatches info toast when attempting to delete the only task', () => {
    const notifyService = TestBed.inject(NotificationService);
    const infoSpy = vi.spyOn(notifyService, 'info');

    component.tasksArray.clear();
    component.addTask({ title: 'Only Task' });
    expect(component.tasksArray.length).toBe(1);

    component.removeTask(0);
    expect(component.tasksArray.length).toBe(1);
    expect(infoSpy).toHaveBeenCalledWith('A checklist must have at least one task.');
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
        isRequired: true,
        isBypassable: false,
        bypassPenaltyDescription: null,
        category: null
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
        provideRouter([{ path: 'people/checklists', component: ChecklistBuilderComponent }]),
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
          isRequired: true,
          isBypassable: false,
          bypassPenaltyDescription: null,
          category: null,
          description: null,
          priority: 'medium',
          attachmentFileIds: []
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
          isRequired: true,
          isBypassable: false,
          bypassPenaltyDescription: null,
          category: null
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
    // The backend never returns the original assigneePositionId (it resolves to a
    // concrete user at save time), so the "Assignee position" dropdown legitimately
    // starts unselected — this is not a validation gap, see the round-trip test below.
    expect(component.tasksArray.at(0).value.assigneePositionId).toBe('');
    expect(component.tasksArray.at(0).value.originalAssignedToId).toBe('user-99');
  });

  it('re-saves an untouched Company position task without forcing re-selection (edit round trip)', async () => {
    const detailWithPositionTask: ChecklistTemplateDetailResponse = {
      ...mockDetail,
      tasks: [
        {
          title: 'Return equipment',
          ownerType: 'custom_user',
          assignedToId: 'user-99',
          dueOffsetDays: 0,
          sequence: 1,
          isRequired: true,
          isBypassable: false,
          bypassPenaltyDescription: null,
          category: null
        }
      ]
    };

    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-999`).flush(detailWithPositionTask);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.match((r) => r.url.includes('/departments')).forEach((req) => req.flush(emptyPage));
    httpMock.match((r) => r.url.includes('/positions')).forEach((req) => req.flush(emptyPage));
    await Promise.resolve();
    fixture.detectChanges();

    // HR opens the template and saves without touching the assignee at all.
    expect(component.tasksArray.at(0).get('assigneePositionId')?.invalid).toBe(false);

    const updateSpy = vi.spyOn(checklistStore, 'updateTemplate').mockResolvedValue(true);
    await component.onSubmit();

    expect(component.tasksArray.at(0).get('assigneePositionId')?.invalid).toBe(false);
    expect(updateSpy).toHaveBeenCalledWith(
      'tmpl-999',
      expect.objectContaining({
        tasks: [
          expect.objectContaining({
            ownerType: 'custom_user',
            assignedToId: 'user-99',
            assigneePositionId: null
          })
        ]
      })
    );
  });

  it('re-picking a position for a loaded Company position task overrides the carried-over assignee', async () => {
    const detailWithPositionTask: ChecklistTemplateDetailResponse = {
      ...mockDetail,
      tasks: [
        {
          title: 'Return equipment',
          ownerType: 'custom_user',
          assignedToId: 'user-99',
          dueOffsetDays: 0,
          sequence: 1,
          isRequired: true,
          isBypassable: false,
          bypassPenaltyDescription: null,
          category: null
        }
      ]
    };

    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-999`).flush(detailWithPositionTask);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.match((r) => r.url.includes('/departments')).forEach((req) => req.flush(emptyPage));
    httpMock.match((r) => r.url.includes('/positions')).forEach((req) => req.flush(emptyPage));
    await Promise.resolve();
    fixture.detectChanges();

    component.tasksArray.at(0).patchValue({ assigneePositionId: 'pos-new', selectedAssigneeUserId: '' });

    const updateSpy = vi.spyOn(checklistStore, 'updateTemplate').mockResolvedValue(true);
    await component.onSubmit();

    expect(updateSpy).toHaveBeenCalledWith(
      'tmpl-999',
      expect.objectContaining({
        tasks: [
          expect.objectContaining({
            ownerType: 'custom_user',
            assignedToId: null,
            assigneePositionId: 'pos-new'
          })
        ]
      })
    );
  });
});
