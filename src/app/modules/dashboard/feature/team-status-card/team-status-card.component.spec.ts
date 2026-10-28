import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { TeamWorkingHoursApiService } from '../../data-access/team-working-hours-api.service';
import { TeamTodayResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { FakeResizeObserver, stubResizeObserver } from '../../utils/host-size.testing';
import { presenceMember, presenceResponse } from '../../utils/team-presence.testing';
import { fakeWidgetData } from '../../widgets/widget-data.testing';
import { TeamStatusCardComponent } from './team-status-card.component';

const cols = (n: number) => n * 97 + (n - 1) * 12;
const rows = (n: number) => n * 96 + (n - 1) * 12;

const TEAM = [
  presenceMember('working', { displayName: 'Ada', stateSince: '2026-10-29T03:30:00Z', shiftEndsAt: '2026-10-29T12:00:00Z', attendanceMinutes: 300, isLate: true }),
  presenceMember('on_break', { displayName: 'Bob', stateSince: '2026-10-29T09:50:00Z', breakRemainingMinutes: null }),
  presenceMember('on_leave', { displayName: 'Cat', leave: { leaveTypeName: 'Annual Leave', endsOn: '2026-10-30' } }),
  presenceMember('absent', { displayName: 'Dan' }),
  presenceMember('not_started', { displayName: 'Eve' }),
  presenceMember('clocked_out', { displayName: 'Fay' })
];

describe('TeamStatusCardComponent (Working / Break / Leave)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function setup(
    result: TeamTodayResponse | 'error' = presenceResponse(TEAM),
    size: { width: number; height: number } | null = null,
    extraProviders: unknown[] = []
  ): Promise<{ fixture: ComponentFixture<TeamStatusCardComponent>; getTeamToday: ReturnType<typeof vi.fn>; el: HTMLElement }> {
    stubResizeObserver();
    const getTeamToday = vi.fn(() => (result === 'error' ? throwError(() => new Error('network error')) : of(result)));
    await TestBed.configureTestingModule({
      imports: [TeamStatusCardComponent],
      providers: [
        MyTeamTodayStore,
        { provide: MyTeamTodayApiService, useValue: { getTeamToday } },
        { provide: TeamWorkingHoursApiService, useValue: { getWeek: vi.fn(() => of({ weekStart: '2026-10-26', weekEnd: '2026-11-01', days: [] })) } },
        ...(extraProviders as never[])
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TeamStatusCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    if (size) FakeResizeObserver.instances[0].trigger(size.width, size.height);
    fixture.detectChanges();
    return { fixture, getTeamToday, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, testId: string) => el.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? null;

  it('loads on init and is titled Working / Break / Leave', async () => {
    const { el, getTeamToday } = await setup();

    expect(getTeamToday).toHaveBeenCalledOnce();
    expect(el.textContent).toContain('Working / Break / Leave');
  });

  it('shows the error state when loading fails', async () => {
    const { el } = await setup('error');
    expect(el.textContent).toContain("Couldn't load who is working");
  });

  it('shows the empty state for an empty team', async () => {
    const { el } = await setup(presenceResponse([]));
    expect(el.textContent).toContain('No one in your team to show.');
  });

  it('2x2 is the mini view: the 140px donut with at-work of team and the three counts', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: cols(2), height: rows(2) });

    expect(el.querySelector('[data-testid="wbl-mini"]')).toBeTruthy();
    expect((el.querySelector('[data-testid="wbl-donut"]') as HTMLElement).style.width).toBe('140px');
    expect(text(el, 'wbl-center')!.replace(/\s+/g, '')).toBe('2/6');
    expect(text(el, 'wbl-count-working')).toContain('1');
    expect(text(el, 'wbl-count-break')).toContain('1');
    expect(text(el, 'wbl-count-leave')).toContain('1');
  });

  it('a masked leave (absent) is never counted under Leave', async () => {
    const { el } = await setup(presenceResponse([presenceMember('absent'), presenceMember('working')]), { width: cols(4), height: rows(4) });

    expect(text(el, 'wbl-count-leave')).toContain('0');
    expect(text(el, 'wbl-neutral')).toBe('1 absent');
  });

  it('4x4 is the medium view: counters, the neutral line, rows in working-break-leave order and a late tag', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: cols(4), height: rows(4) });

    expect(el.querySelector('[data-testid="wbl-layout"]')!.getAttribute('data-view')).toBe('medium');
    expect(text(el, 'wbl-neutral')).toBe('1 not clocked in · 1 clocked out · 1 absent');
    const names = [...el.querySelectorAll('[data-testid="wbl-row"] .wbl-name')].map((n) => n.textContent!.trim());
    expect(names.slice(0, 3)).toEqual(['Ada', 'Bob', 'Cat']);
    expect(el.querySelectorAll('[data-testid="wbl-late"]').length).toBe(1);
  });

  it('medium shows a time-left bar only where a denominator exists', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: cols(4), height: rows(4) });

    // Ada has a scheduled end; Bob's break has no configured allowance.
    expect(el.querySelectorAll('[data-testid="wbl-left"]').length).toBe(1);
  });

  it('8x6 is the large view: a table with "—" for a remaining time without a denominator', async () => {
    const { el } = await setup(presenceResponse(TEAM), { width: cols(8), height: rows(6) });

    expect(el.querySelector('[data-testid="wbl-table"]')).toBeTruthy();
    const remaining = [...el.querySelectorAll('[data-testid="wbl-remaining"]')].map((c) => c.textContent!.trim());
    expect(remaining[1]).toBe('—');
    expect(remaining[2]).toBe('—');
    expect(el.textContent).toContain('Annual Leave · until 2026-10-30');
  });

  it('opens the popup from the expand action', async () => {
    const { fixture, el } = await setup(presenceResponse(TEAM), { width: cols(8), height: rows(6) });

    fixture.componentInstance.openDetail();
    fixture.detectChanges();
    expect(fixture.componentInstance.detailOpen()).toBe(true);
    expect(el.ownerDocument.body.textContent).toContain('Working hours this week');
  });

  it('polls every 60 seconds while visible', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const { getTeamToday } = await setup();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getTeamToday).toHaveBeenCalledTimes(2);
  });

  it('a clock tick changes elapsed times but not the counts or the order', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T10:00:00Z'));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: true });
    const { fixture, el, getTeamToday } = await setup(presenceResponse(TEAM), { width: cols(8), height: rows(6) });
    const before = [...el.querySelectorAll('[data-testid="wbl-table-row"]')].map((r) => r.querySelector('.wbl-name')!.textContent);

    await vi.advanceTimersByTimeAsync(30_000);
    fixture.detectChanges();

    const after = [...el.querySelectorAll('[data-testid="wbl-table-row"]')].map((r) => r.querySelector('.wbl-name')!.textContent);
    expect(after).toEqual(before);
    expect(getTeamToday).toHaveBeenCalledOnce();
  });

  it('inside a dashboard frame it uses the bootstrap payload without calling its api', async () => {
    const payload = presenceResponse(TEAM);
    const widget = fakeWidgetData('success', payload);
    const { getTeamToday } = await setup(presenceResponse([]), null, [widget.provider]);

    expect(getTeamToday).not.toHaveBeenCalled();
    expect(TestBed.inject(MyTeamTodayStore).data()).toEqual(payload);
  });
});
