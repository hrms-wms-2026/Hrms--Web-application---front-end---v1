import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { TeamTodayMember, TeamTodayResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { TeamStatusCardComponent } from './team-status-card.component';

function member(overrides: Partial<TeamTodayMember> = {}): TeamTodayMember {
  return {
    employeeId: 'emp-1',
    displayName: 'Priya K',
    avatarFileId: null,
    positionTitle: 'Engineer',
    status: 'working',
    statusLabel: 'Working',
    isLate: false,
    clockInAt: '2026-09-30T04:00:00Z',
    clockOutAt: null,
    attentionType: null,
    attentionLabel: null,
    attentionSeverity: null,
    leave: null,
    ...overrides
  };
}

function response(members: TeamTodayMember[]): TeamTodayResponse {
  return {
    workDate: '2026-09-30',
    timezone: 'UTC',
    legalEntityId: 'le-1',
    summary: {
      total: members.length,
      working: members.filter((m) => m.status === 'working').length,
      onBreak: 0, clockedOut: 0, late: members.filter((m) => m.isLate).length,
      absent: 0, notStarted: 0, onLeave: 0, notScheduled: 0, needsAttention: 0
    },
    members,
    totalMembers: members.length
  };
}

describe('TeamStatusCardComponent', () => {
  let navigate: ReturnType<typeof vi.fn>;

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function setup(
    result: TeamTodayResponse | 'error' = response([member()])
  ): Promise<{ fixture: ComponentFixture<TeamStatusCardComponent>; getTeamToday: ReturnType<typeof vi.fn> }> {
    const getTeamToday = vi.fn(() => (result === 'error' ? throwError(() => new Error('network error')) : of(result)));
    navigate = vi.fn();

    await TestBed.configureTestingModule({
      imports: [TeamStatusCardComponent],
      providers: [
        MyTeamTodayStore,
        { provide: MyTeamTodayApiService, useValue: { getTeamToday } },
        { provide: Router, useValue: { navigate } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TeamStatusCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, getTeamToday };
  }

  it('loads team status on init', async () => {
    const { getTeamToday } = await setup();
    expect(getTeamToday).toHaveBeenCalledOnce();
  });

  it('shows the error state with retry when loading fails', async () => {
    const { fixture, getTeamToday } = await setup('error');
    expect(fixture.nativeElement.textContent).toContain("Couldn't load team status");

    const retryButton: HTMLButtonElement = fixture.nativeElement.querySelector('app-error-state button');
    expect(retryButton).toBeTruthy();
    retryButton.click();
    await fixture.whenStable();
    expect(getTeamToday).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state when totalMembers is zero', async () => {
    const { fixture } = await setup(response([]));
    expect(fixture.nativeElement.textContent).toContain('No one in your coverage is scheduled today');
  });

  it('renders each member with their status label', async () => {
    const { fixture } = await setup(response([member({ displayName: 'Arjun M', statusLabel: 'On Break', status: 'on_break' })]));
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Arjun M');
    expect(text).toContain('On Break');
  });

  it('appends a Late suffix to the pill when isLate is true', async () => {
    const { fixture } = await setup(response([member({ isLate: true })]));
    const pill: HTMLElement = fixture.nativeElement.querySelector('.team-status-pill');
    expect(pill.textContent).toContain('Late');
  });

  it('navigates to the team member detail on row click', async () => {
    const { fixture } = await setup(response([member({ employeeId: 'emp-42' })]));
    const row: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="team-status-members"] button');
    row.click();
    expect(navigate).toHaveBeenCalledWith(['/attendance/time-tracking'], {
      queryParams: { view: 'team', employeeId: 'emp-42' }
    });
  });

  it('navigates to the team view without an employeeId on View all', async () => {
    const { fixture } = await setup();
    const viewAll: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="team-status-view-all"]');
    viewAll.click();
    expect(navigate).toHaveBeenCalledWith(['/attendance/time-tracking'], { queryParams: { view: 'team' } });
  });

  it('polls every 60 seconds while the document is visible', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const { getTeamToday } = await setup();
    expect(getTeamToday).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getTeamToday).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getTeamToday).toHaveBeenCalledTimes(3);
  });

  it('stops polling while hidden and refetches immediately when visible again', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const { getTeamToday } = await setup();
    expect(getTeamToday).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(getTeamToday).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(getTeamToday).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(getTeamToday).toHaveBeenCalledTimes(3);
  });

  it('removes the visibilitychange listener and clears the interval on destroy', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { fixture, getTeamToday } = await setup();

    fixture.destroy();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    await vi.advanceTimersByTimeAsync(120_000);
    expect(getTeamToday).toHaveBeenCalledTimes(1);
  });
});
