import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ChecklistApiService } from './checklist-api.service';
import {
  ChecklistTemplateDetailResponse,
  ChecklistTemplateListPageResponse,
  CreateChecklistTemplateRequest,
  OnboardingChecklistTemplateMatchResponse,
  UpdateChecklistTemplateRequest
} from '../models/checklist-template.model';

describe('ChecklistApiService', () => {
  let service: ChecklistApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChecklistApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(ChecklistApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listChecklistTemplates sends GET request with correct query params', () => {
    const mockResponse: ChecklistTemplateListPageResponse = {
      items: [
        {
          id: 'tmpl-1',
          name: 'Engineering Onboarding',
          templateType: 'onboarding',
          legalEntityId: 'legal-1',
          departmentId: 'dept-1',
          departmentName: 'Engineering',
          positionId: null,
          positionName: null,
          isActive: true,
          taskCount: 3
        }
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25
    };

    service
      .listChecklistTemplates({ legalEntityId: 'legal-1', templateType: 'onboarding', includeInactive: false, page: 1, pageSize: 25 })
      .subscribe((res) => {
        expect(res).toEqual(mockResponse);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/people/checklist-templates` &&
        r.params.get('legalEntityId') === 'legal-1' &&
        r.params.get('templateType') === 'onboarding' &&
        r.params.get('includeInactive') === 'false'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('getChecklistTemplate sends GET request to endpoint by id', () => {
    const mockDetail: ChecklistTemplateDetailResponse = {
      id: 'tmpl-1',
      name: 'Engineering Onboarding',
      templateType: 'onboarding',
      legalEntityId: 'legal-1',
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      positionId: null,
      positionName: null,
      isActive: true,
      tasks: [
        {
          title: 'Setup Laptop',
          ownerType: 'it',
          assignedToId: 'user-1',
          dueOffsetDays: 0,
          sequence: 1,
          isRequired: true,
          isBypassable: false,
          bypassPenaltyDescription: null,
          category: null
        }
      ]
    };

    service.getChecklistTemplate('tmpl-1').subscribe((res) => {
      expect(res).toEqual(mockDetail);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetail);
  });

  it('createChecklistTemplate sends POST request with exact payload and Idempotency-Key header', () => {
    const payload: CreateChecklistTemplateRequest = {
      name: 'New Template',
      templateType: 'onboarding',
      legalEntityId: 'legal-1',
      tasks: [
        {
          title: 'Read Handbook',
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

    service.createChecklistTemplate(payload).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Idempotency-Key')).toBe(true);
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'tmpl-new', ...payload, departmentId: null, positionId: null, isActive: true, createdAt: '2026-08-13' });
  });

  it('updateChecklistTemplate sends PUT request to endpoint', () => {
    const payload: UpdateChecklistTemplateRequest = {
      name: 'Updated Template',
      departmentId: 'dept-1',
      tasks: []
    };

    service.updateChecklistTemplate('tmpl-1', payload).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'tmpl-1', ...payload, templateType: 'onboarding', legalEntityId: 'legal-1', isActive: true });
  });

  it('archiveChecklistTemplate sends POST request to archive endpoint', () => {
    service.archiveChecklistTemplate('tmpl-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1/archive`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('getOnboardingMatches sends GET request to matches endpoint with legalEntityId, departmentId, positionId and returns typed matches', () => {
    const mockMatches: readonly OnboardingChecklistTemplateMatchResponse[] = [
      { id: 'tmpl-1', name: 'Company Default Onboarding', matchLevel: 'company', departmentId: null, positionId: null }
    ];

    service
      .getOnboardingMatches({ legalEntityId: 'legal-1', departmentId: 'dept-1', positionId: 'pos-1' })
      .subscribe((res) => {
        expect(res).toEqual(mockMatches);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/onboarding/checklist-templates/matches` &&
        r.params.get('legalEntityId') === 'legal-1' &&
        r.params.get('departmentId') === 'dept-1' &&
        r.params.get('positionId') === 'pos-1'
    );
    expect(req.request.method).toBe('GET');
    req.flush(mockMatches);
  });
});
