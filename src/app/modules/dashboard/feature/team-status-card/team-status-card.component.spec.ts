import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyTeamTodayApiService } from '../../data-access/my-team-today-api.service';
import { TeamTodayMember, TeamTodayResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { fakeWidgetData } from '../../widgets/widget-data.testing';
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

  function openTeam(fixture: ComponentFixture<TeamStatusCardComponent>): HTMLElement {
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('[data-testid="team-status-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    return el;
  }

  const isOpen = (el: HTMLElement): boolean =>
    el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open');

  it('shows present / late / absent / on-leave counts on the card', async () => {
    const { fixture } = await setup({
      ...response([member()]),
      summary: {
        total: 10, working: 5, onBreak: 1, clockedOut: 1, late: 2, absent: 2,
        notStarted: 0, onLeave: 1, notScheduled: 0, needsAttention: 2
      }
    });
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="team-stat-present"]')!.textContent!.trim()).toBe('7');
    expect(el.querySelector('[data-testid="team-stat-late"]')!.textContent!.trim()).toBe('2');
    expect(el.querySelector('[data-testid="team-stat-absent"]')!.textContent!.trim()).toBe('2');
    expect(el.querySelector('[data-testid="team-stat-leave"]')!.textContent!.trim()).toBe('1');
    expect(el.textContent).toContain('7 of 9 in today');
  });

  it('previews the first people to follow up on, or says everyone is on track', async () => {
    const clear = await setup(response([member({ displayName: 'Arjun M', statusLabel: 'On Break', status: 'on_break' })]));
    expect(clear.fixture.nativeElement.querySelector('[data-testid="team-status-all-clear"]')).toBeTruthy();
    TestBed.resetTestingModule();

    const absentees = Array.from({ length: 4 }, (_, i) =>
      member({ employeeId: `a${i}`, displayName: `Absent ${i}`, status: 'absent', statusLabel: 'Absent' })
    );
    const { fixture } = await setup(response(absentees));
    const preview: HTMLElement = fixture.nativeElement.querySelector('[data-testid="team-status-preview"]');
    expect(preview.querySelectorAll('[data-testid="team-status-member"]').length).toBe(3);
    expect(preview.textContent).toContain('Follow up · 4');
  });

  it('renders each member with their status label in the full team list', async () => {
    const { fixture } = await setup(response([member({ displayName: 'Arjun M', statusLabel: 'On Break', status: 'on_break' })]));
    const el = openTeam(fixture);
    expect(isOpen(el)).toBe(true);
    const list = el.querySelector('[data-testid="team-status-members"]')!.textContent!;
    expect(list).toContain('Arjun M');
    expect(list).toContain('On Break');
  });

  it('appends a Late suffix to the pill when isLate is true', async () => {
    const { fixture } = await setup(response([member({ isLate: true })]));
    const pill: HTMLElement = fixture.nativeElement.querySelector('.team-status-pill');
    expect(pill.textContent).toContain('Late');
  });

  it('navigates to the team member detail on row click without popping the card out', async () => {
    const { fixture } = await setup(response([member({ employeeId: 'emp-42', status: 'absent', statusLabel: 'Absent' })]));
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('[data-testid="team-status-preview"] [data-testid="team-status-member"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(navigate).toHaveBeenCalledWith(['/attendance/time-tracking'], {
      queryParams: { view: 'team', employeeId: 'emp-42' }
    });
    expect(isOpen(el)).toBe(false);
  });

  it('navigates to the team view without an employeeId from the pop-out', async () => {
    const { fixture } = await setup();
    const el = openTeam(fixture);
    (el.querySelector('[data-testid="team-status-view-all"]') as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith(['/attendance/time-tracking'], { queryParams: { view: 'team' } });
  });

  it('pops out on a card click and closes again with Show less', async () => {
    const { fixture } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('[data-testid="team-status-card"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(isOpen(el)).toBe(true);

    const showLess = Array.from(el.querySelectorAll('[data-testid="team-status-toggle"]')).find(
      (b) => b.textContent!.trim() === 'Show less'
    ) as HTMLButtonElement;
    showLess.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="team-status-members"]')).toBeNull();
  });

  it('lists exceptions first and folds people working normally into one line', async () => {
    const { fixture } = await setup(
      response([
        member({ employeeId: 'a1', displayName: 'Absent One', status: 'absent', statusLabel: 'Absent' }),
        member({ employeeId: 'w1', displayName: 'Working One' }),
        member({ employeeId: 'w2', displayName: 'Working Two' })
      ])
    );
    const el = openTeam(fixture);
    expect(el.querySelector('[data-testid="team-status-group-absent"]')?.textContent).toContain('Absent One');
    expect(el.textContent).not.toContain('Working One');
    const toggle: HTMLButtonElement = el.querySelector('[data-testid="team-status-others-toggle"]')!;
    expect(toggle.textContent).toContain('2');

    toggle.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="team-status-others"]')?.textContent).toContain('Working One');
  });

  it('breaks the folded line down by status when it mixes more than one', async () => {
    const { fixture } = await setup(
      response([
        member({ employeeId: 'a1', status: 'absent', statusLabel: 'Absent' }),
        member({ employeeId: 'w1' }),
        member({ employeeId: 'w2' }),
        member({ employeeId: 'v1', status: 'on_leave', statusLabel: 'On Leave' })
      ])
    );
    const el = openTeam(fixture);
    const toggle: HTMLElement = el.querySelector('[data-testid="team-status-others-toggle"]')!;
    expect(toggle.textContent!.replace(/\s+/g, ' ')).toContain('3 others · 2 working · 1 on leave');
  });

  it('caps a large exception group at 5 rows with a "+N more" expander', async () => {
    const absentees = Array.from({ length: 8 }, (_, i) =>
      member({ employeeId: `a${i}`, displayName: `Absent ${i}`, status: 'absent', statusLabel: 'Absent' })
    );
    const { fixture } = await setup(response(absentees));
    const el = openTeam(fixture);
    const group = (): HTMLElement => el.querySelector('[data-testid="team-status-group-absent"]')!;
    expect(group().querySelectorAll('li').length).toBe(5);

    const more: HTMLButtonElement = el.querySelector('[data-testid="team-status-more-absent"]')!;
    expect(more.textContent?.trim()).toBe('+3 more absent');
    more.click();
    fixture.detectChanges();
    expect(group().querySelectorAll('li').length).toBe(8);
  });

  it('filters the list to one status from the summary chips and clears on a second click', async () => {
    const { fixture } = await setup(
      response([member({ employeeId: 'w1', displayName: 'On Time' }), member({ employeeId: 'l1', displayName: 'Came Late', isLate: true })])
    );
    const el = openTeam(fixture);
    const lateChip: HTMLButtonElement = el.querySelector('[data-testid="team-status-filter-late"]')!;
    lateChip.click();
    fixture.detectChanges();
    expect(lateChip.getAttribute('aria-pressed')).toBe('true');
    expect(el.querySelector('[data-testid="team-status-members"]')?.textContent).toContain('Came Late');
    expect(el.querySelector('[data-testid="team-status-members"]')?.textContent).not.toContain('On Time');

    lateChip.click();
    fixture.detectChanges();
    expect(lateChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the attention reason as a caption only when it adds to the status pill', async () => {
    const { fixture } = await setup(
      response([
        member({ employeeId: 'x', status: 'absent', statusLabel: 'Absent', clockInAt: null, attentionLabel: 'No clock-in after shift start', attentionSeverity: 'critical' }),
        member({ employeeId: 'y', status: 'absent', statusLabel: 'Absent', clockInAt: null, attentionLabel: 'Absent', attentionSeverity: 'critical' })
      ])
    );
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('No clock-in after shift start');
    expect(fixture.nativeElement.querySelector('.team-status-attention-dot')).toBeNull();
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
  describe('inside a dashboard frame', () => {
    async function setupInFrame(widget: ReturnType<typeof fakeWidgetData>, result: TeamTodayResponse | 'error') {
      const getTeamToday = vi.fn(() => (result === 'error' ? throwError(() => new Error('network error')) : of(result)));
      navigate = vi.fn();
      await TestBed.configureTestingModule({
        imports: [TeamStatusCardComponent],
        providers: [
          MyTeamTodayStore,
          { provide: MyTeamTodayApiService, useValue: { getTeamToday } },
          { provide: Router, useValue: { navigate } },
          widget.provider
        ]
      }).compileComponents();
      const fixture = TestBed.createComponent(TeamStatusCardComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return { fixture, getTeamToday, store: TestBed.inject(MyTeamTodayStore) };
    }

    it('uses_bootstrap_payload_without_calling_its_api', async () => {
      const payload = response([member({ displayName: 'Bootstrap Bea' })]);
      const widget = fakeWidgetData('success', payload);
      const { fixture, getTeamToday, store } = await setupInFrame(widget, response([]));

      expect(getTeamToday).not.toHaveBeenCalled();
      expect(widget.refresh).not.toHaveBeenCalled();
      expect(store.data()).toEqual(payload);
      expect(store.loadedAt()).toBeInstanceOf(Date);
      expect(fixture.nativeElement.querySelector('[data-testid="team-stat-present"]')!.textContent!.trim()).toBe('1');
    });

    it('falls_back_to_own_api_outside_dashboard', async () => {
      const { getTeamToday, fixture } = await setup(response([member()]));
      expect(getTeamToday).toHaveBeenCalledOnce();
      expect(fixture.nativeElement.querySelector('[data-testid="team-stat-present"]')!.textContent!.trim()).toBe('1');
    });

    it('falls back to its own api, with its own error state, when the bootstrap state is an error', async () => {
      const { fixture, getTeamToday } = await setupInFrame(fakeWidgetData('error'), 'error');
      expect(getTeamToday).toHaveBeenCalledOnce();
      expect(fixture.nativeElement.textContent).toContain("Couldn't load team status");
    });

    it('polls through the widget context every 60 seconds and feeds the result into the store', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
      const widget = fakeWidgetData('success', response([member()]));
      const { fixture, getTeamToday, store } = await setupInFrame(widget, response([]));

      await vi.advanceTimersByTimeAsync(60_000);
      expect(widget.refresh).toHaveBeenCalledOnce();
      expect(getTeamToday).not.toHaveBeenCalled();
      expect(store.loading()).toBe(true);

      const next = response([member(), member({ employeeId: 'emp-2' })]);
      widget.resolve(next);
      fixture.detectChanges();
      expect(store.data()).toEqual(next);
      expect(store.loading()).toBe(false);
    });

    it('falls back to its own api when a context refresh fails', async () => {
      vi.useFakeTimers();
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true });
      const widget = fakeWidgetData('success', response([member()]));
      const next = response([member(), member({ employeeId: 'emp-3' })]);
      const { fixture, getTeamToday, store } = await setupInFrame(widget, next);

      await vi.advanceTimersByTimeAsync(60_000);
      widget.fail();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(getTeamToday).toHaveBeenCalledOnce();
      expect(store.data()).toEqual(next);
    });
  });
});
