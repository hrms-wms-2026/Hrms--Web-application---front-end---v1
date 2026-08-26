import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TaskHistoryFeedComponent } from './task-history-feed.component';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

describe('TaskHistoryFeedComponent', () => {
  let fixture: ComponentFixture<TaskHistoryFeedComponent>;

  function setup(entries: TaskHistoryEntryDto[]): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskHistoryFeedComponent, HttpClientTestingModule] });
    fixture = TestBed.createComponent(TaskHistoryFeedComponent);
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
  }

  it('shows an empty state when there are no entries', () => {
    setup([]);
    expect(fixture.nativeElement.textContent).toContain('No changes yet');
  });

  it('renders one row per entry, in the given order', () => {
    setup([
      { type: 'edit', occurredAt: '2026-08-25T10:00:00Z', employeeId: 'e1', employeeName: 'Alex', edit: { logId: 'l1', source: 'direct', editRequestId: null, oldValuesJson: '{}', newValuesJson: '{"title":"New"}', reason: null }, statusChange: null, clockSession: null, percentageChange: null },
      { type: 'clock_session', occurredAt: '2026-08-25T11:00:00Z', employeeId: 'e2', employeeName: 'Sam', edit: null, statusChange: null, clockSession: { sessionId: 's1', clockInAt: '2026-08-25T10:30:00Z', clockOutAt: '2026-08-25T11:00:00Z', durationMinutes: 30, sessionReason: null, pushedPercent: 40, previousPercent: 10, percentageLogId: 'p1', percentageReason: null }, percentageChange: null }
    ]);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="history-entry"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Alex');
    expect(rows[1].textContent).toContain('Sam');
    expect(rows[1].textContent).toContain('40');
  });

  it('shows an add-note affordance on a percentage entry missing a reason', () => {
    setup([
      { type: 'percentage_change', occurredAt: '2026-08-25T10:00:00Z', employeeId: 'e1', employeeName: 'Alex', edit: null, statusChange: null, clockSession: null, percentageChange: { logId: 'p1', previousPercent: 40, newPercent: 20, source: 'manual_edit', reason: null } }
    ]);
    expect(fixture.nativeElement.querySelector('[data-testid="add-note-p1"]')).toBeTruthy();
  });

  it('does not show the add-note affordance when a reason is already present', () => {
    setup([
      { type: 'percentage_change', occurredAt: '2026-08-25T10:00:00Z', employeeId: 'e1', employeeName: 'Alex', edit: null, statusChange: null, clockSession: null, percentageChange: { logId: 'p1', previousPercent: 40, newPercent: 20, source: 'manual_edit', reason: 'already explained' } }
    ]);
    expect(fixture.nativeElement.querySelector('[data-testid="add-note-p1"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('already explained');
  });
});
