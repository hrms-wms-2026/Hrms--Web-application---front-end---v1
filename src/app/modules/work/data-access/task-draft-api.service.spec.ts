import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TaskDraftApiService } from './task-draft-api.service';

describe('TaskDraftApiService', () => {
  let service: TaskDraftApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TaskDraftApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the caller\'s drafts', () => {
    service.list().subscribe((items) => expect(items).toEqual([]));
    const req = httpMock.expectOne((r) => r.method === 'GET' && r.url.endsWith('/work/task-drafts'));
    req.flush([]);
  });

  it('parses payloadJson on get and sends payload as an object on create/update', () => {
    const payload = { version: 1, description: '<p>x</p>' } as never;
    service.get('d1').subscribe((d) => expect(d.payload).toEqual(payload));
    httpMock.expectOne((r) => r.url.endsWith('/work/task-drafts/d1'))
      .flush({ id: 'd1', projectId: 'p', title: 't', payloadJson: JSON.stringify(payload), updatedAt: '2026-09-29T00:00:00Z' });

    service.create('p', 't', payload).subscribe();
    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/work/task-drafts'));
    expect(post.request.body).toEqual({ projectId: 'p', title: 't', payload });
    post.flush({ id: 'd2', projectId: 'p', title: 't', payloadJson: '{}', updatedAt: '' });

    service.update('d2', 'p', 't2', payload).subscribe();
    const put = httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/work/task-drafts/d2'));
    expect(put.request.body).toEqual({ projectId: 'p', title: 't2', payload });
    put.flush({ id: 'd2', projectId: 'p', title: 't2', payloadJson: '{}', updatedAt: '' });

    service.remove('d2').subscribe();
    httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/work/task-drafts/d2')).flush(null);
  });
});
