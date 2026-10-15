import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExceptionEvidenceResponse } from '../../models/exception-evidence.model';
import { ExceptionEvidencePanelComponent } from './exception-evidence-panel.component';

const identityEvidence: ExceptionEvidenceResponse = {
  exceptionId: 'a1',
  type: 'IdentityAnomaly',
  workDate: '2026-09-28',
  timezone: 'Asia/Colombo',
  attendance: { clockInAt: '2026-09-28T03:30:00Z', clockOutAt: null, source: 'desktop_tray', status: 'present' },
  identity: {
    source: 'face_check_override', occurredAt: '2026-09-28T03:30:00Z', purpose: 'clock_in', similarityScore: 12,
    reasons: ['poor_lighting', 'not_matched'], deviceRegistrationId: 'd1',
    photoUrl: 'https://signed/photo.jpg', photoUrlExpiresAt: '2026-09-28T03:35:00Z', photoUnavailable: false
  },
  faceChecks: [
    { id: 'f1', at: '2026-09-28T03:28:00Z', purpose: 'clock_in', outcome: 'failed', failureReason: 'poor_lighting', similarityScore: null },
    { id: 'f2', at: '2026-09-28T03:30:00Z', purpose: 'clock_in', outcome: 'overridden', failureReason: 'not_matched', similarityScore: 12 }
  ],
  checkInScans: [
    { checkInId: 'c1', at: '2026-09-28T05:00:00Z', scanStatus: 'not_matched', similarityScore: 21.5, deviceRegistrationId: 'd1', deviceSerialNumber: 'SN-1' }
  ],
  deviceActivity: {
    firstSeenAt: '2026-09-28T03:30:00Z', lastSeenAt: '2026-09-28T05:30:00Z',
    activeMinutes: 60, idleMinutes: 20, offlineMinutes: 40, deviceIds: ['d1'],
    segments: [
      { start: '2026-09-28T03:30:00Z', end: '2026-09-28T04:30:00Z', state: 'active' },
      { start: '2026-09-28T04:30:00Z', end: '2026-09-28T05:10:00Z', state: 'offline' },
      { start: '2026-09-28T05:10:00Z', end: '2026-09-28T05:30:00Z', state: 'idle' }
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
  checkInScans: [],
  pattern: {
    from: '2026-09-09', to: '2026-09-15',
    days: [
      { date: '2026-09-12', activityScore: 80, activeMinutes: 400, idleMinutes: 20, workedMinutes: 480, attendanceStatus: 'present', inRule: false },
      { date: '2026-09-13', activityScore: 25, activeMinutes: 90, idleMinutes: 200, workedMinutes: 470, attendanceStatus: 'present', inRule: true },
      { date: '2026-09-14', activityScore: 30, activeMinutes: 100, idleMinutes: 210, workedMinutes: 465, attendanceStatus: 'present', inRule: true },
      { date: '2026-09-15', activityScore: 20, activeMinutes: 70, idleMinutes: 250, workedMinutes: null, attendanceStatus: 'missing_clock_out', inRule: true }
    ],
    measures: [
      { label: 'Alert when the activity score stays below', value: 40, unit: 'score' },
      { label: 'For this many days in a row', value: 3, unit: 'days' },
      { label: 'Average score over those days', value: 25, unit: 'score' }
    ],
    measuresRecalculated: false
  }
};

describe('ExceptionEvidencePanelComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  /** The host passes the evidence it loaded (the Inbox detail's evidence payload). */
  async function setup(response: () => Observable<ExceptionEvidenceResponse>) {
    let evidence: ExceptionEvidenceResponse | null = null;
    response().subscribe((value) => (evidence = value));
    await TestBed.configureTestingModule({ imports: [ExceptionEvidencePanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ExceptionEvidencePanelComponent);
    fixture.componentRef.setInput('evidence', evidence);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the triggering photo, readable reasons, the day\'s face checks and check-in scans', async () => {
    const { el } = await setup(() => of(identityEvidence));

    const img = el.querySelector('img') as HTMLImageElement;
    expect(img.src).toBe('https://signed/photo.jpg');
    expect(el.textContent).toContain('Clock-in/out face check failed and was let through');
    expect(el.textContent).toContain('Poor lighting');
    expect(el.textContent).toContain('Face did not match');
    expect(el.querySelectorAll('[data-testid="evidence-face-checks"] li')).toHaveLength(2);
    expect(el.querySelector('[data-testid="evidence-scans"]')!.textContent).toContain('SN-1');
    expect(el.textContent).toContain('desktop_tray');
  });

  it('tells the reviewer to reopen when the signed photo link has expired', async () => {
    const { fixture, el } = await setup(() => of(identityEvidence));

    (el.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('Photo link expired');
  });

  it('says so when no photo was kept', async () => {
    const { el } = await setup(() => of({ ...identityEvidence, identity: { ...identityEvidence.identity!, photoUrl: null } }));

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('No photo kept');
  });

  it('tells a kept-but-unservable photo apart from no photo', async () => {
    const { el } = await setup(() => of({
      ...identityEvidence, identity: { ...identityEvidence.identity!, photoUrl: null, photoUnavailable: true }
    }));

    expect(el.textContent).toContain('Photo unavailable right now');
    expect(el.textContent).not.toContain('No photo kept');
  });

  it('shows attendance, device activity and the pattern - but no identity sections - for a multi-day alert', async () => {
    const { el } = await setup(() => of(lowActivityEvidence));

    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('Clock-in / clock-out');
    expect(el.textContent).not.toContain('Face checks that day');

    const pattern = el.querySelector('[data-testid="evidence-pattern"]')!;
    expect(pattern.textContent).toContain('Alert when the activity score stays below');
    expect(pattern.textContent).toContain('3 days');
    expect(pattern.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(pattern.querySelectorAll('tbody tr.evidence-table__rule')).toHaveLength(3);
    expect(pattern.textContent).toContain('missing clock out');
  });

  it('draws the device timeline with totals, and warns when several devices reported', async () => {
    const one = await setup(() => of(identityEvidence));
    const device = one.el.querySelector('[data-testid="evidence-device"]')!;
    expect(device.textContent).toContain('1h');
    expect(device.textContent).toContain('40m');
    expect(device.querySelectorAll('.device-bar__run')).toHaveLength(3);
    expect(device.querySelector('.device-bar__run[data-state="offline"]')).not.toBeNull();
    expect(device.textContent).not.toContain('different devices');
    TestBed.resetTestingModule();

    const two = await setup(() => of({
      ...identityEvidence, deviceActivity: { ...identityEvidence.deviceActivity!, deviceIds: ['d1', 'd2'] }
    }));
    expect(two.el.textContent).toContain('2 different devices reported activity this day');
  });

  it('explains missing device data without reading it as a finding', async () => {
    const { el } = await setup(() => of({
      ...identityEvidence,
      deviceActivity: { ...identityEvidence.deviceActivity!, segments: [], firstSeenAt: null, lastSeenAt: null }
    }));

    const text = el.querySelector('[data-testid="evidence-device"]')!.textContent!;
    expect(text).toContain('No device data for this day');
    expect(text).toContain('may not be installed or running');
  });

  it('tells a reviewer without monitoring access why activity is not shown', async () => {
    const { el } = await setup(() => of({ ...lowActivityEvidence, deviceActivity: null, activityHidden: true }));

    expect(el.querySelector('[data-testid="activity-hidden"]')!.textContent).toContain('monitoring access');
    expect(el.querySelector('.device-bar')).toBeNull();
    // The reason for the alert is still there.
    expect(el.querySelector('[data-testid="evidence-pattern"]')!.textContent).toContain('Alert when the activity score stays below');
  });

  it('marks figures recalculated for an older case', async () => {
    const stored = await setup(() => of(lowActivityEvidence));
    expect(stored.el.querySelector('[data-testid="measures-recalculated"]')).toBeNull();
    TestBed.resetTestingModule();

    const older = await setup(() => of({ ...lowActivityEvidence, pattern: { ...lowActivityEvidence.pattern!, measuresRecalculated: true } }));
    expect(older.el.querySelector('[data-testid="measures-recalculated"]')).not.toBeNull();
  });

  it('shows the empty state when there is nothing for that day', async () => {
    const { el } = await setup(() => of({
      ...identityEvidence, attendance: null, identity: null, faceChecks: [], checkInScans: [],
      deviceActivity: { ...identityEvidence.deviceActivity!, segments: [] }, pattern: null
    }));

    expect(el.textContent).toContain('No attendance or identity records were found');
  });

  it('does not crash when the server left sections out (monitoring-only data)', async () => {
    const stripped = { ...identityEvidence, faceChecks: undefined, checkInScans: undefined, pattern: null, deviceActivity: null, activityHidden: true } as unknown as ExceptionEvidenceResponse;
    const { el } = await setup(() => of(stripped));

    expect(el.querySelector('img')).not.toBeNull();
    expect(el.querySelectorAll('[data-testid="evidence-face-checks"] li')).toHaveLength(0);
  });
});
