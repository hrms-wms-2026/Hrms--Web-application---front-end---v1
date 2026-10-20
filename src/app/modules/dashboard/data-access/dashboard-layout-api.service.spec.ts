import { provideHttpClient, HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { readLayoutProblem } from '../models/dashboard-layout.model';
import { DashboardLayoutApiService } from './dashboard-layout-api.service';

describe('DashboardLayoutApiService', () => {
  const base = `${environment.apiUrl}/dashboards`;
  let service: DashboardLayoutApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DashboardLayoutApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listMine GETs /dashboards/me', () => {
    service.listMine().subscribe();
    const req = http.expectOne(`${base}/me`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('bootstrap GETs with the breakpoint query param', () => {
    service.bootstrap('d1', 'tablet').subscribe();
    const req = http.expectOne(r => r.url === `${base}/d1/bootstrap`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('breakpoint')).toBe('tablet');
    req.flush({});
  });

  it('available GETs with the optional breakpoint param', () => {
    service.available('d1', 'mobile').subscribe();
    const req = http.expectOne(r => r.url === `${base}/d1/widgets/available`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('breakpoint')).toBe('mobile');
    req.flush([]);
  });

  it('available omits the breakpoint param when not given', () => {
    service.available('d1').subscribe();
    const req = http.expectOne(r => r.url === `${base}/d1/widgets/available`);
    expect(req.request.params.has('breakpoint')).toBe(false);
    req.flush([]);
  });

  it('addWidget POSTs widgetKey, expectedVersion and desktopRect', () => {
    const rect = { x: 0, y: 2, w: 4, h: 3 };
    service.addWidget('d1', 'my-tasks', 5, rect).subscribe();
    const req = http.expectOne(`${base}/d1/widgets`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ widgetKey: 'my-tasks', expectedVersion: 5, desktopRect: rect });
    req.flush({ instanceId: 'i1', layoutVersion: 6 });
  });

  it('addWidget omits desktopRect when not given', () => {
    service.addWidget('d1', 'my-tasks', 5).subscribe();
    const req = http.expectOne(`${base}/d1/widgets`);
    expect(req.request.body).toEqual({ widgetKey: 'my-tasks', expectedVersion: 5 });
    req.flush({ instanceId: 'i1', layoutVersion: 6 });
  });

  it('removeWidget DELETEs with expectedVersion as a query param', () => {
    service.removeWidget('d1', 'i1', 7).subscribe();
    const req = http.expectOne(r => r.url === `${base}/d1/widgets/i1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('expectedVersion')).toBe('7');
    req.flush({ layoutVersion: 8 });
  });

  it('saveLayout PUTs expectedVersion and the widget rects flattened', () => {
    service
      .saveLayout('d1', 'desktop', 3, [{ instanceId: 'i1', x: 0, y: 0, w: 4, h: 2 }])
      .subscribe();
    const req = http.expectOne(`${base}/d1/layouts/desktop`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      expectedVersion: 3,
      widgets: [{ instanceId: 'i1', x: 0, y: 0, w: 4, h: 2 }]
    });
    req.flush({ layoutVersion: 4 });
  });

  it('reset POSTs expectedVersion', () => {
    service.reset('d1', 9).subscribe();
    const req = http.expectOne(`${base}/d1/reset`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ expectedVersion: 9 });
    req.flush({ layoutVersion: 10 });
  });

  it('widgetData GETs /dashboard-widgets/{instanceId}/data', () => {
    service.widgetData('i1').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/dashboard-widgets/i1/data`);
    expect(req.request.method).toBe('GET');
    req.flush({ instanceId: 'i1', status: 'success', fetchedAt: null, payload: null });
  });
});

describe('readLayoutProblem', () => {
  it('reads code and currentVersion from a 409 problem body', () => {
    const err = new HttpErrorResponse({
      status: 409,
      error: { code: 'LAYOUT_VERSION_CONFLICT', codes: ['LAYOUT_VERSION_CONFLICT'], currentVersion: 7 }
    });
    expect(readLayoutProblem(err)).toEqual({
      status: 409,
      code: 'LAYOUT_VERSION_CONFLICT',
      codes: ['LAYOUT_VERSION_CONFLICT'],
      currentVersion: 7
    });
  });

  it('returns nulls/empties for a body without code', () => {
    const err = new HttpErrorResponse({ status: 404, error: { detail: 'nope' } });
    expect(readLayoutProblem(err)).toEqual({ status: 404, code: null, codes: [], currentVersion: null });
  });

  it('tolerates a non-object body', () => {
    const err = new HttpErrorResponse({ status: 500, error: 'boom' });
    expect(readLayoutProblem(err).code).toBeNull();
  });
});
