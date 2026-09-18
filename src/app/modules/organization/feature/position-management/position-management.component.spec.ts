import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { PositionManagementComponent } from './position-management.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LegalEntityStore, SELECTED_LEGAL_ENTITY_STORAGE_KEY } from '../../state/legal-entity.store';
import { PositionStore } from '../../state/position.store';
import { DepartmentStore } from '../../state/department.store';
import { RoleStore } from '../../state/role.store';
import { PositionFormSubmitValue } from '../../ui/position-form-modal/position-form-modal.component';
import { PositionTreeNodeResponse } from '../../models/position.model';
import { environment } from '../../../../../environments/environment';

describe('PositionManagementComponent - System Access Flow', () => {
  let httpMock: HttpTestingController;
  let positionStore: InstanceType<typeof PositionStore>;
  let notificationService: NotificationService;
  let permissionService: PermissionService;

  beforeEach(() => localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY));
  afterEach(() => {
    localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY);
    TestBed.resetTestingModule();
  });

  const mockCompany = { id: 'le-123', name: 'Acme Corp', companyCode: 'ACME', logoFileId: null, isActive: true, isPrimary: true };

  const createFormValWithAccess: PositionFormSubmitValue = {
    departmentId: 'dept-1',
    name: 'Senior Frontend Engineer',
    code: 'FE-01',
    maxOccupancy: 1,
    reportsToPositionId: null,
    selectedAccessRoleId: 'role-mgr-1',
    accessRequiresApproval: true
  };

  const createFormValWithoutAccess: PositionFormSubmitValue = {
    departmentId: 'dept-1',
    name: 'Junior Developer',
    code: 'DEV01',
    maxOccupancy: 1,
    reportsToPositionId: null,
    selectedAccessRoleId: null,
    accessRequiresApproval: false
  };

  async function setup(permissions: string[] = ['org:read', 'org:manage', 'roles:read']) {
    const mockLegalEntityStore = {
      selectedLegalEntity: signal(mockCompany)
    };

    await TestBed.configureTestingModule({
      imports: [PositionManagementComponent],
      providers: [
        PermissionService,
        NotificationService,
        { provide: LegalEntityStore, useValue: mockLegalEntityStore },
        PositionStore,
        DepartmentStore,
        RoleStore,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    positionStore = TestBed.inject(PositionStore);
    notificationService = TestBed.inject(NotificationService);
    permissionService = TestBed.inject(PermissionService);

    vi.spyOn(permissionService, 'hasPermission').mockImplementation((p: string) => permissions.includes(p));

    const fixture = TestBed.createComponent(PositionManagementComponent);
    fixture.detectChanges();

    if (permissions.includes('org:read')) {
      httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/tree?includeInactive=false`).flush([]);
      httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/departments?view=tree&includeInactive=false`).flush([]);
    }

    return fixture;
  }

  it('checks permissions: org:manage + roles:read enables system access role loading and controls', async () => {
    const fixture = await setup(['org:read', 'org:manage', 'roles:read']);
    const comp = fixture.componentInstance;
    expect(comp.hasManageAccess()).toBe(true);
    expect(comp.hasRoleReadAccess()).toBe(true);
  });

  it('checks permissions: org:manage without roles:read restricts role loading', async () => {
    const fixture = await setup(['org:read', 'org:manage']);
    const comp = fixture.componentInstance;
    expect(comp.hasManageAccess()).toBe(true);
    expect(comp.hasRoleReadAccess()).toBe(false);
  });

  it('create position with access selection calls create endpoint then Set Position Access endpoint', async () => {
    const fixture = await setup(['org:read', 'org:manage', 'roles:read']);
    const comp = fixture.componentInstance;
    const successSpy = vi.spyOn(notificationService, 'success');

    const savePromise = comp.onSavePosition(createFormValWithAccess);

    // 1. POST create position
    const createReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual({
      departmentId: 'dept-1',
      name: 'Senior Frontend Engineer',
      code: 'FE-01',
      maxOccupancy: 1,
      reportsToPositionId: null
    });
    expect((createReq.request.body as Record<string, unknown>)['roleId']).toBeUndefined();
    expect((createReq.request.body as Record<string, unknown>)['requiresApproval']).toBeUndefined();

    createReq.flush({
      id: 'pos-new-1',
      legalEntityId: 'le-123',
      departmentId: 'dept-1',
      name: 'Senior Frontend Engineer',
      code: 'FE-01',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: null
    });

    await Promise.resolve();

    // positionStore.load after createPosition
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/tree?includeInactive=false`).flush([
      {
        id: 'pos-new-1',
        legalEntityId: 'le-123',
        departmentId: 'dept-1',
        name: 'Senior Frontend Engineer',
        code: 'FE-01',
        positionType: 'unique',
        maxOccupancy: 1,
        reportsToPositionId: null,
        isActive: true,
        childCount: 0,
        children: []
      }
    ]);

    await new Promise((r) => setTimeout(r, 0));

    // 2. PUT set position access
    const accessReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/pos-new-1/access`);
    expect(accessReq.request.method).toBe('PUT');
    expect(accessReq.request.body).toEqual({
      roleId: 'role-mgr-1',
      requiresApproval: true
    });
    accessReq.flush({
      positionId: 'pos-new-1',
      roleId: 'role-mgr-1',
      roleName: 'Manager',
      requiresApproval: true,
      isActive: true
    });

    await savePromise;

    expect(successSpy).toHaveBeenCalledWith('Position created with system access.');
  });

  it('create position without access selection calls only create endpoint', async () => {
    const fixture = await setup(['org:read', 'org:manage', 'roles:read']);
    const comp = fixture.componentInstance;
    const successSpy = vi.spyOn(notificationService, 'success');

    const savePromise = comp.onSavePosition(createFormValWithoutAccess);

    const createReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions`);
    expect(createReq.request.method).toBe('POST');
    createReq.flush({
      id: 'pos-new-2',
      legalEntityId: 'le-123',
      departmentId: 'dept-1',
      name: 'Junior Developer',
      code: 'DEV-01',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: null
    });

    await Promise.resolve();

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/tree?includeInactive=false`).flush([]);

    await savePromise;

    httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/le-123/positions/pos-new-2/access`);
    expect(successSpy).toHaveBeenCalledWith('Position created.');
  });

  it('create position failure does not call set-access endpoint', async () => {
    const fixture = await setup(['org:read', 'org:manage', 'roles:read']);
    const comp = fixture.componentInstance;
    const errorSpy = vi.spyOn(notificationService, 'error');

    const savePromise = comp.onSavePosition(createFormValWithAccess);

    const createReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions`);
    createReq.flush({ message: 'Duplicate code' }, { status: 400, statusText: 'Bad Request' });

    await savePromise;

    httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/le-123/positions/pos-new-1/access`);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('partial failure (create succeeds, set-access fails) shows warning toast and keeps created position', async () => {
    const fixture = await setup(['org:read', 'org:manage', 'roles:read']);
    const comp = fixture.componentInstance;
    const warningSpy = vi.spyOn(notificationService, 'warning');
    const successSpy = vi.spyOn(notificationService, 'success');

    const savePromise = comp.onSavePosition(createFormValWithAccess);

    const createReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions`);
    createReq.flush({
      id: 'pos-new-3',
      legalEntityId: 'le-123',
      departmentId: 'dept-1',
      name: 'Senior Frontend Engineer',
      code: 'FE-01',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: null
    });

    await Promise.resolve();

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/tree?includeInactive=false`).flush([
      {
        id: 'pos-new-3',
        legalEntityId: 'le-123',
        departmentId: 'dept-1',
        name: 'Senior Frontend Engineer',
        code: 'FE-01',
        positionType: 'unique',
        maxOccupancy: 1,
        reportsToPositionId: null,
        isActive: true,
        childCount: 0,
        children: []
      }
    ]);

    await new Promise((r) => setTimeout(r, 0));

    const accessReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/pos-new-3/access`);
    accessReq.flush({ message: 'Role not found' }, { status: 404, statusText: 'Not Found' });

    await savePromise;

    expect(successSpy).not.toHaveBeenCalled();
    expect(warningSpy).toHaveBeenCalledWith(
      'Position was created, but system access was not saved. You can update access from Position Access.'
    );

    expect(positionStore.allPositionsList().some((p) => p.id === 'pos-new-3')).toBe(true);
  });

  it('existing Position Access edit flow loads access template and updates access', async () => {
    const fixture = await setup(['org:read', 'org:manage', 'roles:read']);
    const comp = fixture.componentInstance;

    const posToEdit = {
      id: 'pos-existing-1',
      legalEntityId: 'le-123',
      departmentId: 'dept-1',
      name: 'Existing Lead',
      code: 'EX-1',
      positionType: 'unique' as const,
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: null
    };

    const openAccessPromise = comp.openAccessModal(posToEdit);

    httpMock.expectOne(`${environment.apiUrl}/roles`).flush([]);

    const getAccessReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/pos-existing-1/access`);
    getAccessReq.flush({
      positionId: 'pos-existing-1',
      roleId: 'role-1',
      roleName: 'Original Role',
      requiresApproval: false,
      isActive: true
    });

    await openAccessPromise;

    expect(comp.accessModalOpen()).toBe(true);
    expect(positionStore.accessTemplate()?.roleName).toBe('Original Role');

    const saveAccessPromise = comp.onSaveAccess({ roleId: 'role-2', requiresApproval: true });

    const putAccessReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/pos-existing-1/access`);
    expect(putAccessReq.request.body).toEqual({ roleId: 'role-2', requiresApproval: true });
    putAccessReq.flush({
      positionId: 'pos-existing-1',
      roleId: 'role-2',
      roleName: 'Updated Role',
      requiresApproval: true,
      isActive: true
    });

    await saveAccessPromise;

    expect(comp.accessModalOpen()).toBe(false);
  });

  it('blocks openAccessModal and onSaveAccess when user lacks org:manage or roles:read', async () => {
    const fixture = await setup(['org:read', 'org:manage']); // lacks roles:read
    const comp = fixture.componentInstance;
    const errorSpy = vi.spyOn(notificationService, 'error');

    await comp.openAccessModal({
      id: 'pos-1',
      legalEntityId: 'le-123',
      departmentId: null,
      name: 'Pos 1',
      code: 'P1',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: null
    });

    expect(comp.accessModalOpen()).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith("You don't have permission to configure position system access.");

    await comp.onSaveAccess({ roleId: 'role-1', requiresApproval: false });
    expect(errorSpy).toHaveBeenCalledWith("You don't have permission to configure position system access.");
  });

  describe('Position Template Packs Integration', () => {
    const mockPacksResponse = {
      items: [
        {
          id: 'pack-1',
          templateKey: 'software-starter',
          name: 'Software Starter Pack',
          description: 'Starter pack for dev teams',
          industryProfileTag: 'tech',
          employeeCountRangeKey: '11-50',
          employeeCountMin: 11,
          employeeCountMax: 50,
          positions: [
            {
              positionKey: 'eng-mgr',
              positionName: 'Engineering Manager',
              departmentName: 'Engineering',
              reportsToPositionKey: null,
              linkedRoleTemplateId: 'global-role-template-id-123'
            },
            {
              positionKey: 'sw-eng',
              positionName: 'Software Engineer',
              departmentName: 'Product R&D',
              reportsToPositionKey: 'eng-mgr',
              linkedRoleTemplateId: null
            }
          ]
        }
      ]
    };

    it('replaces old Filter button with Templates button', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const native = fixture.nativeElement;

      const templatesBtn = native.querySelector('.pm-templates-btn');
      expect(templatesBtn).not.toBeNull();
      expect(templatesBtn.textContent).toContain('Templates');
      expect(native.querySelector('.pm-templates-count')).toBeNull();

      const filterBtn = native.querySelector('.pm-filter-btn');
      expect(filterBtn).toBeNull();
    });

    it('clicking Templates loads packs and opens drawer', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      comp.openTemplateDrawer();
      fixture.detectChanges();

      const req = httpMock.expectOne(`${environment.apiUrl}/org/position-template-packs`);
      expect(req.request.method).toBe('GET');
      req.flush(mockPacksResponse);
      await Promise.resolve();

      expect(comp.templateDrawerOpen()).toBe(true);
      expect(positionStore.templatePacks().length).toBe(1);
    });


    it('org:read-only user can view templates but gets friendly toast if attempting to select template', async () => {
      const fixture = await setup(['org:read']);
      const comp = fixture.componentInstance;
      const errorSpy = vi.spyOn(notificationService, 'error');

      comp.onSelectTemplatePosition({
        position: mockPacksResponse.items[0].positions[0],
        packName: 'Software Starter Pack'
      });

      expect(errorSpy).toHaveBeenCalledWith('You need organization management access to create positions from templates.');
      expect(comp.formModalOpen()).toBe(false);
    });

    it('org:manage user selecting template opens create modal prefilled with matched department and safe code', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      // Mock department store having "Engineering"
      vi.spyOn(comp.departmentStore, 'allFlatList').mockReturnValue([
        { id: 'dept-eng-1', name: 'Engineering', code: 'ENG', parentDepartmentId: null, legalEntityId: 'le-123', isActive: true, headPositionId: null, createdAt: '2026-01-01', updatedAt: null }
      ]);

      comp.onSelectTemplatePosition({
        position: mockPacksResponse.items[0].positions[0],
        packName: 'Software Starter Pack'
      });

      expect(comp.formModalOpen()).toBe(true);
      expect(comp.templatePreset()).toEqual({
        source: 'template-click',
        positionName: 'Engineering Manager',
        positionKey: 'eng-mgr',
        departmentId: 'dept-eng-1',
        reportsToPositionId: null,
        reportsToPositionName: null,
        suggestedDepartmentName: null,
        departmentMessage: null
      });
    });

    it('unmatched departmentName does not auto-create department, sets suggestedDepartmentName', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      // Department store has "Engineering", position suggests "Product R&D"
      vi.spyOn(comp.departmentStore, 'allFlatList').mockReturnValue([
        { id: 'dept-eng-1', name: 'Engineering', code: 'ENG', parentDepartmentId: null, legalEntityId: 'le-123', isActive: true, headPositionId: null, createdAt: '2026-01-01', updatedAt: null }
      ]);


      comp.onSelectTemplatePosition({
        position: mockPacksResponse.items[0].positions[1], // Product R&D
        packName: 'Software Starter Pack'
      });

      expect(comp.templatePreset()?.departmentId).toBeNull();
      expect(comp.templatePreset()?.suggestedDepartmentName).toBe('Product R&D');
    });

    it('selecting a template pre-fills reporting line when a safe match for reportsToPositionKey exists in store', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      // Mock existing positions in store with code 'ENG-MGR' matching template reportsToPositionKey 'eng-mgr'
      vi.spyOn(comp.positionStore, 'allPositionsList').mockReturnValue([
        {
          id: 'pos-existing-eng-mgr',
          legalEntityId: 'le-123',
          departmentId: 'dept-eng-1',
          name: 'Engineering Manager',
          code: 'ENG-MGR',
          positionType: 'unique',
          maxOccupancy: 1,
          reportsToPositionId: null,
          isActive: true,
          createdAt: '2026-01-01',
          updatedAt: null
        }
      ]);

      comp.onSelectTemplatePosition({
        position: mockPacksResponse.items[0].positions[1], // sw-eng, reportsToPositionKey: 'eng-mgr'
        packName: 'Software Starter Pack'
      });

      expect(comp.formModalOpen()).toBe(true);
      expect(comp.templatePreset()?.reportsToPositionId).toBe('pos-existing-eng-mgr');
      expect(comp.templatePreset()?.reportsToPositionName).toBe('Engineering Manager');
    });

    it('submitting position form created from template displays "Position created from template." toast and clears preset', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      const successSpy = vi.spyOn(notificationService, 'success');

      comp.onSelectTemplatePosition({
        position: mockPacksResponse.items[0].positions[0],
        packName: 'Software Starter Pack'
      });

      const savePromise = comp.onSavePosition({
        departmentId: 'dept-eng-1',
        name: 'Engineering Manager',
        code: 'ENGM',
        maxOccupancy: 1,
        reportsToPositionId: null
      });

      const createReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions`);
      expect(createReq.request.method).toBe('POST');
      expect(createReq.request.body).toEqual({
        departmentId: 'dept-eng-1',
        name: 'Engineering Manager',
        code: 'ENGM',
        maxOccupancy: 1,
        reportsToPositionId: null
      });
      // Verify linkedRoleTemplateId is NOT sent as roleId
      expect((createReq.request.body as Record<string, unknown>)['roleId']).toBeUndefined();
      expect((createReq.request.body as Record<string, unknown>)['positionType']).toBeUndefined();

      createReq.flush({
        id: 'pos-created-tmpl',
        legalEntityId: 'le-123',
        departmentId: 'dept-eng-1',
        name: 'Engineering Manager',
        code: 'ENG_MGR',
        positionType: 'unique',
        maxOccupancy: 1,
        reportsToPositionId: null,
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: null
      });

      await Promise.resolve();
      httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/tree?includeInactive=false`).flush([]);

      await savePromise;

      expect(successSpy).toHaveBeenCalledWith('Position created from template.');
      expect(comp.templatePreset()).toBeNull();
    });
  });

  describe('Native drag/drop from Position Templates onto the hierarchy', () => {
    function fakeTemplateDragEvent(payload: unknown): DragEvent {
      return {
        preventDefault: vi.fn(),
        dataTransfer: {
          types: ['application/x-onevo-position-template'],
          dropEffect: '',
          getData: (type: string) => (type === 'application/x-onevo-position-template' ? JSON.stringify(payload) : '')
        }
      } as unknown as DragEvent;
    }

    const engMgrTemplatePosition = {
      positionKey: 'eng-mgr',
      positionName: 'Engineering Manager',
      departmentName: 'Engineering',
      reportsToPositionKey: null,
      linkedRoleTemplateId: 'global-role-template-id-123'
    };

    const swEngTemplatePosition = {
      positionKey: 'sw-eng',
      positionName: 'Software Engineer',
      departmentName: 'Product R&D',
      reportsToPositionKey: 'eng-mgr',
      linkedRoleTemplateId: null
    };

    const engineeringDept = {
      id: 'dept-eng-1',
      name: 'Engineering',
      code: 'ENG',
      parentDepartmentId: null,
      legalEntityId: 'le-123',
      isActive: true,
      headPositionId: null,
      createdAt: '2026-01-01',
      updatedAt: null
    };

    const parentPosition: PositionTreeNodeResponse = {
      id: 'pos-parent-1',
      legalEntityId: 'le-123',
      departmentId: 'dept-eng-1',
      name: 'Engineering Manager',
      code: 'ENG-MGR',
      positionType: 'unique',
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      childCount: 0,
      children: [],
      departmentName: 'Engineering'
    };

    it('dropping a template on empty canvas opens the create modal with reportsToPositionId = null (root)', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      vi.spyOn(comp.departmentStore, 'allFlatList').mockReturnValue([engineeringDept]);

      comp.onCanvasDrop(fakeTemplateDragEvent({ position: engMgrTemplatePosition, packName: 'Software Starter Pack' }));

      expect(comp.formModalOpen()).toBe(true);
      expect(comp.templatePreset()?.reportsToPositionId).toBeNull();
      expect(comp.templatePreset()?.source).toBe('template-drop-root');
    });

    it('dropping a template on empty canvas matches department from the template departmentName when an active department exists', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      vi.spyOn(comp.departmentStore, 'allFlatList').mockReturnValue([engineeringDept]);

      comp.onCanvasDrop(fakeTemplateDragEvent({ position: engMgrTemplatePosition, packName: 'Software Starter Pack' }));

      expect(comp.templatePreset()?.departmentId).toBe('dept-eng-1');
      expect(comp.templatePreset()?.suggestedDepartmentName).toBeNull();
    });

    it('dropping a template on empty canvas with an unmatched department does not auto-create a department; sets a suggestion helper instead', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      vi.spyOn(comp.departmentStore, 'allFlatList').mockReturnValue([engineeringDept]);

      comp.onCanvasDrop(fakeTemplateDragEvent({ position: swEngTemplatePosition, packName: 'Software Starter Pack' }));

      expect(comp.templatePreset()?.departmentId).toBeNull();
      expect(comp.templatePreset()?.suggestedDepartmentName).toBe('Product R&D');
      httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/le-123/departments`);
    });

    it("dropping a template on an existing position uses that position's id as reportsToPositionId", async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      comp.onTemplateDroppedOnPosition({
        templatePosition: swEngTemplatePosition,
        packName: 'Software Starter Pack',
        targetPosition: parentPosition
      });

      expect(comp.formModalOpen()).toBe(true);
      expect(comp.templatePreset()?.reportsToPositionId).toBe('pos-parent-1');
      expect(comp.templatePreset()?.source).toBe('template-drop-under-position');
    });

    it("dropping a template on an existing position inherits that position's departmentId", async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      comp.onTemplateDroppedOnPosition({
        templatePosition: swEngTemplatePosition,
        packName: 'Software Starter Pack',
        targetPosition: parentPosition
      });

      expect(comp.templatePreset()?.departmentId).toBe('dept-eng-1');
      expect(comp.templatePreset()?.departmentMessage).toContain('Engineering Manager');
    });

    it("dropping under a position ignores the template's own reportsToPositionKey ('eng-mgr') and uses the dropped-on position instead", async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      const differentParent: PositionTreeNodeResponse = {
        ...parentPosition,
        id: 'pos-different-parent',
        name: 'VP Engineering'
      };

      // swEngTemplatePosition.reportsToPositionKey === 'eng-mgr', but the user explicitly dropped under 'pos-different-parent'
      comp.onTemplateDroppedOnPosition({
        templatePosition: swEngTemplatePosition,
        packName: 'Software Starter Pack',
        targetPosition: differentParent
      });

      expect(comp.templatePreset()?.reportsToPositionId).toBe('pos-different-parent');
      expect(comp.templatePreset()?.reportsToPositionId).not.toBe('eng-mgr');
    });

    it('read-only user cannot drop on canvas: no modal opens and a friendly toast is shown', async () => {
      const fixture = await setup(['org:read']);
      const comp = fixture.componentInstance;
      const errorSpy = vi.spyOn(notificationService, 'error');

      comp.onCanvasDrop(fakeTemplateDragEvent({ position: engMgrTemplatePosition, packName: 'Software Starter Pack' }));

      expect(comp.formModalOpen()).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('You need organization management access to create positions from templates.');
    });

    it('read-only user cannot drop under a position: no modal opens and a friendly toast is shown', async () => {
      const fixture = await setup(['org:read']);
      const comp = fixture.componentInstance;
      const errorSpy = vi.spyOn(notificationService, 'error');

      comp.onTemplateDroppedOnPosition({
        templatePosition: swEngTemplatePosition,
        packName: 'Software Starter Pack',
        targetPosition: parentPosition
      });

      expect(comp.formModalOpen()).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith('You need organization management access to create positions from templates.');
    });

    it('template preset clears after the create modal is closed following a drop', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      comp.onCanvasDrop(fakeTemplateDragEvent({ position: engMgrTemplatePosition, packName: 'Software Starter Pack' }));
      expect(comp.templatePreset()).not.toBeNull();

      comp.closeFormModal();

      expect(comp.templatePreset()).toBeNull();
      expect(comp.formModalOpen()).toBe(false);
    });

    it('creating a position from a canvas-root template drop sends only backend-supported create fields, never linkedRoleTemplateId as roleId', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      comp.onCanvasDrop(fakeTemplateDragEvent({ position: engMgrTemplatePosition, packName: 'Software Starter Pack' }));

      const savePromise = comp.onSavePosition({
        departmentId: 'dept-eng-1',
        name: 'Engineering Manager',
        code: 'ENGM',
        maxOccupancy: 1,
        reportsToPositionId: null
      });

      const createReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions`);
      expect(createReq.request.body).toEqual({
        departmentId: 'dept-eng-1',
        name: 'Engineering Manager',
        code: 'ENGM',
        maxOccupancy: 1,
        reportsToPositionId: null
      });
      expect((createReq.request.body as Record<string, unknown>)['roleId']).toBeUndefined();
      expect((createReq.request.body as Record<string, unknown>)['positionType']).toBeUndefined();

      createReq.flush({
        id: 'pos-created-drop',
        legalEntityId: 'le-123',
        departmentId: 'dept-eng-1',
        name: 'Engineering Manager',
        code: 'ENG_MGR',
        positionType: 'unique',
        maxOccupancy: 1,
        reportsToPositionId: null,
        isActive: true,
        createdAt: '2026-01-01',
        updatedAt: null
      });

      await Promise.resolve();
      httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-123/positions/tree?includeInactive=false`).flush([]);
      await savePromise;

      expect(comp.templatePreset()).toBeNull();
    });
  });

  describe('Position Hierarchy Zoom', () => {
    const mockTreeNode = {
      id: 'pos-root-1',
      legalEntityId: 'le-123',
      departmentId: null,
      name: 'CEO',
      code: 'CEO',
      positionType: 'unique' as const,
      maxOccupancy: 1,
      reportsToPositionId: null,
      isActive: true,
      childCount: 0,
      children: []
    };

    it('onTreeWheel zooms in on wheel-up (negative deltaY) and out on wheel-down (positive deltaY), in small steps', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      expect(comp.treeZoom()).toBe(0.7);

      comp.onTreeWheel({ deltaY: -100, preventDefault: () => {} } as WheelEvent);
      expect(comp.treeZoom()).toBeCloseTo(0.72);

      comp.onTreeWheel({ deltaY: 100, preventDefault: () => {} } as WheelEvent);
      expect(comp.treeZoom()).toBeCloseTo(0.7);
    });

    it('a single wheel tick is smaller than a +/- button click, so a quick scroll does not jump straight to the min/max', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      comp.onTreeWheel({ deltaY: -100, preventDefault: () => {} } as WheelEvent);
      const wheelStep = comp.treeZoom() - 0.7;

      comp.resetZoom();
      comp.zoomIn();
      const buttonStep = comp.treeZoom() - 0.7;

      expect(wheelStep).toBeGreaterThan(0);
      expect(wheelStep).toBeLessThan(buttonStep);
    });

    it('onTreeWheel calls preventDefault so the wheel event does not scroll the page', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      const preventDefault = vi.fn();

      comp.onTreeWheel({ deltaY: -100, preventDefault } as unknown as WheelEvent);

      expect(preventDefault).toHaveBeenCalled();
    });

    it('wheel zoom clamps at the same min/max range as the plus/minus controls', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      for (let i = 0; i < 60; i++) {
        comp.onTreeWheel({ deltaY: -100, preventDefault: () => {} } as WheelEvent);
      }
      expect(comp.treeZoom()).toBe(1.5);

      for (let i = 0; i < 80; i++) {
        comp.onTreeWheel({ deltaY: 100, preventDefault: () => {} } as WheelEvent);
      }
      expect(comp.treeZoom()).toBe(0.4);
    });

    it('plus/minus zoom methods still work and clamp at the documented min/max', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      comp.zoomIn();
      expect(comp.treeZoom()).toBe(0.8);
      comp.zoomOut();
      expect(comp.treeZoom()).toBe(0.7);

      for (let i = 0; i < 20; i++) comp.zoomIn();
      expect(comp.treeZoom()).toBe(1.5);

      for (let i = 0; i < 30; i++) comp.zoomOut();
      expect(comp.treeZoom()).toBe(0.4);

      comp.resetZoom();
      expect(comp.treeZoom()).toBe(0.7);
    });

    it('binds the wheel handler on the tree canvas and the +/- buttons update the displayed zoom', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      vi.spyOn(positionStore, 'treeData').mockReturnValue([mockTreeNode]);
      fixture.detectChanges();

      const canvas = fixture.nativeElement.querySelector('.pm-tree-container');
      expect(canvas).not.toBeNull();

      const wheelSpy = vi.spyOn(comp, 'onTreeWheel');
      canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }));
      expect(wheelSpy).toHaveBeenCalled();
      expect(comp.treeZoom()).toBeCloseTo(0.72);

      comp.resetZoom();
      fixture.detectChanges();

      const zoomInBtn: HTMLButtonElement = fixture.nativeElement.querySelectorAll('.pm-zoom-btn')[1];
      zoomInBtn.click();
      fixture.detectChanges();
      expect(comp.treeZoom()).toBe(0.8);

      const zoomOutBtn: HTMLButtonElement = fixture.nativeElement.querySelectorAll('.pm-zoom-btn')[0];
      zoomOutBtn.click();
      fixture.detectChanges();
      expect(comp.treeZoom()).toBe(0.7);

      const resetBtn: HTMLButtonElement = fixture.nativeElement.querySelector('.pm-zoom-reset');
      expect(resetBtn.textContent?.trim()).toBe('70%');
    });
  });

  describe('Position Hierarchy Canvas Panning', () => {
    function createPointerEvent(type: string, target: HTMLElement, clientX = 0, clientY = 0, button = 0): PointerEvent {
      return {
        type,
        pointerId: 1,
        clientX,
        clientY,
        button,
        target,
        currentTarget: target,
        bubbles: true,
        cancelable: true,
        preventDefault: () => {}
      } as unknown as PointerEvent;
    }

    it('pointerdown on empty hierarchy canvas starts panning and pointermove updates pan offset', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      const canvas = document.createElement('div');
      canvas.className = 'pm-tree-container';

      expect(comp.isPanning()).toBe(false);
      expect(comp.treePanX()).toBe(0);
      expect(comp.treePanY()).toBe(0);

      comp.onCanvasPointerDown(createPointerEvent('pointerdown', canvas, 100, 200));

      expect(comp.isPanning()).toBe(true);

      comp.onCanvasPointerMove(createPointerEvent('pointermove', canvas, 150, 230));

      expect(comp.treePanX()).toBe(50);
      expect(comp.treePanY()).toBe(30);
      expect(comp.treeTransform()).toContain('translate(50px, 30px)');

      comp.onCanvasPointerUp(createPointerEvent('pointerup', canvas, 150, 230));

      expect(comp.isPanning()).toBe(false);
    });

    it('pointercancel ends panning', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      const canvas = document.createElement('div');

      comp.onCanvasPointerDown(createPointerEvent('pointerdown', canvas, 100, 100));
      expect(comp.isPanning()).toBe(true);

      comp.onCanvasPointerCancel(createPointerEvent('pointercancel', canvas, 120, 120));
      expect(comp.isPanning()).toBe(false);
    });

    it('pointerdown on a position card does not start panning', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      const card = document.createElement('div');
      card.className = 'ptn-node-card';

      comp.onCanvasPointerDown(createPointerEvent('pointerdown', card, 100, 100));

      expect(comp.isPanning()).toBe(false);
      expect(comp.treePanX()).toBe(0);
      expect(comp.treePanY()).toBe(0);
    });

    it('resetZoom resets both zoom factor to 0.7 and pan offsets to 0', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      const canvas = document.createElement('div');

      comp.zoomIn();
      comp.onCanvasPointerDown(createPointerEvent('pointerdown', canvas, 100, 100));
      comp.onCanvasPointerMove(createPointerEvent('pointermove', canvas, 200, 250));
      comp.onCanvasPointerUp(createPointerEvent('pointerup', canvas, 200, 250));

      expect(comp.treeZoom()).toBe(0.8);
      expect(comp.treePanX()).toBe(100);
      expect(comp.treePanY()).toBe(150);

      comp.resetZoom();

      expect(comp.treeZoom()).toBe(0.7);
      expect(comp.treePanX()).toBe(0);
      expect(comp.treePanY()).toBe(0);
      expect(comp.treeTransform()).toContain('translate(0px, 0px) scale(0.7)');
    });
  });

  describe('Toolbar Controls', () => {
    it('renders breadcrumb and controls on the same horizontal header line (pm-header-row) with expandable search icon', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      const pageHeader = fixture.nativeElement.querySelector('.pm-page-header');
      expect(pageHeader).not.toBeNull();

      const headerRow = pageHeader.querySelector('.pm-header-row');
      expect(headerRow).not.toBeNull();

      const breadcrumb = headerRow.querySelector('app-breadcrumb-header');
      const controls = headerRow.querySelector('.pm-controls');
      const searchBtn: HTMLButtonElement = headerRow.querySelector('.pm-icon-btn');
      const deptSelect = headerRow.querySelector('.pm-dept-select-wrap');
      const viewToggle = headerRow.querySelector('.pm-view-toggle');
      const templatesBtn = headerRow.querySelector('.pm-templates-btn');
      const createBtn = headerRow.querySelector('.pm-controls app-button');

      expect(breadcrumb).not.toBeNull();
      expect(controls).not.toBeNull();
      expect(searchBtn).not.toBeNull();
      expect(deptSelect).not.toBeNull();
      expect(viewToggle).not.toBeNull();
      expect(templatesBtn).not.toBeNull();
      expect(createBtn).not.toBeNull();

      // Search input is collapsed by default and expands on click
      expect(headerRow.querySelector('.pm-search-input')).toBeNull();
      searchBtn.click();
      fixture.detectChanges();

      const searchInput: HTMLInputElement = headerRow.querySelector('.pm-search-input');
      expect(searchInput).not.toBeNull();
    });

    it('does not render "Show archived" checkbox or label in the toolbar', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      fixture.detectChanges();

      const checkbox = fixture.nativeElement.querySelector('.pm-archived-checkbox-label');
      expect(checkbox).toBeNull();

      expect(fixture.nativeElement.textContent).not.toContain('Show archived');
      expect(positionStore.includeInactive()).toBe(false);
    });

    it('renders icon-only Tree and List view toggle buttons with title and aria-label', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      fixture.detectChanges();

      const toggleBtns = fixture.nativeElement.querySelectorAll('.pm-toggle-btn');
      expect(toggleBtns.length).toBe(2);

      const treeBtn: HTMLButtonElement = toggleBtns[0];
      const listBtn: HTMLButtonElement = toggleBtns[1];

      expect(treeBtn.getAttribute('aria-label')).toBe('Tree view');
      expect(treeBtn.getAttribute('title')).toBe('Tree view');
      expect(treeBtn.textContent?.trim()).toBe('');

      expect(listBtn.getAttribute('aria-label')).toBe('List view');
      expect(listBtn.getAttribute('title')).toBe('List view');
      expect(listBtn.textContent?.trim()).toBe('');
    });

    it('clicking icon-only toggle buttons switches between tree and list view mode', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;
      fixture.detectChanges();

      expect(positionStore.viewMode()).toBe('tree');

      const listBtn: HTMLButtonElement = fixture.nativeElement.querySelectorAll('.pm-toggle-btn')[1];
      listBtn.click();
      fixture.detectChanges();

      expect(positionStore.viewMode()).toBe('list');

      const treeBtn: HTMLButtonElement = fixture.nativeElement.querySelectorAll('.pm-toggle-btn')[0];
      treeBtn.click();
      fixture.detectChanges();

      expect(positionStore.viewMode()).toBe('tree');
    });

    it('templates drawer open in list view maintains two-column layout and does not corrupt table alignment', async () => {
      const fixture = await setup(['org:read', 'org:manage']);
      const comp = fixture.componentInstance;

      vi.spyOn(positionStore, 'load').mockResolvedValue(undefined);

      comp.onViewModeToggle('list');
      comp.openTemplateDrawer();
      fixture.detectChanges();

      expect(comp.templateDrawerOpen()).toBe(true);
      expect(positionStore.viewMode()).toBe('list');

      const mainLayout = fixture.nativeElement.querySelector('.pm-main-layout');
      const drawer = fixture.nativeElement.querySelector('app-position-template-drawer');
      const listTable = fixture.nativeElement.querySelector('app-position-list-table');

      expect(mainLayout).not.toBeNull();
      expect(drawer).not.toBeNull();
      expect(listTable).not.toBeNull();
    });
  });
});

