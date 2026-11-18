import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SupportTicketsApiService } from './support-tickets-api.service';
import { environment } from '../../../../environments/environment';

describe('SupportTicketsApiService', () => {
  let service: SupportTicketsApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/support/tickets`;

  const ticketApi = {
    id: 't1',
    subject: 'Payroll export empty',
    description: 'The October export has no rows.',
    status: 'open',
    priority: 'high',
    category: 'payroll',
    created_by_name: 'Anu Owner',
    raised_by_support: false,
    created_at: '2026-11-10T09:00:00Z',
    updated_at: null,
    resolved_at: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SupportTicketsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists tickets with paging and an optional status, mapping snake_case', () => {
    let result: unknown;
    service.list('resolved', 2, 20).subscribe((page) => (result = page));

    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('resolved');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('page_size')).toBe('20');
    req.flush({ items: [ticketApi], total: 21, page: 2, page_size: 20 });

    expect(result).toEqual({
      items: [
        {
          id: 't1',
          subject: 'Payroll export empty',
          description: 'The October export has no rows.',
          status: 'open',
          priority: 'high',
          category: 'payroll',
          createdByName: 'Anu Owner',
          raisedBySupport: false,
          createdAt: '2026-11-10T09:00:00Z',
          updatedAt: null,
          resolvedAt: null
        }
      ],
      total: 21,
      page: 2,
      pageSize: 20
    });
  });

  it('omits the status filter when it is empty', () => {
    service.list('', 1, 20).subscribe();
    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ items: [], total: 0, page: 1, page_size: 20 });
  });

  it('loads one ticket with its conversation and files', () => {
    let subject = '';
    let commentAuthor = '';
    let fileName = '';
    service.get('t1').subscribe((detail) => {
      subject = detail.ticket.subject;
      commentAuthor = detail.comments[0].authorName;
      fileName = detail.attachments[0].fileName;
    });

    http.expectOne(`${base}/t1`).flush({
      ticket: ticketApi,
      comments: [{ id: 'c1', ticket_id: 't1', author_name: 'Priya', is_from_support: true, body: 'On it', created_at: '2026-11-10T10:00:00Z' }],
      attachments: [
        {
          id: 'f1',
          ticket_id: 't1',
          file_name: 'export.xlsx',
          content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size_bytes: 4096,
          uploaded_by_name: 'Anu Owner',
          is_from_support: false,
          created_at: '2026-11-10T09:05:00Z'
        }
      ]
    });

    expect(subject).toBe('Payroll export empty');
    expect(commentAuthor).toBe('Priya');
    expect(fileName).toBe('export.xlsx');
  });

  it('creates a ticket without any tenant id', () => {
    service.create({ subject: 'Login', description: 'Cannot sign in', priority: 'urgent', category: null }).subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ subject: 'Login', description: 'Cannot sign in', priority: 'urgent', category: null });
    req.flush(ticketApi);
  });

  it('edits a ticket with PUT and the create body', () => {
    let subject: string | undefined;
    service
      .update('t1', { subject: 'New subject', description: 'More detail', priority: 'urgent', category: null })
      .subscribe((ticket) => (subject = ticket.subject));
    const req = http.expectOne(`${base}/t1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ subject: 'New subject', description: 'More detail', priority: 'urgent', category: null });
    req.flush({ ...ticketApi, subject: 'New subject' });
    expect(subject).toBe('New subject');
  });

  it('posts a reply with only a body', () => {
    service.addComment('t1', 'Still failing').subscribe();
    const req = http.expectOne(`${base}/t1/comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Still failing' });
    req.flush({ id: 'c2', ticket_id: 't1', author_name: 'Anu', is_from_support: false, body: 'Still failing', created_at: '2026-11-10T11:00:00Z' });
  });

  it('uploads a file as multipart form data', () => {
    const file = new File(['x'], 'screen.png', { type: 'image/png' });
    service.uploadAttachment('t1', file).subscribe();
    const req = http.expectOne(`${base}/t1/attachments`);
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.flush({
      id: 'f2',
      ticket_id: 't1',
      file_name: 'screen.png',
      content_type: 'image/png',
      size_bytes: 1,
      uploaded_by_name: 'Anu',
      is_from_support: false,
      created_at: '2026-11-10T11:00:00Z'
    });
  });

  it('returns the signed download url', () => {
    let url = '';
    service.getDownloadUrl('t1', 'f1').subscribe((value) => (url = value));
    http.expectOne(`${base}/t1/attachments/f1/download-url`).flush({ url: 'https://files.test/signed', expires_at: '2026-11-10T11:05:00Z' });
    expect(url).toBe('https://files.test/signed');
  });
});
