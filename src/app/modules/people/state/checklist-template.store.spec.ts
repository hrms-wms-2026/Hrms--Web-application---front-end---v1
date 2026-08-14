import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';
import { ChecklistTemplateStore } from './checklist-template.store';

describe('ChecklistTemplateStore', () => {
  let store: InstanceType<typeof ChecklistTemplateStore>;
  let httpMock: HttpTestingController;
  let notificationService: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChecklistTemplateStore,
        NotificationService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    store = TestBed.inject(ChecklistTemplateStore);
    httpMock = TestBed.inject(HttpTestingController);
    notificationService = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('initial state has empty templates and idle flags', () => {
    expect(store.templates()).toEqual([]);
    expect(store.totalCount()).toBe(0);
    expect(store.loading()).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('loadTemplates fetches list and updates state on success', async () => {
    const promise = store.loadTemplates({ legalEntityId: 'legal-1', page: 1, pageSize: 25 });
    expect(store.loading()).toBe(true);

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    req.flush({
      items: [
        {
          id: 'tmpl-1',
          name: 'Onboarding General',
          templateType: 'onboarding',
          legalEntityId: 'legal-1',
          departmentId: null,
          departmentName: null,
          positionId: null,
          positionName: null,
          isActive: true,
          taskCount: 2
        }
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25
    });

    await promise;
    expect(store.loading()).toBe(false);
    expect(store.templates().length).toBe(1);
    expect(store.templates()[0].name).toBe('Onboarding General');
  });

  it('createTemplate calls API, displays toast notification and reloads templates', async () => {
    const spySuccess = vi.spyOn(notificationService, 'success');

    store.setFilters({ legalEntityId: 'legal-1' });
    const initialGet = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    initialGet.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

    const promise = store.createTemplate({
      name: 'New Template',
      templateType: 'onboarding',
      legalEntityId: 'legal-1',
      tasks: []
    });

    const createReq = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates`);
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ id: 'tmpl-2', name: 'New Template' });

    // Yield to microtasks so loadTemplates() runs after POST completes
    await Promise.resolve();

    const listReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    listReq.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

    const success = await promise;
    expect(success).toBe(true);
    expect(spySuccess).toHaveBeenCalledWith('Checklist template created successfully.');
  });

  it('setFilters with unchanged filters does not call the API again', () => {
    store.setFilters({ legalEntityId: 'legal-1' });
    const initialReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    initialReq.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

    store.setFilters({ legalEntityId: 'legal-1' });

    httpMock.expectNone((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
  });

  it('setFilters with changed templateType calls the API exactly once', () => {
    store.setFilters({ legalEntityId: 'legal-1' });
    const initialReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    initialReq.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

    store.setFilters({ legalEntityId: 'legal-1', templateType: 'onboarding' });

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    httpMock.expectNone((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
  });

  it('setFilters with changed includeInactive calls the API exactly once', () => {
    store.setFilters({ legalEntityId: 'legal-1', includeInactive: false });
    const initialReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    initialReq.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });

    store.setFilters({ legalEntityId: 'legal-1', includeInactive: true });

    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    httpMock.expectNone((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
  });

  it('loadTemplates ignores a stale older response when a newer request is already in flight', async () => {
    const firstLoad = store.loadTemplates({ legalEntityId: 'legal-1', includeInactive: false, page: 1, pageSize: 25 });
    const secondLoad = store.loadTemplates({ legalEntityId: 'legal-1', includeInactive: true, page: 1, pageSize: 25 });

    const requests = httpMock.match((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    expect(requests.length).toBe(2);
    const [staleReq, freshReq] = requests;

    freshReq.flush({
      items: [
        {
          id: 'tmpl-fresh',
          name: 'Fresh',
          templateType: 'onboarding',
          legalEntityId: 'legal-1',
          departmentId: null,
          departmentName: null,
          positionId: null,
          positionName: null,
          isActive: true,
          taskCount: 1
        }
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25
    });
    await secondLoad;

    staleReq.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    await firstLoad;

    expect(store.templates().length).toBe(1);
    expect(store.templates()[0].id).toBe('tmpl-fresh');
  });

  it('loadTemplates does not call the API when legalEntityId is missing', async () => {
    await store.loadTemplates({ legalEntityId: '', includeInactive: false, page: 1, pageSize: 25 });

    httpMock.expectNone((r) => r.url === `${environment.apiUrl}/people/checklist-templates`);
    expect(store.templates()).toEqual([]);
    expect(store.loading()).toBe(false);
  });
});
