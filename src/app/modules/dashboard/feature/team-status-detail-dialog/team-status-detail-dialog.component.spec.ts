import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
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

describe('TeamStatusDetailDialogComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  async function setup(data: TeamTodayResponse, week: 'error' | typeof WEEK = WEEK) {
    const getWeek = vi.fn(() => (week === 'error' ? throwError(() => new Error('x')) : of(week)));
    await TestBed.configureTestingModule({
      imports: [TeamStatusDetailDialogComponent],
      providers: [
        MyTeamTodayStore,
        { provide: MyTeamTodayApiService, useValue: { getTeamToday: vi.fn() } },
        { provide: TeamWorkingHoursApiService, useValue: { getWeek } },
      ],
    }).compileComponents();
    TestBed.inject(MyTeamTodayStore).seed(data);
    const fixture = TestBed.createComponent(TeamStatusDetailDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getWeek, doc: fixture.nativeElement.ownerDocument as Document };
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

  it('shows one KPI row: Working, Break, Leave and Not clocked in', async () => {
    const { doc } = await setup(presenceResponse(team));

    expect(doc.querySelector('[data-testid="wbld-tile-working"]')!.textContent!.trim()).toBe('1');
    expect(doc.querySelector('[data-testid="wbld-tile-break"]')!.textContent!.trim()).toBe('0');
    expect(doc.querySelector('[data-testid="wbld-tile-leave"]')!.textContent!.trim()).toBe('1');
    expect(doc.querySelector('[data-testid="wbld-tile-neutral"]')!.textContent!.trim()).toBe('1');
  });

  it('loads the week of working hours when opened and draws it', async () => {
    const { getWeek, doc } = await setup(presenceResponse(team));

    expect(getWeek).toHaveBeenCalledOnce();
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
