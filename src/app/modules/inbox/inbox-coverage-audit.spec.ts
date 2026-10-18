import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ApprovalDelegatesApiService } from './data-access/approval-delegates-api.service';
import { InboxCapability, hasCapability } from './models/inbox.dto';
import { pick } from './renderers/renderer.util';

/** FZ coverage audit: the small pieces the feature specs only reach indirectly. */
describe('inbox coverage audit (FZ)', () => {
  it('hasCapability needs every bit of the flag and a descriptor', () => {
    const descriptor = { source: 'leave', kind: 'request', label: 'Leave', category: 'request' as const, capabilities: InboxCapability.Chat | InboxCapability.Bulk, detailRenderer: null };
    expect(hasCapability(descriptor, InboxCapability.Bulk)).toBe(true);
    expect(hasCapability(descriptor, InboxCapability.Revert)).toBe(false);
    expect(hasCapability(null, InboxCapability.Chat)).toBe(false);
  });

  it('pick reads camelCase, then PascalCase, and treats null/undefined/non-objects as missing', () => {
    expect(pick({ title: 'a' }, 'title')).toBe('a');
    expect(pick({ Title: 'b' }, 'title')).toBe('b');
    expect(pick({ title: null }, 'title')).toBeNull();
    expect(pick('text', 'title')).toBeNull();
    expect(pick(null, 'title')).toBeNull();
    expect(pick({ count: 0 }, 'count')).toBe(0);
  });

  describe('ApprovalDelegatesApiService', () => {
    let http: HttpTestingController;
    let api: ApprovalDelegatesApiService;
    const base = `${environment.apiUrl}/leave/approval-delegates`;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
      http = TestBed.inject(HttpTestingController);
      api = TestBed.inject(ApprovalDelegatesApiService);
    });

    afterEach(() => http.verify());

    it('lists, creates and removes covers', () => {
      api.list().subscribe();
      api.create({ delegateEmployeeId: 'e1', startDate: '2026-11-01', endDate: '2026-11-05' }).subscribe();
      api.remove('d 1').subscribe();

      expect(http.expectOne((r) => r.url === base && r.method === 'GET')).toBeTruthy();
      expect(http.expectOne((r) => r.url === base && r.method === 'POST').request.body)
        .toEqual({ delegateEmployeeId: 'e1', startDate: '2026-11-01', endDate: '2026-11-05' });
      expect(http.expectOne(`${base}/d%201`).request.method).toBe('DELETE');
    });
  });
});
