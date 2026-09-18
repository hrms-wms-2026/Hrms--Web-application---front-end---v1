import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ProjectCategoryApiService } from './project-category-api.service';
import { ProjectCategoryDto } from '../models/dto/project-category.dto';

describe('ProjectCategoryApiService', () => {
  let service: ProjectCategoryApiService;
  let httpMock: HttpTestingController;

  const mockCategories: ProjectCategoryDto[] = [
    { id: 'cat1', name: 'Backend' },
    { id: 'cat2', name: 'Marketing' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectCategoryApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProjectCategoryApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches the project category list', () => {
    service.list().subscribe((categories) => expect(categories).toEqual(mockCategories));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/project-categories`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCategories);
  });

  it('creates a project category', () => {
    const created: ProjectCategoryDto = { id: 'cat3', name: 'Design' };
    service.create('Design').subscribe((category) => expect(category).toEqual(created));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/project-categories`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Design' });
    req.flush(created);
  });
});
