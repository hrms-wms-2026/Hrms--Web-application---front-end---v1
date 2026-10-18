import { TestBed } from '@angular/core/testing';
import { InboxItemDetailDto } from '../models/inbox.dto';
import { DEFAULT_INBOX_DETAIL_RENDERERS } from './inbox-detail-renderers';
import { LeaveRequestRendererComponent } from './leave-request-renderer.component';

function detail(extra: Partial<InboxItemDetailDto> = {}): InboxItemDetailDto {
  return {
    item: {
      source: 'leave', kind: 'request', id: 'l1', category: 'request', actionType: 'annual', title: 'Annual leave - Pat', subtitle: null,
      status: 'pending', direction: 'received', severity: null, contextType: 'legal_entity', contextId: null, contextName: null,
      requestedBy: null, requestedTo: null, createdAt: '', updatedAt: '', availableActions: [], unreadMessages: 0, isPending: true, facets: {}
    },
    steps: [], summary: null, explanation: 'Family trip', explanationDetails: null, target: null, editablePayloadJson: null,
    changeSet: [{ field: 'balance', label: 'Balance', before: '40', after: '24', kind: 'hours', editable: false, applied: null }],
    ...extra
  };
}

describe('LeaveRequestRendererComponent', () => {
  function render(extra: Record<string, unknown> | null, d = detail()) {
    TestBed.configureTestingModule({ imports: [LeaveRequestRendererComponent] });
    const fixture = TestBed.createComponent(LeaveRequestRendererComponent);
    fixture.componentRef.setInput('extra', extra);
    fixture.componentRef.setInput('detail', d);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return (id: string) => el.querySelector(`[data-testid="${id}"]`)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  }

  afterEach(() => TestBed.resetTestingModule());

  it('is registered as the "leave-request" renderer', () => {
    expect(DEFAULT_INBOX_DETAIL_RENDERERS['leave-request']).toBe(LeaveRequestRendererComponent);
  });

  it('shows the balance impact with the paid/unpaid split, warnings, team absence, calendar conflicts and documents', () => {
    const text = render({
      paidHours: 16, unpaidHours: 8, documentCount: 2, approvalMode: 'sequential',
      conflictSnapshot: {
        warnings: [{ code: 'notice', message: 'Submitted inside the notice period' }, { code: 'max_consecutive', message: 'Over 10 consecutive days' }],
        calendarConflicts: [{ source: 'calendar', title: 'Sprint review', startsAt: '2026-10-20T10:00:00Z', endsAt: null }],
        teamAbsencePercent: 35
      }
    });

    expect(text('leave-balance')).toContain('40h → 24h');
    expect(text('leave-split')).toContain('16h paid');
    expect(text('leave-split')).toContain('8h unpaid');
    expect(text('leave-warnings')).toContain('Submitted inside the notice period');
    expect(text('leave-warnings')).toContain('Over 10 consecutive days');
    expect(text('leave-team-absence')).toContain('35%');
    expect(text('leave-conflicts')).toContain('Sprint review');
    expect(text('leave-documents')).toContain('2 documents');
    expect(text('leave-reason')).toContain('Family trip');
  });

  it('reads PascalCase snapshots and shows nothing it has no data for', () => {
    const text = render({ conflictSnapshot: { Warnings: [{ Code: 'x', Message: 'Team is short' }], CalendarConflicts: [], TeamAbsencePercent: null } },
      detail({ changeSet: [], explanation: null }));

    expect(text('leave-warnings')).toContain('Team is short');
    expect(text('leave-balance')).toBeNull();
    expect(text('leave-conflicts')).toBeNull();
    expect(text('leave-documents')).toBeNull();
    expect(text('leave-team-absence')).toBeNull();
  });

  it('copes with no payload at all', () => {
    expect(render(null)('leave-warnings')).toBeNull();
  });
});
