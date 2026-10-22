import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { ExceptionEvidenceResponse } from '../../../../shared/models/exception-evidence.model';
import { FaceEvidenceCardComponent } from './face-evidence-card.component';

const evidence: ExceptionEvidenceResponse = {
  exceptionId: 'a1', type: 'IdentityAnomaly', workDate: '2026-09-28', timezone: 'UTC',
  attendance: null,
  identity: {
    source: 'face_check_override', occurredAt: null, purpose: 'clock_in', similarityScore: 64, reasons: [], deviceRegistrationId: 'd1',
    photoUrl: 'https://signed/photo.jpg', photoUrlExpiresAt: null, photoUnavailable: false
  },
  faceChecks: [
    { id: 'f3', at: '2026-09-28T18:01:00Z', purpose: 'clock_out', outcome: 'passed', failureReason: null, similarityScore: 95 },
    { id: 'f1', at: '2026-09-28T08:58:00Z', purpose: 'clock_in', outcome: 'failed', failureReason: 'not_matched', similarityScore: 61 },
    { id: 'f2', at: '2026-09-28T09:01:00Z', purpose: 'clock_in', outcome: 'overridden', failureReason: null, similarityScore: 64 }
  ],
  checkInScans: [
    { checkInId: 'c1', at: '2026-09-28T13:00:00Z', scanStatus: 'not_matched', similarityScore: 20, deviceRegistrationId: 'd1', deviceSerialNumber: 'SN-1' }
  ],
  deviceActivity: null, pattern: null, activityHidden: false
};

describe('FaceEvidenceCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  function render(ev: ExceptionEvidenceResponse) {
    TestBed.configureTestingModule({ imports: [FaceEvidenceCardComponent] });
    const fixture = TestBed.createComponent(FaceEvidenceCardComponent);
    fixture.componentRef.setInput('evidence', ev);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  const rowTexts = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('[data-testid="face-evidence-rows"] li')).map((li) => Array.from(li.querySelectorAll('span')).map((s) => s.textContent!.trim()).join(' '));

  it('shows one short row per face check, in time order, with no large photo', () => {
    const { el } = render({ ...evidence, identity: { ...evidence.identity!, photoUrl: null } });

    expect(el.querySelector('.fec__photo')).toBeNull();
    const rows = rowTexts(el);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toContain('Clock-in Failed 61%');
    expect(rows[1]).toContain('Clock-in Let through 64%');
    expect(rows[2]).toContain('Work photo No match 20%');
    expect(rows[3]).toContain('Clock-out Passed 95%');
    expect(el.querySelectorAll('.fec__row--bad')).toHaveLength(3);
  });

  const withPhotos: ExceptionEvidenceResponse = {
    ...evidence,
    identity: { ...evidence.identity!, photoUrl: 'https://signed/flagged.jpg' },
    faceChecks: [
      { id: 'f1', at: '2026-09-28T08:58:00Z', purpose: 'clock_in', outcome: 'failed', failureReason: 'not_matched', similarityScore: 61, photoUrl: 'https://signed/try1.jpg' },
      { id: 'f2', at: '2026-09-28T09:01:00Z', purpose: 'clock_in', outcome: 'overridden', failureReason: null, similarityScore: 64, photoUrl: 'https://signed/flagged.jpg' }
    ],
    checkInScans: []
  };
  const viewerImg = (el: HTMLElement) => el.querySelector('[data-testid="face-photo-viewer"] img') as HTMLImageElement | null;

  it('opens the photo full page when the row is clicked and steps through the other photos', () => {
    const { fixture, el } = render(withPhotos);

    expect(el.querySelectorAll('.fec__thumb img')).toHaveLength(2);
    expect(el.querySelector('.fec__row--flagged')).not.toBeNull();
    expect(viewerImg(el)).toBeNull();

    (el.querySelector('.fec__row--open') as HTMLElement).click();
    fixture.detectChanges();
    expect(viewerImg(el)!.src).toBe('https://signed/try1.jpg');
    expect(el.querySelector('.fec__viewer-count')!.textContent).toBe('1 / 2');

    (el.querySelector('[aria-label="Next photo"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(viewerImg(el)!.src).toBe('https://signed/flagged.jpg');

    (el.querySelector('[aria-label="Close"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(viewerImg(el)).toBeNull();
  });

  it('says the photo is unavailable when its link fails in the viewer', () => {
    const { fixture, el } = render(withPhotos);

    (el.querySelector('.fec__row--open') as HTMLElement).click();
    fixture.detectChanges();
    viewerImg(el)!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(viewerImg(el)).toBeNull();
    expect(el.textContent).toContain('Photo unavailable');
  });

  it('puts a work-photo case photo on its own row so it can still be opened', () => {
    const { el } = render({
      ...evidence,
      identity: { ...evidence.identity!, source: 'check_in_scan', occurredAt: '2026-09-28T13:00:00Z', photoUrl: 'https://signed/scan.jpg' }
    });

    const flagged = el.querySelector('.fec__row--flagged')!;
    expect(flagged.textContent).toContain('Work photo');
    expect((flagged.querySelector('.fec__thumb img') as HTMLImageElement).src).toBe('https://signed/scan.jpg');
  });

  it('renders nothing when there are no face checks and no photo', () => {
    const { el } = render({ ...evidence, identity: null, faceChecks: [], checkInScans: [] });
    expect(el.querySelector('[data-testid="face-evidence-card"]')).toBeNull();
  });
});
