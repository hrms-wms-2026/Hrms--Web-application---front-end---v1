import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@environments/environment';
import { NotificationApiService, NotificationDto } from './notification-api.service';

describe('NotificationApiService', () => {
  let service: NotificationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(NotificationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMine fetches notifications with query params', () => {
    const mock: NotificationDto[] = [{
      id: 'n1', templateCode: 'work_task_creation_request_created', title: 'New request',
      body: 'body', relatedEntityType: 'task_creation_request', relatedEntityId: 'r1',
      isRead: false, readAt: null, createdAt: '2026-08-17T00:00:00Z'
    }];

    service.getMine(true, 1).subscribe((res) => expect(res).toEqual(mock));

    const req = httpMock.expectOne(
      `${environment.apiUrl}/notifications?unreadOnly=true&page=1`
    );
    expect(req.request.method).toBe('GET');
    req.flush(mock);
  });

  it('getUnreadCount returns count', () => {
    service.getUnreadCount().subscribe((res) => expect(res).toEqual({ count: 3 }));
    const req = httpMock.expectOne(`${environment.apiUrl}/notifications/unread-count`);
    expect(req.request.method).toBe('GET');
    req.flush({ count: 3 });
  });

  it('markRead posts to the notification id', () => {
    service.markRead('n1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/notifications/n1/read`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
