import { TestBed } from '@angular/core/testing';
import { EmployeeUpcomingItem } from '../../models/employee-overview.model';
import { UpcomingItemDetailComponent } from './upcoming-item-detail.component';

describe('UpcomingItemDetailComponent', () => {
  const meeting: EmployeeUpcomingItem = {
    kind: 'calendar',
    title: 'Project demo preview',
    start: '2026-10-02T09:00:00+00:00',
    end: '2026-10-02T10:00:00+00:00',
    isAllDay: false,
    detail: 'Teams',
    description: 'Walk through the sprint demo',
    meetingLink: 'https://teams.example/meet',
    organizerName: 'Grace Hopper',
    participants: ['Alice Smith', 'Bob Lee']
  };

  function setup(item: EmployeeUpcomingItem | null) {
    TestBed.configureTestingModule({ imports: [UpcomingItemDetailComponent] });
    const fixture = TestBed.createComponent(UpcomingItemDetailComponent);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';

  it('renders nothing while no item is selected', () => {
    const { el } = setup(null);

    expect(el.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows a calendar event with its time range, link, organizer, participants and description', () => {
    const { el } = setup(meeting);

    expect(el.querySelector('[role="dialog"]')!.textContent).toContain('Project demo preview');
    expect(text(el, 'upcoming-detail-kind')).toContain('Calendar event');
    expect(text(el, 'upcoming-detail-date')).toContain('2026');
    expect(text(el, 'upcoming-detail-time')).toMatch(/\d{2}:\d{2} – \d{2}:\d{2}/);
    expect(el.querySelector('[data-testid="upcoming-detail-link"]')!.getAttribute('href')).toBe('https://teams.example/meet');
    expect(el.textContent).toContain('Grace Hopper');
    expect(el.querySelectorAll('[data-testid="upcoming-detail-participants"] li')).toHaveLength(2);
    expect(text(el, 'upcoming-detail-description')).toContain('sprint demo');
  });

  it('never makes a non-http meeting link clickable', () => {
    const { el } = setup({ ...meeting, meetingLink: 'javascript:alert(1)' });

    expect(el.querySelector('[data-testid="upcoming-detail-link"]')).toBeNull();
  });

  it('shows approved leave as an all-day range with its hours', () => {
    const { el } = setup({
      kind: 'leave', title: 'Annual leave', start: '2026-10-06T00:00:00+00:00', end: '2026-10-08T23:59:59+00:00',
      isAllDay: true, detail: 'Approved', hours: 24
    });

    expect(text(el, 'upcoming-detail-date')).toContain('Oct 6');
    expect(text(el, 'upcoming-detail-date')).toContain('Oct 8');
    expect(text(el, 'upcoming-detail-time')).toContain('All day');
    expect(text(el, 'upcoming-detail-hours')).toContain('24 h');
  });

  it('emits closed from the close button', () => {
    const { fixture, el } = setup(meeting);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    (el.querySelector('button[aria-label="Close"]') as HTMLButtonElement).click();

    expect(closed).toHaveBeenCalled();
  });
});
