import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityItem, EmployeeRecentActivityResponse } from '../../models/employee-overview.model';
import { OverviewRecentActivityWidgetComponent } from './overview-recent-activity-widget.component';

describe('OverviewRecentActivityWidgetComponent', () => {
  const item = (id: string, over: Partial<EmployeeActivityItem> = {}): EmployeeActivityItem => ({
    id, kind: 'task_status_changed', action: 'Changed task status', target: 'WEB-12 Fix cart', detail: '→ In review',
    at: '2026-09-16T12:00:00+00:00', ...over
  });

  const firstPage: EmployeeRecentActivityResponse = {
    items: [
      item('a1'),
      item('a2', { kind: 'attendance_clock_in', action: 'Clocked in', target: null, detail: null }),
      item('a3', { kind: 'leave_requested', action: 'Requested leave', target: 'Annual leave', detail: null })
    ],
    nextBefore: '2026-09-15T12:00:00+00:00',
    isPartial: true
  };

  function setup(getOverviewRecentActivity: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewRecentActivityWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewRecentActivity } }]
    });
    const fixture = TestBed.createComponent(OverviewRecentActivityWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const rows = (el: HTMLElement) => el.querySelectorAll('[data-testid="activity-item"]');
  const loadOlder = (el: HTMLElement) => el.querySelector('[data-testid="load-older"]') as HTMLButtonElement | null;

  const popOut = (fixture: { detectChanges(): void }, el: HTMLElement) => {
    (el.querySelector('[data-testid="activity-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  const isOpen = (el: HTMLElement) =>
    el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open');

  it('loads only the newest three on the page, with no cursor', () => {
    const get = vi.fn().mockReturnValue(of(firstPage));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', null, 3);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('lists each item with its action, target, detail and a date', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(firstPage)));

    expect(rows(el)).toHaveLength(3);
    expect(rows(el)[0].textContent).toContain('Changed task status');
    expect(rows(el)[0].textContent).toContain('WEB-12 Fix cart');
    expect(rows(el)[0].textContent).toContain('→ In review');
    expect(rows(el)[0].textContent).toContain('Sep 16');
    expect(rows(el)[1].textContent).toContain('Clocked in');
    expect(rows(el)[2].textContent).toContain('Annual leave');
  });

  it('renders activity as a labelled timeline with a visual marker for each item', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(firstPage)));

    expect(el.querySelector('[data-testid="activity-timeline"]')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="activity-marker"]')).toHaveLength(3);
    // A cursor means there is more on the server than the three loaded.
    expect(el.querySelector('[data-testid="activity-count"]')!.textContent).toContain('3+ updates');
  });

  it('counts exactly when everything is loaded, and offers no pop-out', () => {
    const get = vi.fn().mockReturnValue(of({ ...firstPage, nextBefore: null }));
    const { fixture, el } = setup(get);

    expect(el.querySelector('[data-testid="activity-count"]')!.textContent).toContain('3 updates');
    expect(el.querySelector('[data-testid="activity-toggle"]')).toBeNull();
    (el.querySelector('app-widget-card') as HTMLElement).click();
    fixture.detectChanges();
    expect(isOpen(el)).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('pops out on a card click and continues from the preview cursor - the first three are not refetched', () => {
    const older: EmployeeRecentActivityResponse = { items: [item('b1'), item('b2')], nextBefore: null, isPartial: true };
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(of(older));
    const { fixture, el } = setup(get);

    (el.querySelector('app-widget-card') as HTMLElement).click();
    fixture.detectChanges();

    expect(isOpen(el)).toBe(true);
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-15T12:00:00+00:00', 20);
    expect(rows(el)).toHaveLength(5);

    popOut(fixture, el); // Show less
    expect(isOpen(el)).toBe(false);
    expect(rows(el)).toHaveLength(3);
    popOut(fixture, el); // reopen reuses what is loaded
    expect(rows(el)).toHaveLength(5);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('keeps timestamps top-aligned instead of stretching on rows with details', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(firstPage)));
    const detailedRow = rows(el)[0];

    expect(detailedRow.classList.contains('items-start')).toBe(true);
    expect(detailedRow.querySelector('time')!.classList.contains('self-start')).toBe(true);
  });

  it('always says the feed is partial when the API says so', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(firstPage)));

    expect(el.querySelector('[data-testid="partial-note"]')!.textContent).toContain('Showing key activity');
  });

  it('shows no partial note when the API does not flag the feed as partial', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...firstPage, isPartial: false })));

    expect(el.querySelector('[data-testid="partial-note"]')).toBeNull();
  });

  it('offers to load older activity only inside the popup, and only while a cursor exists', () => {
    const page2: EmployeeRecentActivityResponse = { items: [item('b1')], nextBefore: '2026-09-10T00:00:00+00:00', isPartial: true };
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(of(page2));
    const { fixture, el } = setup(get);
    expect(loadOlder(el)).toBeNull();

    popOut(fixture, el);
    expect(loadOlder(el)).toBeTruthy();
  });

  it('appends the older page, follows the new cursor, and hides the button at the end', () => {
    const older: EmployeeRecentActivityResponse = { items: [item('b1'), item('b2')], nextBefore: null, isPartial: true };
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(of(older));
    const { fixture, el } = setup(get);

    popOut(fixture, el);

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-15T12:00:00+00:00', 20);
    expect(rows(el)).toHaveLength(5);
    expect(loadOlder(el)).toBeNull();
  });

  it('keeps following cursors across several pages', () => {
    const page2: EmployeeRecentActivityResponse = { items: [item('b1')], nextBefore: '2026-09-10T00:00:00+00:00', isPartial: true };
    const page3: EmployeeRecentActivityResponse = { items: [item('c1')], nextBefore: null, isPartial: true };
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(of(page2)).mockReturnValueOnce(of(page3));
    const { fixture, el } = setup(get);

    popOut(fixture, el);
    loadOlder(el)!.click();
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-10T00:00:00+00:00', 20);
    expect(rows(el)).toHaveLength(5);
  });

  it('disables the button while an older page is loading and ignores extra clicks', () => {
    const pending = new Subject<EmployeeRecentActivityResponse>();
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(pending.asObservable());
    const { fixture, el } = setup(get);

    popOut(fixture, el);
    expect(loadOlder(el)!.disabled).toBe(true);

    loadOlder(el)!.click();
    expect(get).toHaveBeenCalledTimes(2);

    pending.next({ items: [item('b1')], nextBefore: null, isPartial: true });
    fixture.detectChanges();
    expect(rows(el)).toHaveLength(4);
  });

  it('shows an error under the list, keeps the items and the button, when loading older activity fails', () => {
    const get = vi.fn().mockReturnValueOnce(of(firstPage)).mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { fixture, el } = setup(get);

    popOut(fixture, el);

    expect(el.querySelector('[data-testid="older-error"]')!.textContent).toContain('Could not load older activity');
    expect(rows(el)).toHaveLength(3);
    expect(loadOlder(el)).toBeTruthy();
    expect(loadOlder(el)!.disabled).toBe(false);
  });

  it('shows the empty state when there is no recorded activity', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ items: [], nextBefore: null, isPartial: true })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403 and an error state with retry on other failures', () => {
    const forbidden = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    expect(forbidden.el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();

    TestBed.resetTestingModule();
    const get = vi.fn().mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 }))).mockReturnValueOnce(of(firstPage));
    const failed = setup(get);
    (failed.el.querySelector('app-error-state button') as HTMLButtonElement).click();
    failed.fixture.detectChanges();

    expect(get).toHaveBeenCalledTimes(2);
    expect(rows(failed.el)).toHaveLength(3);
  });
});
