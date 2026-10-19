import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';
import { ExceptionEvidenceResponse, faceOutcomeLabel, faceReasonLabel } from '../../../../shared/models/exception-evidence.model';
import { evidenceTime } from '../../../../shared/ui/exception-evidence-panel/exception-evidence-panel.component';

interface FaceRow {
  key: string;
  at: string;
  time: string;
  what: string;
  result: string;
  score: string;
  bad: boolean;
  hint: string | null;
  photoUrl: string | null;
  photoUnavailable: boolean;
}

const SHORT_RESULTS: Record<string, string | undefined> = {
  passed: 'Passed', failed: 'Failed', overridden: 'Let through', verified: 'Matched', not_matched: 'No match'
};

/** The face side of an identity alert, shown as a message in its conversation: the photo of the selected try (the
 *  flagged one first) and every face check of the day - clock-in/out tries and the desktop app's work photos - one
 *  short row each, in time order. A row's thumbnail shows that try's photo large. */
@Component({
  selector: 'app-face-evidence-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length > 0 || mainPhoto()) {
      <div class="fec" data-testid="face-evidence-card">
        @if (mainPhoto(); as photo) {
          @if (photo.url && !failed().has(photo.url)) {
            <img class="fec__photo" [src]="photo.url" alt="Face check photo" (error)="markFailed(photo.url)" />
          } @else {
            <div class="fec__photo fec__photo--none">Photo unavailable</div>
          }
        }
        <ul class="fec__rows" data-testid="face-evidence-rows">
          @for (row of rows(); track row.key) {
            <li [class.fec__row--bad]="row.bad" [class.fec__row--selected]="row.photoUrl && row.photoUrl === mainPhoto()?.url" [attr.title]="row.hint">
              @if (row.photoUrl && !failed().has(row.photoUrl)) {
                <button type="button" class="fec__thumb" [attr.aria-label]="'Show the ' + row.time + ' photo'" (click)="selected.set(row.key)">
                  <img [src]="row.photoUrl" alt="" (error)="markFailed(row.photoUrl)" />
                </button>
              } @else {
                <span class="fec__thumb fec__thumb--none" aria-hidden="true"></span>
              }
              <span class="fec__time">{{ row.time }}</span>
              <span>{{ row.what }}</span>
              <span class="fec__result">{{ row.result }}</span>
              <span class="fec__score">{{ row.score }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .fec { display: flex; flex-direction: column; gap: 8px; min-width: 260px; }
    .fec__photo { width: 120px; height: 150px; border-radius: 8px; object-fit: cover; background: var(--color-surface); }
    .fec__photo--none { display: flex; align-items: center; justify-content: center; padding: 6px; color: var(--color-text-secondary); font-size: 11px; text-align: center; }
    .fec__rows { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; list-style: none; }
    .fec__rows li { display: grid; grid-template-columns: 26px 62px 1fr auto 36px; gap: 8px; align-items: center; padding: 2px 6px 2px 2px; border-radius: 6px;
      color: var(--color-text-primary); font-size: 12px; }
    .fec__thumb { width: 26px; height: 26px; padding: 0; overflow: hidden; border: 0; border-radius: 5px; background: var(--color-surface); cursor: pointer; }
    .fec__thumb img { width: 100%; height: 100%; object-fit: cover; }
    .fec__thumb--none { cursor: default; background: transparent; }
    .fec__thumb:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .fec__time { color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
    .fec__result { font-weight: 600; }
    .fec__score { text-align: right; font-variant-numeric: tabular-nums; }
    .fec__row--bad { background: color-mix(in srgb, var(--color-danger-subtle) 55%, var(--color-surface)); color: var(--color-danger-text) !important; }
    .fec__row--bad .fec__time { color: inherit; }
    .fec__row--selected .fec__thumb { outline: 2px solid var(--color-accent); outline-offset: 1px; }
  `]
})
export class FaceEvidenceCardComponent {
  readonly evidence = input<ExceptionEvidenceResponse | null>(null);

  /** The row whose photo is shown large; null shows the flagged photo. */
  readonly selected = signal<string | null>(null);
  /** Signed links that failed to load (expired): those show "Photo unavailable". */
  readonly failed = signal<ReadonlySet<string>>(new Set());

  readonly rows = computed<FaceRow[]>(() => {
    const ev = this.evidence();
    if (!ev) return [];
    const checks: FaceRow[] = (ev.faceChecks ?? []).map((c) => ({
      key: 'f' + c.id,
      at: c.at,
      time: evidenceTime(c.at, ev.timezone),
      what: c.purpose === 'clock_out' ? 'Clock-out' : 'Clock-in',
      result: this.result(c.outcome),
      score: this.score(c.similarityScore),
      bad: c.outcome !== 'passed',
      hint: c.failureReason ? faceReasonLabel(c.failureReason) : null,
      photoUrl: c.photoUrl ?? null,
      photoUnavailable: !!c.photoUnavailable
    }));
    const scans: FaceRow[] = (ev.checkInScans ?? []).map((s) => ({
      key: 's' + s.checkInId,
      at: s.at,
      time: evidenceTime(s.at, ev.timezone),
      what: 'Work photo',
      result: this.result(s.scanStatus),
      score: this.score(s.similarityScore),
      bad: s.scanStatus === 'not_matched',
      hint: 'A photo the desktop app took during work' + (s.deviceSerialNumber ? ` on ${s.deviceSerialNumber}` : ''),
      photoUrl: null,
      photoUnavailable: false
    }));
    return [...checks, ...scans].sort((a, b) => a.at.localeCompare(b.at));
  });

  /** The photo shown large: the selected row's, else the flagged one, else the first try that kept a photo. */
  readonly mainPhoto = computed<{ url: string | null } | null>(() => {
    const picked = this.rows().find((r) => r.key === this.selected());
    if (picked?.photoUrl) return { url: picked.photoUrl };
    const identity = this.evidence()?.identity;
    if (identity?.photoUrl) return { url: identity.photoUrl };
    const first = this.rows().find((r) => r.photoUrl);
    if (first) return { url: first.photoUrl };
    return identity?.photoUnavailable || this.rows().some((r) => r.photoUnavailable) ? { url: null } : null;
  });

  constructor() {
    // A different case starts on its flagged photo.
    effect(() => {
      this.evidence();
      this.selected.set(null);
      this.failed.set(new Set());
    });
  }

  markFailed(url: string): void {
    this.failed.update((set) => new Set([...set, url]));
  }

  private result(value: string | null): string {
    return (value && SHORT_RESULTS[value.toLowerCase()]) ?? faceOutcomeLabel(value);
  }

  private score(value: number | null): string {
    return value === null ? '—' : `${Math.round(value)}%`;
  }
}
