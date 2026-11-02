import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { TeamAttendanceApiService } from '../../data-access/team-attendance-api.service';
import { TeamWorkingHoursApiService } from '../../data-access/team-working-hours-api.service';
import { TeamTodayResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { presenceMember, presenceResponse } from '../../utils/team-presence.testing';
import { TeamStatusDetailDialogComponent } from './team-status-detail-dialog.component';

const WEEK = {
  weekStart: '2026-10-26',
  weekEnd: '2026-11-01',
  days: [
    {
      date: '2026-10-26',
      workedMinutes: 900,
      breakMinutes: 120,
      onLeaveCount: 1,
      peopleWithRecord: 2,
    },
    { date: '2026-10-27', workedMinutes: 0, breakMinutes: 0, onLeaveCount: 0, peopleWithRecord: 0 },
  ],
};

const LAST_WEEK = {
  weekStart: '2026-10-19',
  weekEnd: '2026-10-25',
  days: [
    { date: '2026-10-19', workedMinutes: 800, breakMinutes: 60, onLeaveCount: 0, peopleWithRecord: 2 },
  ],
};

describe('TeamStatusDetailDialogComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  async function setup(
    data: TeamTodayResponse,
    week: 'error' | typeof WEEK = WEEK,
    attendance: 'error' | { periodRate: number | null; deltaPp: number | null } = { periodRate: 92, deltaPp: 4 },
  ) {
    const getWeek = vi.fn((weekStart: string | null = null) =>
      week === 'error' ? throwError(() => new Error('x')) : of(weekStart === '2026-10-19' ? LAST_WEEK : week),
    );
    const getSummary = vi.fn(() =>
      attendance === 'error' ? throwError(() => new Error('x')) : of({ mode: 'week', ...attendance }),
    );
    await TestBed.configureTestingModule({
      imports: [TeamStatusDetailDialogComponent],
      providers: [
        MyTeamTodayStore,
        { provide: MyTeamTodayApiService, useValue: { getTeamToday: vi.fn() } },
        { provide: TeamWorkingHoursApiService, useValue: { getWeek } },
        { provide: TeamAttendanceApiService, useValue: { getSummary } },
      ],
    }).compileComponents();
    TestBed.inject(MyTeamTodayStore).seed(data);
    const fixture = TestBed.createComponent(TeamStatusDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getWeek, getSummary, doc: fixture.nativeElement.ownerDocument as Document };
  }

  const team = [
    presenceMember('working', {
      displayName: 'Ada',
      stateSince: '2026-10-29T03:30:00Z',
      attendanceMinutes: 300,
      isLate: true,
      attentionLabel: 'Late arrival',
    }),
    presenceMember('on_leave', {
      displayName: 'Cat',
      leave: { leaveTypeName: 'Annual Leave', endsOn: '2026-10-30' },
    }),
    presenceMember('absent', { displayName: 'Dan', leave: null }),
  ];

  const tileText = (doc: Document, id: string) =>
    doc.querySelector(`[data-testid="${id}"]`)!.closest('[data-testid="kpi-tile"]')!.textContent!.replace(/\s+/g, ' ').trim();

  it('five tiles: Working, On break, On leave (with %), Avg working time vs last week, Attendance rate', async () => {
    const { doc } = await setup(presenceResponse(team));

    expect(doc.querySelector('[data-testid="wbld-tile-working"]')!.textContent!.trim()).toBe('1');
    expect(doc.querySelector('[data-testid="wbld-tile-break"]')!.textContent!.trim()).toBe('0');
    expect(doc.querySelector('[data-testid="wbld-tile-leave"]')!.textContent!.trim()).toBe('1');
    expect(tileText(doc, 'wbld-tile-working')).toContain('33% of team');
    // This week 900 min over 2 records = 7h 30m; last week 800 / 2 = 6h 40m -> +12.5%.
    expect(doc.querySelector('[data-testid="wbld-tile-avg"]')!.textContent!.trim()).toBe('7h 30m');
    expect(tileText(doc, 'wbld-tile-avg')).toContain('↑ 12.5% vs last week');
    expect(doc.querySelector('[data-testid="wbld-tile-rate"]')!.textContent!.trim()).toBe('92%');
    expect(tileText(doc, 'wbld-tile-rate')).toContain('↑ 4 pts vs last week');
  });

  it('drops the attendance rate tile when its source cannot be read', async () => {
    const { doc } = await setup(presenceResponse(team), WEEK, 'error');

    expect(doc.querySelector('[data-testid="wbld-tile-rate"]')).toBeNull();
    expect(doc.querySelector('[data-testid="wbld-tile-avg"]')).toBeTruthy();
  });

  it('a missing rate shows "—", never 0%', async () => {
    const { doc } = await setup(presenceResponse(team), WEEK, { periodRate: null, deltaPp: null });
    expect(doc.querySelector('[data-testid="wbld-tile-rate"]')!.textContent!.trim()).toBe('—');
  });

  it('insight banners appear only for counts above zero, with names', async () => {
    const { doc } = await setup(presenceResponse(team));

    const banners = [...doc.querySelectorAll('[data-testid^="wbld-banner-"]')].map((b) => b.getAttribute('data-testid'));
    expect(banners).toEqual(['wbld-banner-leave', 'wbld-banner-working']);
    expect(doc.querySelector('[data-testid="wbld-banner-leave"]')!.textContent).toContain('Cat');
    expect(doc.querySelector('[data-testid="wbld-banner-break"]')).toBeNull();
  });

  it('draws the trend with the team average line and leave marks', async () => {
    const { doc } = await setup(presenceResponse(team));

    expect(doc.querySelector('[data-testid="hours-average"]')).toBeTruthy();
    expect(doc.querySelectorAll('[data-testid="hours-leave"]').length).toBe(1);
  });

  it('loads the week of working hours when opened and draws it', async () => {
    const { getWeek, doc } = await setup(presenceResponse(team));

    expect(getWeek).toHaveBeenCalledWith(null);
    expect(getWeek).toHaveBeenCalledWith('2026-10-19');
    expect(doc.querySelectorAll('[data-testid="hours-bar"]').length).toBe(2);
  });

  it('offers a retry when the week fails to load', async () => {
    const { doc } = await setup(presenceResponse(team), 'error');
    expect(doc.body.textContent).toContain("Couldn't load the working hours.");
  });

  it('CSV has a leave type only for members whose leave was sent, and the attention column', async () => {
    const { fixture } = await setup(presenceResponse(team));
    const download = vi.fn();
    fixture.componentInstance.downloadFile = download;

    fixture.componentInstance.exportCsv();

    const [filename, csv] = download.mock.calls[0] as [string, string];
    expect(filename).toBe('working-break-leave-2026-10-29.csv');
    const lines = csv.trim().split(/\r?\n/);
    expect(lines[0]).toContain('Leave type');
    const cat = lines.find((l) => l.startsWith('Cat'))!;
    const dan = lines.find((l) => l.startsWith('Dan'))!;
    const ada = lines.find((l) => l.startsWith('Ada'))!;
    expect(cat).toContain('Annual Leave');
    expect(dan.endsWith(',,')).toBe(true);
    expect(dan).not.toContain('Leave');
    expect(ada).toContain('Late arrival');
    expect(lines[0]).toContain('Today hours');
  });

  it('remaining is "—" without a denominator', async () => {
    const { doc } = await setup(presenceResponse(team));

    const remaining = [...doc.querySelectorAll('[data-testid="wbld-remaining"]')].map((c) =>
      c.textContent!.trim(),
    );
    expect(remaining.every((r) => r === '—')).toBe(true);
  });

  it('closes from its own close button', async () => {
    const { fixture, doc } = await setup(presenceResponse(team));
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    (doc.querySelector('[data-testid="wbld-close"]') as HTMLButtonElement).click();
    expect(closed).toHaveBeenCalledOnce();
  });
});
