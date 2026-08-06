import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
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

  it('does not render selector for users without org access', async () => {
    const { fixture, httpMock } = await setup([], []);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger).toBeNull();
    httpMock.verify();
  });

  it('renders selector and loads companies when user has org access', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/org/legal-entities'));
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

    const req = httpMock.expectOne((r) => r.url.includes('/org/legal-entities'));
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

    httpMock.expectOne((r) => r.url.includes('/org/legal-entities')).flush(mockCompanies);
    httpMock.verify();
  });

  it('shows an empty state instead of disappearing when there are no companies', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/org/legal-entities')).flush([]);
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

  it('shows an error state instead of disappearing when the legal entity list fails to load', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read']);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url.includes('/org/legal-entities'))
      .flush({ detail: 'Service unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.company-selector__trigger');
    expect(trigger).not.toBeNull();
    expect(trigger.textContent).toContain('Company unavailable');

    trigger.click();
    fixture.detectChanges();
    const status = fixture.nativeElement.querySelector('.company-selector__status--error');
    expect(status).not.toBeNull();
    expect(status.textContent).toContain('Service unavailable');
    httpMock.verify();
  });

  it('emits notification and does not open real create company flow when Add Company is clicked', async () => {
    const { fixture, notificationService, httpMock } = await setup(['org_structure'], ['org:manage', 'legal_entity:create']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/org/legal-entities'));
    req.flush(mockCompanies);
    await fixture.whenStable();
    fixture.detectChanges();

    vi.spyOn(notificationService, 'info');

    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.company-selector__trigger');
    trigger.click();
    fixture.detectChanges();

    const addItem: HTMLButtonElement = fixture.nativeElement.querySelector('.company-selector__item--action');
    addItem.click();
    fixture.detectChanges();

    expect(notificationService.info).toHaveBeenCalledWith('Add Company flow will be available in Part 2D.');
    expect(fixture.componentInstance.isOpen()).toBe(false);
    httpMock.verify();
  });

  it('shows Add Company for users with legal_entity:create', async () => {
    const { fixture, httpMock } = await setup(['org_structure'], ['org:read', 'legal_entity:create']);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/org/legal-entities'));
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

    const req = httpMock.expectOne((r) => r.url.includes('/org/legal-entities'));
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
});
