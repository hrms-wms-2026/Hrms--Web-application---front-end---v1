import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PeopleApiService } from '../../../../people/data-access/people-api.service';
import { MeetingListItem, MeetingStatus } from '../../models/meeting.models';
import { MeetingCardComponent } from './meeting-card.component';

describe('MeetingCardComponent', () => {
  let fixture: ComponentFixture<MeetingCardComponent>;

  const item = (over: Partial<MeetingListItem> = {}): MeetingListItem => ({
    taskId: 't1', shortId: 'ACME-M12', seriesId: 's1', originalStart: '2026-11-02T03:30:00Z', startAt: '2026-11-02T03:30:00Z',
    endAt: '2026-11-02T04:00:00Z', isAllDay: false, title: 'Weekly delivery sync', status: 'scheduled', isPrivate: false,
    projectId: 'p1', objectiveId: 'o1', myRole: 'attendee', myResponse: 'accepted', ...over,
  });
  const testId = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  function build(value: MeetingListItem, variant: 'card' | 'row' = 'card'): void {
    fixture = TestBed.createComponent(MeetingCardComponent);
    fixture.componentRef.setInput('item', value);
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({}));

  it('status pill follows status', () => {
    const labels: Record<MeetingStatus, string> = {
      scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled',
    };
    for (const [status, label] of Object.entries(labels) as [MeetingStatus, string][]) {
      build(item({ status }));
      expect(testId('meeting-card-status')?.textContent?.trim()).toBe(label);
      expect(testId('meeting-card-status')?.getAttribute('data-status')).toBe(status);
    }
  });

  it('shows the title, the ShortId and my response', () => {
    build(item({ myResponse: 'rejected' }));
    expect(testId('meeting-card-title')?.textContent?.trim()).toBe('Weekly delivery sync');
    expect(testId('meeting-card-shortid')?.textContent?.trim()).toBe('ACME-M12');
    expect(testId('meeting-card-response')?.textContent?.trim()).toBe('Declined');
  });

  it('reads "Private meeting" when a private item comes without a role (defensive)', () => {
    build(item({ isPrivate: true, myRole: undefined as unknown as MeetingListItem['myRole'] }));
    expect(testId('meeting-card-title')?.textContent?.trim()).toBe('Private meeting');
  });

  it('opens by series and original start', () => {
    build(item());
    let opened: unknown;
    fixture.componentInstance.open.subscribe((key) => (opened = key));
    testId('meeting-card')!.click();
    expect(opened).toEqual({ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' });
  });

  it('a tree row carries the "M" badge', () => {
    build(item(), 'row');
    expect(testId('meeting-card-badge')?.textContent?.trim()).toBe('M');
  });

  it('a board card carries the "M" badge too, so it reads as a meeting among the task cards', () => {
    build(item(), 'card');
    expect(testId('meeting-card-badge')?.textContent?.trim()).toBe('M');
  });

  it('a tree row uses the task row columns and indents by depth like a task row', () => {
    fixture = TestBed.createComponent(MeetingCardComponent);
    fixture.componentRef.setInput('item', item());
    fixture.componentRef.setInput('variant', 'row');
    fixture.componentRef.setInput('depth', 2);
    fixture.detectChanges();
    expect(testId('meeting-card')?.className).toContain('grid-cols-[1fr_112px_40px_88px_140px]');
    expect(testId('meeting-card-name-cell')?.style.paddingLeft).toBe('40px');
    // The start's local date, in the YYYY-MM-DD form the task rows use.
    const start = new Date('2026-11-02T03:30:00Z');
    const local = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    expect(testId('meeting-card-date')?.textContent?.trim()).toBe(local);
  });

  it('a tree row shows the organiser in the assignee column, and "—" when the API sends none', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PeopleApiService, useValue: { getEmployeeIdentity: vi.fn().mockReturnValue(of({ id: 'e9', name: 'Priya K', avatarFileId: null })) } }]
    });
    build(item({ organizerEmployeeId: 'e9' }), 'row');
    expect(testId('meeting-card-organizer')?.querySelector('app-employee-avatar')).not.toBeNull();

    build(item(), 'row');
    expect(testId('meeting-card-organizer')?.querySelector('app-employee-avatar')).toBeNull();
    expect(testId('meeting-card-organizer')?.textContent?.trim()).toBe('—');
  });

  it('a tree row has a view button that opens the meeting once', () => {
    build(item(), 'row');
    const opened: unknown[] = [];
    fixture.componentInstance.open.subscribe((key) => opened.push(key));
    testId('meeting-card-view')!.click();
    expect(opened).toEqual([{ seriesId: 's1', originalStart: '2026-11-02T03:30:00Z' }]);
  });
});
