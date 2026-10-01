import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeUpcomingResponse } from '../../models/employee-overview.model';
import { OverviewUpcomingWidgetComponent } from './overview-upcoming-widget.component';

describe('OverviewUpcomingWidgetComponent', () => {
  const response: EmployeeUpcomingResponse = {
    from: '2026-09-30',
    to: '2026-10-14',
    items: [
      { kind: 'release', title: 'v2.0', start: '2026-10-01T00:00:00+00:00', end: null, isAllDay: true, detail: 'Website' },
      { kind: 'calendar', title: 'Team meeting', start: '2026-10-03T09:00:00+00:00', end: '2026-10-03T10:00:00+00:00', isAllDay: false, detail: 'Room 4' },
      { kind: 'leave', title: 'Annual leave', start: '2026-10-06T00:00:00+00:00', end: '2026-10-08T23:59:59+00:00', isAllDay: true, detail: 'Approved' }
    ],
    total: 3
  };

  const more: EmployeeUpcomingResponse = {
    ...response,
    total: 5,
    items: [
      ...response.items,
      { kind: 'calendar', title: 'Retro', start: '2026-10-09T09:00:00+00:00', end: '2026-10-09T10:00:00+00:00', isAllDay: false, detail: null },
      { kind: 'calendar', title: 'Planning', start: '2026-10-10T09:00:00+00:00', end: '2026-10-10T10:00:00+00:00', isAllDay: false, detail: null }
    ]
  };

  /** Preview call (limit 4) returns the first three and the total; the full call returns everything. */
  const previewThenFull = () =>
    vi.fn((_id: string, _days: number, limit: number) => of(limit === 4 ? { ...more, items: more.items.slice(0, 4) } : more));

  function setup(getOverviewUpcoming: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewUpcomingWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewUpcoming } }]
    });
    const fixture = TestBed.createComponent(OverviewUpcomingWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the next 14 days for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', 14, 4);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('lists each item with a date tile and its title, in the order returned', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="upcoming-item"]');

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('v2.0');
    const tile = rows[0].querySelector('[data-testid="upcoming-date"]')!;
    expect(tile.textContent).toContain('OCT');
    expect(tile.textContent).toContain('1');
    expect(rows[0].getAttribute('title')).toBe('Release');
    expect(rows[2].getAttribute('title')).toBe('Approved leave');
  });

  it('shows the start time for timed events', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const time = el.querySelectorAll('[data-testid="upcoming-time"]')[1].textContent!;

    expect(time).toMatch(/\d{2}:\d{2}/);
    expect(time).toContain('Room 4');
  });

  it('uses the operations-card frame and fills the row height, like the cards beside it', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const card = el.querySelector('[data-testid="upcoming-card"]')!;

    expect(card.classList.contains('rounded-2xl')).toBe(true);
    expect(card.classList.contains('h-full')).toBe(true);
    expect(el.classList.contains('h-full')).toBe(true);
  });

  it('shows the date for all-day items and the detail line when present', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="upcoming-item"]');

    expect(rows[0].textContent).toContain('All day');
    expect(rows[0].textContent).toContain('Website');
    expect(rows[2].textContent).toContain('Oct 6 – 8');
  });

  it('tints each date tile by kind', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const tiles = el.querySelectorAll('[data-testid="upcoming-date"]');

    expect(tiles[0].classList.contains('date-tile--release')).toBe(true);
    expect(tiles[1].classList.contains('date-tile--calendar')).toBe(true);
    expect(tiles[2].classList.contains('date-tile--leave')).toBe(true);
  });

  it('opens the item detail popup in place when a row is clicked, and closes it again', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll<HTMLButtonElement>('[data-testid="upcoming-item"]');

    expect(rows[1].querySelector('[data-testid="upcoming-chevron"]')).toBeTruthy();
    expect(el.querySelector('[role="dialog"]')).toBeNull();

    rows[1].click();
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')!.textContent).toContain('Team meeting');

    (el.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows no View all and does not pop out when the preview already holds everything', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, el } = setup(get);

    (el.querySelector('[data-testid="upcoming-card"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="upcoming-toggle"]')).toBeNull();
    expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('pops out on a card click and fetches the full list once, reusing it when reopened', () => {
    const get = previewThenFull();
    const { fixture, el } = setup(get);
    expect(el.querySelectorAll('[data-testid="upcoming-item"]')).toHaveLength(4);
    expect(el.querySelector('[data-testid="upcoming-toggle"]')!.textContent).toContain('View all (5)');

    (el.querySelector('[data-testid="upcoming-card"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(true);
    expect(get).toHaveBeenLastCalledWith('emp-1', 14, 50);
    expect(el.querySelectorAll('[data-testid="upcoming-item"]')).toHaveLength(5);

    (el.querySelector('[data-testid="upcoming-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid="upcoming-item"]')).toHaveLength(4);

    (el.querySelector('[data-testid="upcoming-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('[data-testid="upcoming-item"]')).toHaveLength(5);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('opens an item without popping the card out or fetching anything', () => {
    const get = previewThenFull();
    const { fixture, el } = setup(get);

    (el.querySelectorAll('[data-testid="upcoming-item"]')[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open')).toBe(false);
    expect(el.querySelector('[data-testid="upcoming-detail"]')).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('never shows more than four on the card, even if the API returns more', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(more)));

    expect(el.querySelectorAll('[data-testid="upcoming-item"]')).toHaveLength(4);
    expect(el.querySelector('[data-testid="upcoming-toggle"]')!.textContent).toContain('View all (5)');
  });

  it('shows the empty state when nothing is coming up', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, items: [], total: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('Nothing coming up');
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
