import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MyTeamTodayStore } from './my-team-today.store';
import { MyTeamTodayApiService } from '../data-access/my-team-today-api.service';
import { TeamTodayResponse } from '../models/my-team-today.model';

describe('MyTeamTodayStore', () => {
  const sampleResponse: TeamTodayResponse = {
    workDate: '2026-09-30',
    timezone: 'Asia/Colombo',
    legalEntityId: 'le-1',
    summary: {
      total: 1, working: 1, onBreak: 0, clockedOut: 0, late: 0, absent: 0,
      notStarted: 0, onLeave: 0, notScheduled: 0, needsAttention: 0
    },
    members: [{
      employeeId: 'emp-1', displayName: 'Priya K', avatarFileId: null, positionTitle: 'Engineer',
      status: 'working', statusLabel: 'Working', isLate: false, clockInAt: '2026-09-30T04:00:00Z',
      clockOutAt: null, attentionType: null, attentionLabel: null, attentionSeverity: null, leave: null,
      stateSince: '2026-09-30T04:00:00Z', breakRemainingMinutes: null, shiftEndsAt: null, attendanceMinutes: 60, expectedMinutes: 480, breaks: []
    }],
    totalMembers: 1,
    asOf: '2026-09-30T05:00:00Z'
  };

  function setup() {
    const getTeamToday = vi.fn().mockReturnValue(of(sampleResponse));
    const api = { getTeamToday };
    TestBed.configureTestingModule({
      providers: [MyTeamTodayStore, { provide: MyTeamTodayApiService, useValue: api }]
    });
    return { store: TestBed.inject(MyTeamTodayStore), getTeamToday };
  }

  it('starts with no data', () => {
    const { store } = setup();
    expect(store.data()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('load populates data', async () => {
    const { store } = setup();
    await store.load();
    expect(store.data()).toEqual(sampleResponse);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load sets an error and clears loading on failure, keeping prior data', async () => {
    const { store, getTeamToday } = setup();
    await store.load();
    getTeamToday.mockReturnValueOnce(throwError(() => ({ error: { detail: 'boom' } })));
    await store.load();
    expect(store.error()).toBe('boom');
    expect(store.loading()).toBe(false);
    expect(store.data()).toEqual(sampleResponse);
  });
});
