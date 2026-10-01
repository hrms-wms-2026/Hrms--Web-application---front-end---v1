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
    ]
  };

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

    expect(get).toHaveBeenCalledWith('emp-1', 14);
  });

  it('lists each item with its title and a kind chip, in the order returned', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="upcoming-item"]');

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('v2.0');
    expect(rows[0].querySelector('[data-testid="upcoming-chip"]')!.textContent).toContain('Release');
    expect(rows[1].querySelector('[data-testid="upcoming-chip"]')!.textContent).toContain('Calendar');
    expect(rows[2].querySelector('[data-testid="upcoming-chip"]')!.textContent).toContain('Approved');
  });

  it('shows the date for all-day items and the detail line when present', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="upcoming-item"]');

    expect(rows[0].textContent).toContain('Oct 1');
    expect(rows[0].textContent).toContain('Website');
    expect(rows[2].textContent).toContain('Oct 6 – 8');
  });

  it('tags each chip with its kind class', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const chips = el.querySelectorAll('[data-testid="upcoming-chip"]');

    expect(chips[0].classList.contains('chip--release')).toBe(true);
    expect(chips[1].classList.contains('chip--calendar')).toBe(true);
    expect(chips[2].classList.contains('chip--leave')).toBe(true);
  });

  it('shows the empty state when nothing is coming up', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, items: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('Nothing coming up');
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
