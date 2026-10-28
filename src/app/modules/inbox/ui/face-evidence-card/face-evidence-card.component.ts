import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, signal, viewChild } from '@angular/core';
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
  /** The try that raised the case. */
  flagged: boolean;
  hint: string | null;
  photoUrl: string | null;
}

const SHORT_RESULTS: Record<string, string | undefined> = {
  passed: 'Passed', failed: 'Failed', overridden: 'Let through', verified: 'Matched', not_matched: 'No match'
};

/** The face side of an identity alert, shown as a message in its conversation: every face check of the day -
 *  clock-in/out tries and the desktop app's work photos - one short row each, in time order. Clicking a row with a
 *  photo opens it full page, where the other tries' photos can be stepped through. */
@Component({
  selector: 'app-face-evidence-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length > 0) {
      <div class="fec" data-testid="face-evidence-card">
        <ul class="fec__rows" data-testid="face-evidence-rows">
          @for (row of rows(); track row.key) {
            <li [class.fec__row--bad]="row.bad" [class.fec__row--flagged]="row.flagged" [class.fec__row--open]="!!row.photoUrl"
                [attr.title]="row.hint" [attr.role]="row.photoUrl ? 'button' : null" [attr.tabindex]="row.photoUrl ? 0 : null"
                [attr.aria-label]="row.photoUrl ? 'Open the ' + row.time + ' ' + row.what + ' photo' : null"
                (click)="row.photoUrl && open(row.key)" (keydown.enter)="row.photoUrl && open(row.key)"
                (keydown.space)="row.photoUrl && open(row.key); $event.preventDefault()">
              @if (row.photoUrl && !failed().has(row.photoUrl)) {
                <span class="fec__thumb" aria-hidden="true">
                  <img [src]="row.photoUrl" alt="" (error)="markFailed(row.photoUrl)" />
                </span>
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

      <dialog tabindex="-1" #viewer class="fec__viewer" data-testid="face-photo-viewer" aria-label="Face check photo"
              (close)="viewing.set(null)" (click)="onViewerClick($event)" (keydown)="onViewerKey($event)">
        @if (current(); as row) {
          <div class="fec__viewer-bar">
            <span class="fec__viewer-caption">{{ row.time }} · {{ row.what }} · {{ row.result }}@if (row.hint) { · {{ row.hint }} }</span>
            <span class="fec__viewer-count">{{ position() }}</span>
            <button type="button" class="fec__viewer-btn" aria-label="Close" (click)="close()">✕</button>
          </div>
          <div class="fec__viewer-stage">
            @if (photoRows().length > 1) {
              <button type="button" class="fec__viewer-btn fec__viewer-nav" aria-label="Previous photo" (click)="step(-1)">‹</button>
            }
            @if (row.photoUrl && !failed().has(row.photoUrl)) {
              <img class="fec__viewer-img" [src]="row.photoUrl" alt="Face check photo" (error)="markFailed(row.photoUrl)" />
            } @else {
              <div class="fec__viewer-none">Photo unavailable</div>
            }
            @if (photoRows().length > 1) {
              <button type="button" class="fec__viewer-btn fec__viewer-nav" aria-label="Next photo" (click)="step(1)">›</button>
            }
          </div>
        }
      </dialog>
    }
  `,
  styles: [`
    :host { display: block; }
    .fec { min-width: 260px; }
    .fec__rows { display: flex; flex-direction: column; gap: 3px; margin: 0; padding: 0; list-style: none; }
    .fec__rows li { display: grid; grid-template-columns: 34px 66px 1fr auto 38px; gap: 10px; align-items: center; min-height: 40px; padding: 3px 8px 3px 3px;
      border-radius: 7px; color: var(--color-text-primary); font-size: 13px; }
    .fec__row--open { cursor: zoom-in; }
    .fec__row--open:hover { filter: brightness(0.96); }
    .fec__row--open:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .fec__thumb { display: block; width: 34px; height: 34px; overflow: hidden; border-radius: 6px; background: var(--color-surface); }
    .fec__thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .fec__thumb--none { background: transparent; }
    .fec__time { color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
    .fec__result { font-weight: 600; }
    .fec__score { text-align: right; font-variant-numeric: tabular-nums; }
    .fec__row--bad { background: color-mix(in srgb, var(--color-danger-subtle) 55%, var(--color-surface)); color: var(--color-danger-text) !important; }
    .fec__row--bad .fec__time { color: inherit; }
    .fec__row--flagged .fec__thumb { outline: 2px solid var(--color-accent); outline-offset: 1px; }

    .fec__viewer { width: 100vw; max-width: 100vw; height: 100vh; max-height: 100vh; margin: 0; padding: 0; border: 0;
      background: rgb(0 0 0 / 0.92); color: #fff; }
    .fec__viewer[open] { display: flex; flex-direction: column; }
    .fec__viewer::backdrop { background: rgb(0 0 0 / 0.6); }
    .fec__viewer-bar { display: flex; align-items: center; gap: 12px; padding: 12px 16px; font-size: 13px; }
    .fec__viewer-caption { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fec__viewer-count { color: rgb(255 255 255 / 0.7); font-variant-numeric: tabular-nums; }
    .fec__viewer-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 16px; padding: 0 16px 16px; }
    .fec__viewer-img { max-width: calc(100% - 112px); max-height: 100%; object-fit: contain; border-radius: 8px; }
    .fec__viewer-none { color: rgb(255 255 255 / 0.7); font-size: 14px; }
    .fec__viewer-btn { flex: none; width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgb(255 255 255 / 0.12); color: #fff;
      font-size: 18px; line-height: 1; cursor: pointer; }
    .fec__viewer-nav { font-size: 28px; }
    .fec__viewer-btn:hover { background: rgb(255 255 255 / 0.22); }
    .fec__viewer-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
  `]
})
export class FaceEvidenceCardComponent {
  readonly evidence = input<ExceptionEvidenceResponse | null>(null);

  /** The row whose photo is open full page; null when the viewer is closed. */
  readonly viewing = signal<string | null>(null);
  /** Signed links that failed to load (expired): those show "Photo unavailable". */
  readonly failed = signal<ReadonlySet<string>>(new Set());

  private readonly viewer = viewChild<ElementRef<HTMLDialogElement>>('viewer');

  readonly rows = computed<FaceRow[]>(() => {
    const ev = this.evidence();
    if (!ev) return [];
    const flaggedUrl = ev.identity?.photoUrl ?? null;
    const checks: FaceRow[] = (ev.faceChecks ?? []).map((c) => ({
      key: 'f' + c.id,
      at: c.at,
      time: evidenceTime(c.at, ev.timezone),
      what: c.purpose === 'clock_out' ? 'Clock-out' : 'Clock-in',
      result: this.result(c.outcome),
      score: this.score(c.similarityScore),
      bad: c.outcome !== 'passed',
      flagged: !!flaggedUrl && c.photoUrl === flaggedUrl,
      hint: c.failureReason ? faceReasonLabel(c.failureReason) : null,
      photoUrl: c.photoUrl ?? null
    }));
    const scans: FaceRow[] = (ev.checkInScans ?? []).map((s) => ({
      key: 's' + s.checkInId,
      at: s.at,
      time: evidenceTime(s.at, ev.timezone),
      what: 'Work photo',
      result: this.result(s.scanStatus),
      score: this.score(s.similarityScore),
      bad: s.scanStatus === 'not_matched',
      flagged: false,
      hint: 'A photo the desktop app took during work' + (s.deviceSerialNumber ? ` on ${s.deviceSerialNumber}` : ''),
      photoUrl: null
    }));
    const rows = [...checks, ...scans];

    // The photo that raised the case belongs to one of the rows; a work-photo case only carries it on the case, so
    // it goes on the row it was taken at (or a row of its own) and can still be opened.
    if (flaggedUrl && !rows.some((r) => r.flagged)) {
      const occurredAt = ev.identity?.occurredAt ?? null;
      const at = occurredAt ? rows.find((r) => !r.photoUrl && r.at === occurredAt) : undefined;
      if (at) {
        at.photoUrl = flaggedUrl;
        at.flagged = true;
      } else {
        rows.push({
          key: 'identity', at: occurredAt ?? '', time: occurredAt ? evidenceTime(occurredAt, ev.timezone) : '—',
          what: 'Flagged photo', result: '', score: '', bad: true, flagged: true, hint: null, photoUrl: flaggedUrl
        });
      }
    }
    return rows.sort((a, b) => a.at.localeCompare(b.at));
  });

  /** The rows whose photo can be opened, in the order the viewer steps through them. */
  readonly photoRows = computed(() => this.rows().filter((r) => r.photoUrl));
  readonly current = computed(() => this.photoRows().find((r) => r.key === this.viewing()) ?? null);
  readonly position = computed(() => {
    const index = this.photoRows().findIndex((r) => r.key === this.viewing());
    return index < 0 ? '' : `${index + 1} / ${this.photoRows().length}`;
  });

  constructor() {
    // A different case starts with the viewer closed and its links untried.
    effect(() => {
      this.evidence();
      this.viewing.set(null);
      this.failed.set(new Set());
    });
    effect(() => {
      const dialog = this.viewer()?.nativeElement;
      if (!dialog) return;
      if (this.current() && !dialog.open) {
        // showModal puts it in the top layer, above the inbox panes, whatever their stacking or transforms.
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      } else if (!this.current() && dialog.open) {
        if (typeof dialog.close === 'function') dialog.close();
        else dialog.removeAttribute('open');
      }
    });
  }

  open(key: string): void {
    this.viewing.set(key);
  }

  close(): void {
    this.viewing.set(null);
  }

  step(by: number): void {
    const photos = this.photoRows();
    const index = photos.findIndex((r) => r.key === this.viewing());
    if (index < 0) return;
    this.viewing.set(photos[(index + by + photos.length) % photos.length].key);
  }

  /** A click on the dark area around the photo (the dialog itself, not its content) closes it. */
  onViewerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target === event.currentTarget || target.classList.contains('fec__viewer-stage')) this.close();
  }

  onViewerKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') this.step(-1);
    else if (event.key === 'ArrowRight') this.step(1);
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
