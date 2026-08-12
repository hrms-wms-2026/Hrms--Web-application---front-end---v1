import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ProjectApiService } from './project-api.service';
import { ProjectDetailDto, ProjectListItemDto, PagedResultDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto, EditObjectiveRequestDto, ObjectiveTreeItemDto, CreateObjectiveRequestDto } from '../models/dto/milestone.dto';

describe('ProjectApiService', () => {
  let service: ProjectApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProjectApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists my projects with paging params', () => {
    const page: PagedResultDto<ProjectListItemDto> = {
      items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false
    };
    service.listMine(1, 20).subscribe((res) => expect(res).toEqual(page));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/mine?pageNumber=1&pageSize=20`);
    expect(req.request.method).toBe('GET');
    req.flush(page);
  });

  it('gets a project by id', () => {
    const dto = { id: 'p1' } as ProjectDetailDto;
    service.getById('p1').subscribe((res) => expect(res).toEqual(dto));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1`);
    expect(req.request.method).toBe('GET');
    req.flush(dto);
  });

  it('creates a project via multipart/form-data', () => {
    const response = { project: { id: 'p1', name: 'Website Revamp' } };
    service.create({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: 'Rebuild',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '#2563EB',
      actualHours: 0, defaultObjectiveAllocatedHours: 40, logoFile: null
    }).subscribe((res) => expect(res).toEqual(response));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('name')).toBe('Website Revamp');
    expect((req.request.body as FormData).get('logo')).toBeNull();
    req.flush(response);
  });

  it('includes the logo file in the multipart request when provided', () => {
    const response = { project: { id: 'p1', name: 'Website Revamp' } };
    const logoFile = new File(['fake'], 'logo.png', { type: 'image/png' });
    service.create({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: 'Rebuild',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '#2563EB',
      actualHours: 0, defaultObjectiveAllocatedHours: 40, logoFile
    }).subscribe((res) => expect(res).toEqual(response));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects`);
    expect((req.request.body as FormData).get('logo')).toBe(logoFile);
    req.flush(response);
  });

  it('edits a project', () => {
    const dto = { id: 'p1', name: 'Website Revamp v2' } as ProjectDetailDto;
    const payload = {
      name: 'Website Revamp v2', description: 'Rebuild', categoryId: 'cat1',
      startDate: '2026-08-01', targetDate: '2027-01-01', color: '#2563EB', actualHours: 12
    };
    service.edit('p1', payload).subscribe((res) => expect(res).toEqual(dto));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(dto);
  });

  it('deletes a project', () => {
    service.delete('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('achieves a project', () => {
    service.achieve('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/achieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('unachieves a project', () => {
    service.unachieve('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/unachieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('gets my milestones for a project', () => {
    const milestones: MyProjectMilestoneDto[] = [];
    service.getMyMilestones('p1').subscribe((res) => expect(res).toEqual(milestones));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/objectives/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(milestones);
  });

  it('gets an objective by id', () => {
    const dto = { id: 'o1', title: 'Design Phase' } as ObjectiveDetailDto;
    service.getObjectiveById('o1').subscribe((res) => expect(res).toEqual(dto));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1`);
    expect(req.request.method).toBe('GET');
    req.flush(dto);
  });

  it('edits an objective and reports the applied-immediately status', () => {
    const dto = { id: 'o1', title: 'Design Phase v2' } as ObjectiveDetailDto;
    const payload: EditObjectiveRequestDto = {
      title: 'Design Phase v2', description: 'Updated scope', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    };
    service.editObjective('o1', payload).subscribe((res) => {
      expect(res.status).toBe(200);
      expect(res.body).toEqual(dto);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(dto, { status: 200, statusText: 'OK' });
  });

  it('edits an objective and reports the pending-approval status', () => {
    const payload: EditObjectiveRequestDto = {
      title: 'Design Phase v2', description: 'Updated scope', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    };
    service.editObjective('o1', payload).subscribe((res) => expect(res.status).toBe(202));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1`);
    req.flush({ id: 'cr1', status: 'pending' }, { status: 202, statusText: 'Accepted' });
  });

  it('achieves an objective', () => {
    service.achieveObjective('o1').subscribe((res) => expect(res.status).toBe(204));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1/achieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('unachieves an objective', () => {
    service.unachieveObjective('o1').subscribe((res) => expect(res.status).toBe(204));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1/unachieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('gets a milestone subtree', () => {
    const response = { parentObjective: null, objective: { id: 'o1' } } as unknown as ObjectiveSubtreeResponseDto;
    service.getMilestoneSubtree('o1').subscribe((res) => expect(res).toEqual(response));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1/tree`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('getObjectiveTreeFlat GETs the flat project tree', () => {
    let result: ObjectiveTreeItemDto[] | undefined;
    service.getObjectiveTreeFlat('p1').subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/objectives`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'o1', parentObjectiveId: null, isDefault: true, title: 'Root', ownerId: 'u1', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false }]);

    expect(result?.[0].isDefault).toBe(true);
  });

  it('createObjective POSTs to /work/objectives', () => {
    const payload: CreateObjectiveRequestDto = {
      parentObjectiveId: 'o1', title: 'Design Phase', description: null,
      startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
    };
    let result: ObjectiveDetailDto | undefined;
    service.createObjective(payload).subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'o2', title: 'Design Phase' } as ObjectiveDetailDto);

    expect(result?.id).toBe('o2');
  });
});
