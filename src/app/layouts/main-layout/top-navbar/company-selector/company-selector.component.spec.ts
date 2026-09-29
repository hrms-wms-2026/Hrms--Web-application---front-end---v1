import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { LegalEntityListItem } from '../../../../modules/organization/models/legal-entity.model';
import { LegalEntityStore, SELECTED_LEGAL_ENTITY_STORAGE_KEY } from '../../../../modules/organization/state/legal-entity.store';
import { CompanySelectorComponent } from './company-selector.component';

describe('CompanySelectorComponent', () => {
  const mockCompanies: LegalEntityListItem[] = [
    {
      id: 'comp-1',
      name: 'OneVo Technologies',
      companyCode: 'OVT',
      logoFileId: null,
      isActive: true,
      isPrimary: true
    },
    {
      id: 'comp-2',
      name: 'OneVo Labs',
      companyCode: 'OVL',
      logoFileId: null,
      isActive: true,
      isPrimary: false
    }
  ];

  beforeEach(() => {
    localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY);
  });

  async function setup(activeModules: string[] = [], permissions: string[] = []) {
    await TestBed.configureTestingModule({
      imports: [CompanySelectorComponent],
      providers: [
        LegalEntityStore,
        NotificationService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { checkSession: vi.fn().mockResolvedValue(true) } },
        {
          provide: PermissionService,
          useValue: {
            hasModule: (m: string) => activeModules.includes(m),
            hasAnyPermission: (p: readonly string[]) => p.some((perm) => permissions.includes(perm)),
            hasPermission: (p: string) => permissions.includes(p)
          }
        }
      ]
    }).compileComponents();

    const legalEntityStore = TestBed.inject(LegalEntityStore);
    const notificationService = TestBed.inject(NotificationService);
    const httpMock = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CompanySelectorComponent);

    return { fixture, legalEntityStore, notificationService, httpMock };
  }

  it('renders selector and loads accessible companies without org module or org:read', async () => {
    const { fixture, httpMock } = await setup([], []);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/session/companies'));
    req.flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('OneVo Technologies');
    httpMock.verify();
  });

  it('loads selector companies from the session endpoint, not the Organization list endpoint', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/session/companies'));
    req.flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('OneVo Technologies');
    httpMock.verify();
  });

  it('toggles popover dropdown open and selects another company', async () => {
    const { fixture, legalEntityStore, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/session/companies'));
    req.flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.company-selector__trigger');
    trigger.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(true);

    const items: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.company-selector__item'));
    const betaItem = items.find((el) => el.textContent?.includes('OneVo Labs'));
    expect(betaItem).toBeDefined();

    betaItem?.click();
    const switchReq = httpMock.expectOne((r) => r.url.includes('/session/active-company'));
    expect(switchReq.request.body).toEqual({ legalEntityId: 'comp-2' });
    switchReq.flush(null);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(legalEntityStore.selectedLegalEntityId()).toBe('comp-2');
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-2');
    expect(fixture.componentInstance.isOpen()).toBe(false);
    httpMock.verify();
  });

  it('shows a loading state in the trigger before companies resolve', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger.textContent).toContain('Loading companies...');

    httpMock.expectOne((r) => r.url.includes('/session/companies')).flush(mockCompanies);
    httpMock.verify();
  });

  it('shows an empty state instead of disappearing when there are no companies', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/session/companies')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('No companies');

    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.company-selector__status').textContent).toContain('No companies found');
    httpMock.verify();
  });

  it('shows safe copy when the accessible company list is forbidden', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url.includes('/session/companies'))
      .flush({ detail: 'Required permission org:read missing' }, { status: 403, statusText: 'Forbidden' });
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('Company unavailable');

    trigger.click();
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('.company-selector__status--error');
    expect(status).not.toBeNull();
    expect(status.textContent).toContain('You do not have access to perform this action.');
    httpMock.verify();
  });

  it('opens the create company modal when Add Company is clicked', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:manage', 'legal_entity:create']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/session/companies'));
    req.flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.company-selector__trigger');
    trigger.click();
    fixture.detectChanges();

    const addItem: HTMLButtonElement = fixture.nativeElement.querySelector('.company-selector__item--action');
    addItem.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(fixture.componentInstance.showCreateModal()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
    httpMock.verify();
  });

  it('creates a company, closes the modal, shows success, and preserves the current selection', async () => {
    const { fixture, httpMock, notificationService, legalEntityStore } = await setup(['org_structure'], ['org:read', 'legal_entity:create']);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/session/companies')).flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    const selectPromise = legalEntityStore.selectCompany('comp-2');
    httpMock.expectOne((r) => r.url.includes('/session/active-company')).flush(null);
    await selectPromise;
    fixture.componentInstance.onAddCompany();
    fixture.detectChanges();

    vi.spyOn(notificationService, 'success');

    const createPromise = fixture.componentInstance.onCreateCompany({
      name: 'Gamma Inc',
      companyCode: 'GAMMA',
      registrationNumber: 'REG-3',
      countryCode: 'LKA',
      currencyCode: 'LKR',
      taxRegistrationNumber: null,
      parentLegalEntityId: null
    });

    const postReq = httpMock.expectOne((r) => r.url.includes('/org/legal-entities') && r.method === 'POST');
    postReq.flush({ id: 'comp-3', name: 'Gamma Inc' });

    const refreshReq = await vi.waitFor(() =>
      httpMock.expectOne((r) => r.url.includes('/session/companies'))
    );
    refreshReq.flush([...mockCompanies, { id: 'comp-3', name: 'Gamma Inc', companyCode: 'GAMMA', logoFileId: null, isActive: true, isPrimary: false }]);

    await createPromise;
    fixture.detectChanges();

    expect(notificationService.success).toHaveBeenCalledWith("Company 'Gamma Inc' created successfully.");
    expect(fixture.componentInstance.showCreateModal()).toBe(false);
    expect(legalEntityStore.selectedLegalEntityId()).toBe('comp-2');
    httpMock.verify();
  });

  it('shows an error notification and keeps the modal open when create fails with a conflict', async () => {
    const { fixture, httpMock, notificationService } = await setup(['org_structure'], ['org:read', 'legal_entity:create']);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/session/companies')).flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onAddCompany();
    fixture.detectChanges();

    vi.spyOn(notificationService, 'error');

    const createPromise = fixture.componentInstance.onCreateCompany({
      name: 'OneVo Technologies',
      companyCode: 'OVT',
      registrationNumber: 'REG-001',
      countryCode: 'LKA',
      currencyCode: 'LKR',
      taxRegistrationNumber: null,
      parentLegalEntityId: null
    });

    const postReq = httpMock.expectOne((r) => r.url.includes('/org/legal-entities') && r.method === 'POST');
    postReq.flush({ detail: 'Company name already exists.' }, { status: 409, statusText: 'Conflict' });

    await createPromise;
    fixture.detectChanges();

    expect(notificationService.error).toHaveBeenCalledWith('Company name already exists.');
    expect(fixture.componentInstance.showCreateModal()).toBe(true);
    httpMock.verify();
  });

  it('shows Add Company for users with legal_entity:create', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read', 'legal_entity:create']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/session/companies'));
    req.flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.company-selector__trigger');
    trigger.click();
    fixture.detectChanges();

    const addItem = fixture.nativeElement.querySelector('.company-selector__item--action');
    expect(addItem).not.toBeNull();
    httpMock.verify();
  });

  it('hides Add Company for users with org:read/org:manage but not legal_entity:create', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read', 'org:manage']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/session/companies'));
    req.flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger).not.toBeNull();
    trigger.click();
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('.company-selector__item');
    expect(items.length).toBeGreaterThan(0); // company rows rendered - confirms we're past loading/error/empty, not just absent for the wrong reason
    const addItem = fixture.nativeElement.querySelector('.company-selector__item--action');
    expect(addItem).toBeNull();
    httpMock.verify();
  });

  it('keeps the current company and shows safe copy when switching is forbidden', async () => {
    const { fixture, legalEntityStore, notificationService, httpMock } = await setup([], []);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/session/companies')).flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();
    vi.spyOn(notificationService, 'error');

    fixture.componentInstance.isOpen.set(true);
    const switchPromise = fixture.componentInstance.selectCompany('comp-2');
    httpMock
      .expectOne((r) => r.url.includes('/session/active-company'))
      .flush({ detail: 'Required permission org:read missing' }, { status: 403, statusText: 'Forbidden' });
    await switchPromise;

    expect(legalEntityStore.selectedLegalEntityId()).toBe('comp-1');
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-1');
    expect(fixture.componentInstance.isOpen()).toBe(true);
    expect(notificationService.error).toHaveBeenCalledWith('You do not have access to perform this action.');
    httpMock.verify();
  });
});
