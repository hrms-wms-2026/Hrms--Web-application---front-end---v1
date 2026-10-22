import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ExceptionEvidenceResponse } from '../../models/exception-evidence.model';
import { ExceptionEvidencePanelComponent } from './exception-evidence-panel.component';

const identityEvidence: ExceptionEvidenceResponse = {
  exceptionId: 'a1',
  type: 'IdentityAnomaly',
  workDate: '2026-09-28',
  timezone: 'UTC',
  attendance: { clockInAt: '2026-09-28T09:00:00Z', clockOutAt: '2026-09-28T18:00:00Z', source: 'agent', status: 'normal' },
  identity: {
    source: 'face_check_override', occurredAt: '2026-09-28T09:00:00Z', purpose: 'clock_in', similarityScore: 12,
    reasons: ['poor_lighting'], deviceRegistrationId: 'd1',
    photoUrl: 'https://signed/photo.jpg', photoUrlExpiresAt: '2026-09-28T09:05:00Z', photoUnavailable: false
  },
  faceChecks: [
    { id: 'f1', at: '2026-09-28T08:58:00Z', purpose: 'clock_in', outcome: 'failed', failureReason: 'not_matched', similarityScore: 61 }
  ],
  checkInScans: [],
  deviceActivity: {
    firstSeenAt: '2026-09-28T09:20:00Z', lastSeenAt: '2026-09-28T16:40:00Z',
    activeMinutes: 60, idleMinutes: 20, offlineMinutes: 40, deviceIds: ['d1'],
    segments: [
      { start: '2026-09-28T09:20:00Z', end: '2026-09-28T10:20:00Z', state: 'active' },
      { start: '2026-09-28T10:20:00Z', end: '2026-09-28T11:00:00Z', state: 'offline' },
      { start: '2026-09-28T11:00:00Z', end: '2026-09-28T11:20:00Z', state: 'idle' }
    ],
    truncated: false
  },
  pattern: null,
  activityHidden: false
};

const lowActivityEvidence: ExceptionEvidenceResponse = {
  ...identityEvidence,
  type: 'SustainedLowActivity',
  identity: null,
  faceChecks: [],
  pattern: {
    from: '2026-09-09', to: '2026-09-15',
    days: [
      { date: '2026-09-12', activityScore: 80, activeMinutes: 400, idleMinutes: 20, workedMinutes: 480, attendanceStatus: 'normal', inRule: false },
      { date: '2026-09-13', activityScore: 25, activeMinutes: 90, idleMinutes: 200, workedMinutes: 470, attendanceStatus: 'normal', inRule: true },
      { date: '2026-09-15', activityScore: 20, activeMinutes: 70, idleMinutes: 250, workedMinutes: null, attendanceStatus: 'missing_clock_out', inRule: true }
    ],
    measures: [
      { label: 'Alert when the activity score stays below', value: 40, unit: 'score' },
      { label: 'For this many days in a row', value: 3, unit: 'days' }
    ],
    measuresRecalculated: false
  }
};

describe('ExceptionEvidencePanelComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(evidence: ExceptionEvidenceResponse) {
    await TestBed.configureTestingModule({ imports: [ExceptionEvidencePanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ExceptionEvidencePanelComponent);
    fixture.componentRef.setInput('evidence', evidence);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('keeps the details short: clock in/out, when the computer was on and the activity bar - no face evidence', async () => {
    const el = await setup(identityEvidence);

    expect(el.textContent).toContain('Clock in');
    expect(el.textContent).toContain('Clock out');
    expect(el.querySelector('[data-testid="computer-on"]')!.textContent).toContain('–');
    expect(el.querySelectorAll('.device-bar__run')).toHaveLength(3);
    expect(el.textContent).toContain('Working 1h');
    expect(el.textContent).toContain('Off 40m');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).not.toContain('Face');
    expect(el.textContent).not.toContain('Clocked in from');
  });

  it('shows the attendance status only when something was off', async () => {
    expect((await setup(identityEvidence)).querySelector('[data-testid="attendance-status"]')).toBeNull();
    TestBed.resetTestingModule();

    const late = await setup({ ...identityEvidence, attendance: { ...identityEvidence.attendance!, status: 'late' } });
    expect(late.querySelector('[data-testid="attendance-status"]')!.textContent).toContain('Late');
  });

  it('shows the pattern for a multi-day alert', async () => {
    const el = await setup(lowActivityEvidence);

    const pattern = el.querySelector('[data-testid="evidence-pattern"]')!;
    expect(pattern.textContent).toContain('Alert when the activity score stays below');
    expect(pattern.textContent).toContain('3 days');
    expect(pattern.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(pattern.querySelectorAll('tbody tr.evidence-table__rule')).toHaveLength(2);
    expect(pattern.textContent).toContain('Forgot to clock out');
  });

  it('warns when several devices were used', async () => {
    const el = await setup({ ...identityEvidence, deviceActivity: { ...identityEvidence.deviceActivity!, deviceIds: ['d1', 'd2'] } });
    expect(el.textContent).toContain('2 different devices used this day');
  });

  it('says so briefly when there is no computer activity or no access to it', async () => {
    const none = await setup({ ...identityEvidence, deviceActivity: { ...identityEvidence.deviceActivity!, segments: [], firstSeenAt: null, lastSeenAt: null } });
    expect(none.textContent).toContain('No computer activity reported.');
    expect(none.querySelector('[data-testid="computer-on"]')).toBeNull();
    TestBed.resetTestingModule();

    const hidden = await setup({ ...lowActivityEvidence, deviceActivity: null, activityHidden: true });
    expect(hidden.querySelector('[data-testid="activity-hidden"]')).not.toBeNull();
    expect(hidden.querySelector('.device-bar')).toBeNull();
  });

  it('marks figures recalculated for an older case', async () => {
    const older = await setup({ ...lowActivityEvidence, pattern: { ...lowActivityEvidence.pattern!, measuresRecalculated: true } });
    expect(older.querySelector('[data-testid="measures-recalculated"]')).not.toBeNull();
  });

  it('does not crash when the server left sections out', async () => {
    const stripped = { ...identityEvidence, attendance: undefined, pattern: null, deviceActivity: null, activityHidden: true } as unknown as ExceptionEvidenceResponse;
    const el = await setup(stripped);
    expect(el.textContent).toContain('Clock in');
  });
});
