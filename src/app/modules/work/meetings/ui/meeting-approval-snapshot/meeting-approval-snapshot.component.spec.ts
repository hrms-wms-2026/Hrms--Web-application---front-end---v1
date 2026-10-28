import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { MeetingApprovalSnapshot } from '../../models/meeting.models';
import { MeetingApprovalSnapshotComponent } from './meeting-approval-snapshot.component';

describe('MeetingApprovalSnapshotComponent', () => {
  let fixture: ComponentFixture<MeetingApprovalSnapshotComponent>;
  const snapshot: MeetingApprovalSnapshot = {
    title: 'Design review', description: 'Walk through the new flows', start: '2026-11-02T03:30:00Z', durationMinutes: 45,
    timezone: 'Asia/Colombo', recurrenceSummary: 'Every week on Monday', organizerName: 'Bala K.', modulePath: 'Apollo / Design',
    participantNames: ['Anu S.', 'Priya K.'], guestEmails: ['client@example.com'], platform: 'zoom',
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(MeetingApprovalSnapshotComponent);
  });

  it('renders only the snapshot fields', () => {
    // Anything beyond the D5 snapshot - a link, attendance, action items - must never reach the approver.
    fixture.componentRef.setInput('snapshot', {
      ...snapshot, joinUrl: 'https://zoom.us/j/secret', attendance: 'Joined', actionItems: ['Send minutes'],
    } as unknown as MeetingApprovalSnapshot);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    for (const expected of ['Design review', 'Walk through the new flows', '45 min', 'Asia/Colombo', 'Every week on Monday', 'Bala K.',
      'Apollo / Design', 'Anu S.', 'Priya K.', 'client@example.com', 'Zoom']) {
      expect(text, expected).toContain(expected);
    }
    expect(text).not.toContain('zoom.us/j/secret');
    expect(text).not.toContain('Joined');
    expect(text).not.toContain('Send minutes');
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="snapshot-label"]') as NodeListOf<HTMLElement>)
      .map((el) => el.textContent?.trim());
    expect(labels).toEqual(['Title', 'Agenda', 'When', 'Duration', 'Time zone', 'Repeats', 'Organizer', 'Module', 'Participants', 'Guests', 'Platform']);
  });

  it('reads "No online meeting" when no platform was chosen', () => {
    fixture.componentRef.setInput('snapshot', { ...snapshot, platform: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No online meeting');
  });
});
