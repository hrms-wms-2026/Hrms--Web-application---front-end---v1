import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { TaskCommentApiService } from './task-comment-api.service';

describe('TaskCommentApiService', () => {
  let service: TaskCommentApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TaskCommentApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TaskCommentApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getComments GETs the task comments route', () => {
    service.getComments('task-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/task-1/comments`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('postComment POSTs to the task comments route', () => {
    service.postComment('task-1', { content: 'hi', attachmentFileIds: [] }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/task-1/comments`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('postReply POSTs to the replies route', () => {
    service.postReply('comment-1', { content: 'reply', attachmentFileIds: [] }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/comments/comment-1/replies`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('editComment PATCHes the comment route', () => {
    service.editComment('comment-1', { content: 'edited', attachmentFileIds: [] }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/comments/comment-1`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deleteComment DELETEs the comment route', () => {
    service.deleteComment('comment-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/comments/comment-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('addReaction POSTs to the reactions route', () => {
    service.addReaction('comment-1', '👍').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/comments/comment-1/reactions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ emoji: '👍' });
    req.flush(null);
  });

  it('removeReaction DELETEs the specific emoji route', () => {
    service.removeReaction('comment-1', '👍').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/comments/comment-1/reactions/${encodeURIComponent('👍')}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
