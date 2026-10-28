import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { ChecklistTemplateListItemResponse } from '../../models/checklist-template.model';
import { ChecklistTemplateStore } from '../../state/checklist-template.store';
import { ChecklistTemplatesComponent } from './checklist-templates.component';

describe('ChecklistTemplatesComponent', () => {
  let component: ChecklistTemplatesComponent;
  let fixture: ComponentFixture<ChecklistTemplatesComponent>;
  let permissionService: PermissionService;
  let legalEntityStore: InstanceType<typeof LegalEntityStore>;
  let httpMock: HttpTestingController;

  const listUrl = `${environment.apiUrl}/people/checklist-templates`;
  const emptyPage = { items: [], totalCount: 0, page: 1, pageSize: 25 };

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

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ChecklistTemplatesComponent],
      providers: [
        PermissionService,
        LegalEntityStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    permissionService = TestBed.inject(PermissionService);
    legalEntityStore = TestBed.inject(LegalEntityStore);
    httpMock = TestBed.inject(HttpTestingController);

    vi.spyOn(legalEntityStore, 'selectedLegalEntity').mockReturnValue(mockCompany);
    vi.spyOn(permissionService, 'hasPermission').mockImplementation((perm: string) => perm === 'employees:read');

    fixture = TestBed.createComponent(ChecklistTemplatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Selected company is available on mount, so the constructor effect fires exactly once.
    httpMock.expectOne((r) => r.url === listUrl).flush(emptyPage);
    await Promise.resolve();
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify({ ignoreCancelled: true });
  });

  it('renders sub-sidebar route breadcrumbs and does not render redundant Checklist Templates heading/subtitle', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Checklist Templates');
    expect(fixture.nativeElement.textContent).toContain('Checklists');
    expect(fixture.nativeElement.textContent).not.toContain('Create and manage reusable onboarding and offboarding task templates');
  });

  it('does not render "Show archived templates" checkbox or label', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Show archived templates');
    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('hides Create Checklist button when user lacks employees:write permission', () => {
    expect(component.canManage()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('+ Create Checklist');
  });

  it('shows Create Checklist button when user has employees:write permission', () => {
    vi.spyOn(permissionService, 'hasPermission').mockReturnValue(true);
    TestBed.inject(ChecklistTemplateStore).reset();
    fixture = TestBed.createComponent(ChecklistTemplatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === listUrl).flush(emptyPage);

    expect(component.canManage()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('+ Create Checklist');
  });

  it('initial load sends active-only request (includeInactive=false)', () => {
    TestBed.inject(ChecklistTemplateStore).reset();
    const freshFixture = TestBed.createComponent(ChecklistTemplatesComponent);
    freshFixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === listUrl);
    expect(req.request.params.get('includeInactive')).toBe('false');
    expect(req.request.params.get('legalEntityId')).toBe('legal-1');
    req.flush(emptyPage);
  });

  it('changing type tab sends active-only request', () => {
    component.setTypeTab('onboarding');
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === listUrl);
    expect(req.request.params.get('includeInactive')).toBe('false');
    expect(req.request.params.get('templateType')).toBe('onboarding');
    req.flush(emptyPage);
  });

  it('no UI path sends includeInactive=true', () => {
    component.setTypeTab('offboarding');
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === listUrl);
    expect(req.request.params.get('includeInactive')).not.toBe('true');
    expect(req.request.params.get('includeInactive')).toBe('false');
    req.flush(emptyPage);
  });

  it('displays correct empty state copy for default tab ("all")', async () => {
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No checklist templates have been created yet.');
    expect(fixture.nativeElement.textContent).toContain('Create a checklist template to standardize employee onboarding or offboarding tasks.');
    expect(fixture.nativeElement.textContent).not.toContain('No templates match your selected filters');
  });

  it('displays correct empty state copy when onboarding tab is selected', async () => {
    component.setTypeTab('onboarding');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === listUrl).flush(emptyPage);
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No onboarding checklist templates have been created yet.');
    expect(fixture.nativeElement.textContent).toContain('Create a checklist template to standardize employee onboarding or offboarding tasks.');
  });

  it('displays correct empty state copy when offboarding tab is selected', async () => {
    component.setTypeTab('offboarding');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === listUrl).flush(emptyPage);
    await Promise.resolve();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No offboarding checklist templates have been created yet.');
    expect(fixture.nativeElement.textContent).toContain('Create a checklist template to standardize employee onboarding or offboarding tasks.');
  });

  it('initial selected company triggers exactly one list call', () => {
    fixture.detectChanges();
    fixture.detectChanges();

    httpMock.expectNone((r) => r.url === listUrl);
  });

  it('repeated change detection does not trigger additional identical list calls (regression: no request-loop)', () => {
    component.setTypeTab('onboarding');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === listUrl).flush(emptyPage);

    for (let i = 0; i < 5; i++) {
      fixture.detectChanges();
    }

    httpMock.expectNone((r) => r.url === listUrl);
  });

  it('opens the create checklist pop-up modal when openCreateModal is called', () => {
    expect(component.isModalOpen()).toBe(false);
    component.openCreateModal();
    expect(component.isModalOpen()).toBe(true);
    expect(component.selectedTemplateId()).toBeNull();
  });

  it('opens the edit checklist pop-up modal when openEditModal is called', () => {
    const mockTmpl: ChecklistTemplateListItemResponse = {
      id: 'tmpl-123',
      name: 'Onboarding Checklist',
      templateType: 'onboarding',
      legalEntityId: 'legal-1',
      departmentId: null,
      departmentName: null,
      positionId: null,
      positionName: null,
      isActive: true,
      taskCount: 3
    };

    expect(component.isModalOpen()).toBe(false);
    component.openEditModal(mockTmpl);
    expect(component.isModalOpen()).toBe(true);
    expect(component.selectedTemplateId()).toBe('tmpl-123');
  });

  it('closes the checklist pop-up modal on onModalClose', () => {
    component.openCreateModal();
    expect(component.isModalOpen()).toBe(true);
    component.onModalClose();
    expect(component.isModalOpen()).toBe(false);
    expect(component.selectedTemplateId()).toBeNull();
  });

  it('closes modal and reloads templates on onModalSaved', () => {
    const loadSpy = vi.spyOn(component, 'loadTemplates');
    component.openCreateModal();
    component.onModalSaved();
    expect(component.isModalOpen()).toBe(false);
    expect(loadSpy).toHaveBeenCalled();
    httpMock.expectOne((r) => r.url === listUrl).flush(emptyPage);
  });

  it('renders scope label "Company default" instead of "All employees in this company"', () => {
    const mockCompanyTmpl: ChecklistTemplateListItemResponse = {
      id: 'tmpl-1',
      name: 'Company Default Checklist',
      templateType: 'onboarding',
      legalEntityId: 'legal-1',
      departmentId: null,
      departmentName: null,
      positionId: null,
      positionName: null,
      isActive: true,
      taskCount: 2
    };

    expect(component.getScopeBadgeLabel(mockCompanyTmpl)).toBe('Company default');
    expect(component.getScopeBadgeLabel(mockCompanyTmpl)).not.toContain('All employees in this company');
  });

  it('does NOT render legacy app-modal component', () => {
    expect(fixture.nativeElement.querySelector('app-modal')).toBeNull();
  });
});
