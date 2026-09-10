import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { AttendanceHistoryListComponent } from './attendance-history-list.component';

const row: AttendanceHistoryRow = {
  attendanceRecordId: 'record-1',
  workDate: '2026-08-22',
  employee: { employeeId: 'employee-2', displayName: 'Jordan Lee', employeeNumber: 'EMP-002', position: 'Designer', department: 'Product', avatarFileId: null },
  clockInAt: '2026-08-22T09:05:00+05:30',
  clockOutAt: null,
  isActive: true,
  breakMinutes: 0,
  totalWorkedMinutes: 120,
  expectedWorkMode: 'remote',
  attendanceSource: 'web',
  status: 'clocked_in',
  canViewDetails: true,
  canRequestCorrection: false,
  canRequestWorkAreaChange: false,
  canCorrect: false,
  statusLabel: null,
  attentionType: null,
  attentionLabel: null,
  attentionSeverity: null,
  breakOverageMinutes: 0,
  isOverBreakAllowance: false
};

describe('AttendanceHistoryListComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    rows?: readonly AttendanceHistoryRow[];
    loading?: boolean;
    error?: string | null;
    showEmployeeColumn?: boolean;
    retryDisabledMessage?: string | null;
    page?: number;
    pageSize?: number;
    totalCount?: number;
  } = {}): Promise<{ fixture: ComponentFixture<AttendanceHistoryListComponent> }> {
    await TestBed.configureTestingModule({ imports: [AttendanceHistoryListComponent] }).compileComponents();
    const fixture = TestBed.createComponent(AttendanceHistoryListComponent);
    const rows = options.rows ?? [row];
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('loading', options.loading ?? false);
    fixture.componentRef.setInput('error', options.error ?? null);
    fixture.componentRef.setInput('showEmployeeColumn', options.showEmployeeColumn ?? false);
    fixture.componentRef.setInput('retryDisabledMessage', options.retryDisabledMessage ?? null);
    fixture.componentRef.setInput('page', options.page ?? 1);
    fixture.componentRef.setInput('pageSize', options.pageSize ?? 20);
    fixture.componentRef.setInput('totalCount', options.totalCount ?? rows.length);
    fixture.detectChanges();
    return { fixture };
  }

  it('renders the trimmed columns, including Date, Clock in, Clock out, Break, Status, without Scheduled/Worked time/Work mode', async () => {
    const { fixture } = await setup();
    const headerText = fixture.nativeElement.querySelector('thead')?.textContent ?? '';
    expect(headerText).toContain('Date');
    expect(headerText).toContain('Clock in');
    expect(headerText).toContain('Clock out');
    expect(headerText).toContain('Break');
    expect(headerText).toContain('Status');
    expect(headerText).not.toContain('Scheduled');
    expect(headerText).not.toContain('Worked time');
    expect(headerText).not.toContain('Work mode');
  });

  it('renders Break column for each row without Scheduled or Worked time', async () => {
    const { fixture } = await setup({
      rows: [{
        ...row,
        breakMinutes: 45,
        scheduledStartTime: '09:00',
        scheduledEndTime: '17:30'
      }]
    });

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('45m');
    expect(text).not.toContain('09:00');
    expect(text).not.toContain('17:30');
  });

  it('shows the Employee column only when showEmployeeColumn is true', async () => {
    const withoutColumn = await setup({ showEmployeeColumn: false });
    expect(withoutColumn.fixture.nativeElement.querySelector('thead')?.textContent ?? '').not.toContain('Employee');

    TestBed.resetTestingModule();
    const withColumn = await setup({ showEmployeeColumn: true });
    const text = withColumn.fixture.nativeElement.querySelector('thead')?.textContent ?? '';
    expect(text).toContain('Employee');
    expect((withColumn.fixture.nativeElement as HTMLElement).textContent).toContain('Jordan Lee');
  });

  it('renders the loading state', async () => {
    const { fixture } = await setup({ loading: true });
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders a retryable error state and emits retryRequested when clicked', async () => {
    const { fixture } = await setup({ error: 'Could not load attendance history. Try again.' });
    const retry = vi.fn();
    fixture.componentInstance.retryRequested.subscribe(retry);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.time-tracking-message button')!.click();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load attendance history. Try again.');
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('suppresses the retry button when the error matches retryDisabledMessage', async () => {
    const { fixture } = await setup({
      error: 'You do not have access to view team attendance.',
      retryDisabledMessage: 'You do not have access to view team attendance.'
    });
    expect((fixture.nativeElement as HTMLElement).querySelector('app-button')).toBeNull();
  });

  it('renders the configured empty message when there are no rows', async () => {
    const { fixture } = await setup({ rows: [] });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No attendance records for this date range.');
  });

  it('emits rowSelected only when canViewDetails is true', async () => {
    const hidden = { ...row, attendanceRecordId: 'record-2', canViewDetails: false };
    const { fixture } = await setup({ rows: [row, hidden] });
    const selected = vi.fn();
    fixture.componentInstance.rowSelected.subscribe(selected);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    (rows[0] as HTMLElement).click();
    (rows[1] as HTMLElement).click();

    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith(row);
  });

  it('shows Previous/Next pagination only when totalCount exceeds pageSize', async () => {
    const { fixture: withoutPaging } = await setup({ totalCount: 5, pageSize: 20 });
    expect(withoutPaging.nativeElement.querySelector('.tt-pagination')).toBeNull();

    TestBed.resetTestingModule();
    const { fixture: withPaging } = await setup({ totalCount: 45, pageSize: 20, page: 2 });
    expect(withPaging.nativeElement.querySelector('.tt-pagination-info')?.textContent).toContain('Page 2 of 3');
  });

  it('emits pageChange when Next is clicked', async () => {
    const { fixture } = await setup({ totalCount: 45, pageSize: 20, page: 1 });
    const pageChange = vi.fn();
    fixture.componentInstance.pageChange.subscribe(pageChange);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('.tt-pagination-buttons button');
    (buttons[1] as HTMLButtonElement).click();
    expect(pageChange).toHaveBeenCalledWith(2);
  });
});
