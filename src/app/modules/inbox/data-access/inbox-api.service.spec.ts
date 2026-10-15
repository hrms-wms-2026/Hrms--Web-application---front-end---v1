import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../environments/environment';
import { InboxApiService } from './inbox-api.service';
import { ConversationsApiService } from './conversations-api.service';

describe('Inbox data-access', () => {
  let http: HttpTestingController;
  let inbox: InboxApiService;
  let conversations: ConversationsApiService;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    inbox = TestBed.inject(InboxApiService);
    conversations = TestBed.inject(ConversationsApiService);
  });

  afterEach(() => http.verify());

  it('lists with repeated keys for multi-value filters and facet=key:value', () => {
    inbox.list({ category: ['request'], status: ['pending', 'open'], project: ['p1'], facets: { module: ['m1', 'm2'] }, search: ' budget ', page: 2, pageSize: 10 }).subscribe();

    const req = http.expectOne((r) => r.url === `${base}/inbox`);
    expect(req.request.params.getAll('category')).toEqual(['request']);
    expect(req.request.params.getAll('status')).toEqual(['pending', 'open']);
    expect(req.request.params.getAll('project')).toEqual(['p1']);
    expect(req.request.params.getAll('facet')).toEqual(['module:m1', 'module:m2']);
    expect(req.request.params.get('search')).toBe('budget');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush({ items: [], total: 0, page: 2, pageSize: 10 });
  });

  it('reads the kinds, pages the history with its filters, and posts a bulk action', () => {
    inbox.kinds().subscribe();
    http.expectOne(`${base}/inbox/kinds`).flush([]);

    inbox.history({ source: 'leave', from: '2026-10-01T00:00:00.000Z', page: 2, pageSize: 10 }).subscribe();
    const history = http.expectOne((r) => r.url === `${base}/inbox/history`);
    expect(history.request.params.get('source')).toBe('leave');
    expect(history.request.params.get('from')).toBe('2026-10-01T00:00:00.000Z');
    expect(history.request.params.get('kind')).toBeNull();
    expect(history.request.params.get('page')).toBe('2');
    history.flush({ items: [], total: 0, page: 2, pageSize: 10 });

    const body = { action: 'approve', items: [{ source: 'leave', kind: 'request', id: 'l1' }], comment: null, outcome: null };
    inbox.bulk(body).subscribe();
    const bulk = http.expectOne(`${base}/inbox/bulk`);
    expect(bulk.request.method).toBe('POST');
    expect(bulk.request.body).toEqual(body);
    bulk.flush({ succeeded: [], failed: [] });
  });

  it('omits empty filters', () => {
    inbox.list({ category: [], search: '  ', from: null }).subscribe();
    const req = http.expectOne((r) => r.url === `${base}/inbox`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], total: 0, page: 1, pageSize: 25 });
  });

  it('reads filters, counts and item detail', () => {
    inbox.filters().subscribe();
    inbox.counts().subscribe();
    inbox.detail({ source: 'work', kind: 'approval', id: 'a1' }).subscribe();
    http.expectOne(`${base}/inbox/filters`).flush([]);
    http.expectOne(`${base}/inbox/counts`).flush({ pendingReceived: 0, unreadMessages: 0, openAlerts: 0 });
    http.expectOne(`${base}/inbox/work/approval/a1`).flush({});
  });

  it('posts an action with its body', () => {
    inbox.runAction({ source: 'work', kind: 'approval', id: 'a1' }, 'reject', { comment: 'no' }).subscribe();
    const req = http.expectOne(`${base}/inbox/work/approval/a1/actions/reject`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ comment: 'no' });
    req.flush({ affectedEmployeeIds: [], message: null });
  });

  it('opens a conversation, pages messages, posts, adds members and marks read', () => {
    conversations.open({ source: 'work', kind: 'approval', id: 'a1' }).subscribe();
    conversations.messages('c1', '2026-10-13T09:00:00Z').subscribe();
    conversations.post('c1', '<p>hi</p>', ['e1']).subscribe();
    conversations.addParticipants('c1', ['e2']).subscribe();
    conversations.markRead('c1').subscribe();

    expect(http.expectOne(`${base}/conversations/open`).request.body).toEqual({ source: 'work', kind: 'approval', id: 'a1' });
    const older = http.expectOne((r) => r.url === `${base}/conversations/c1/messages` && r.method === 'GET');
    expect(older.request.params.get('before')).toBe('2026-10-13T09:00:00Z');
    expect(http.expectOne((r) => r.url === `${base}/conversations/c1/messages` && r.method === 'POST').request.body)
      .toEqual({ bodyHtml: '<p>hi</p>', mentionEmployeeIds: ['e1'] });
    expect(http.expectOne(`${base}/conversations/c1/participants`).request.body).toEqual({ employeeIds: ['e2'] });
    expect(http.expectOne(`${base}/conversations/c1/read`).request.method).toBe('POST');
  });

  it('searches colleagues to add through the conversation people lookup', () => {
    let result: unknown;
    conversations.searchPeople('pri').subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === `${base}/conversations/people` && r.method === 'GET');
    expect(req.request.params.get('search')).toBe('pri');
    req.flush([{ employeeId: 'e3', name: 'Priya', avatarFileId: null }]);
    expect(result).toEqual([{ employeeId: 'e3', name: 'Priya', avatarFileId: null }]);
  });
});
