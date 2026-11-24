import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { InboxChangeDto } from '../../models/inbox.dto';
import { InboxChangeSetComponent, displayChangeValue } from '../inbox-change-set/inbox-change-set.component';

const DAY: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
const TIME: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const WHEN_KINDS = new Set(['date', 'datetime']);

/** One detail line of a summary: a label and what it is (or what it changes from → to). */
export interface CaseSummaryLine {
  label: string;
  before: string | null;
  after: string;
}

export interface CaseSummary {
  /** What the case is about (a task title, a person, an alert) - null when the first value does not name it. */
  headline: string | null;
  /** "Mon, Oct 12" / "Mon, Oct 12 · 9:30 AM", from the first date row; null when there is none. */
  when: string | null;
  lines: CaseSummaryLine[];
}

function whenOf(change: InboxChangeDto): string {
  const raw = change.after ?? change.before ?? '';
  const date = new Date(change.kind === 'date' ? `${raw}T00:00:00` : raw);
  if (isNaN(date.getTime())) return displayChangeValue(change, raw);
  return change.kind === 'date'
    ? date.toLocaleDateString(undefined, DAY)
    : `${date.toLocaleDateString(undefined, DAY)} · ${date.toLocaleTimeString(undefined, TIME)}`;
}

/** A value that names the case (a task title, a person, an alert type): plain text, not a change, not a bare number.
 *  "3" (extra seats) or "Low → High" (a priority edit) read wrongly without their label, so they stay detail lines. */
function namesTheCase(c: InboxChangeDto): boolean {
  const value = (c.after ?? '').trim();
  const isChange = c.before !== null && c.before !== '' && c.before !== c.after;
  return !isChange && (c.kind === 'text' || c.kind === 'select') && value !== '' && !/^\d+(\.\d+)?$/.test(value);
}

/**
 * A request's or alert's rows as one small card, the way the leave card reads: the first value as the headline when it
 * names the case, the first date as when, and the rest as quiet labelled lines - a change shows "before → after", a plain
 * value just itself. Empty rows are left out.
 */
export function summarize(changes: readonly InboxChangeDto[]): CaseSummary | null {
  const rows = changes.filter((c) => (c.after ?? '') !== '' || (c.before ?? '') !== '');
  if (rows.length === 0) return null;
  const whenRow = rows.find((c) => WHEN_KINDS.has(c.kind));
  const first = rows.find((c) => c !== whenRow);
  const headRow = first && namesTheCase(first) ? first : null;
  const line = (c: InboxChangeDto): CaseSummaryLine => ({
    label: c.label,
    before: c.before !== null && c.before !== '' && c.before !== c.after ? displayChangeValue(c, c.before) : null,
    after: displayChangeValue(c, c.after)
  });
  return {
    headline: headRow ? line(headRow).after : null,
    when: whenRow ? whenOf(whenRow) : null,
    lines: rows.filter((c) => c !== headRow && c !== whenRow).map(line)
  };
}

/** Every case card's body except leave and face checks (which have their own): a compact summary instead of
 *  Current / Requested boxes. When the approver may edit the request first, "Edit" opens the editable rows. */
@Component({
  selector: 'app-case-summary',
  standalone: true,
  imports: [InboxChangeSetComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (summary(); as s) {
      <div class="cs" data-testid="case-summary">
        <div class="cs__head">
          @if (s.headline) { <span class="cs__headline" data-testid="case-summary-headline">{{ s.headline }}</span> }
          @if (editable() && !editing()) {
            <button type="button" class="cs__edit" data-testid="case-summary-edit" (click)="editing.set(true)">
              Edit
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            </button>
          }
        </div>
        @if (s.when) { <div class="cs__when" data-testid="case-summary-when">{{ s.when }}</div> }
        @if (s.lines.length > 0) {
          <dl class="cs__lines">
            @for (l of s.lines; track l.label) {
              <div class="cs__line">
                <dt>{{ l.label }}</dt>
                <dd>
                  @if (l.before) { <span class="cs__before">{{ l.before }}</span><span class="cs__arrow" aria-label="changes to">→</span> }
                  <span class="cs__after">{{ l.after }}</span>
                </dd>
              </div>
            }
          </dl>
        }
        @if (editing()) {
          <div class="cs__form">
            <app-inbox-change-set [changes]="changes()" [editable]="true" [errors]="errors()" (editsChange)="editsChange.emit($event)" />
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .cs { display: flex; min-width: 0; width: 100%; flex-direction: column; gap: 2px; }
    .cs__head { display: flex; align-items: center; gap: 10px; }
    .cs__headline { color: var(--color-text-primary); font-size: 14px; font-weight: 650; overflow-wrap: anywhere; }
    .cs__when { color: var(--color-text-primary); font-size: 13px; }
    .cs__lines { display: flex; flex-direction: column; gap: 2px; margin: 4px 0 0; }
    .cs__line { display: flex; align-items: baseline; gap: 8px; font-size: 12px; }
    .cs__line dt { flex: 0 0 auto; color: var(--color-text-secondary); }
    .cs__line dd { display: flex; min-width: 0; flex-wrap: wrap; align-items: baseline; gap: 4px; margin: 0; color: var(--color-text-primary); white-space: pre-line; }
    .cs__before { color: var(--color-text-secondary); text-decoration: line-through; }
    .cs__arrow { color: var(--color-text-secondary); }
    .cs__after { font-weight: 600; }
    .cs__edit { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: var(--color-accent);
      font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .cs__edit svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .cs__edit:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .cs__form { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--color-border); }
  `]
})
export class CaseSummaryComponent {
  changes = input<readonly InboxChangeDto[]>([]);
  /** The approver may change the request before approving: "Edit" opens the editable rows. */
  editable = input(false);
  errors = input<Record<string, string>>({});
  editsChange = output<Record<string, string>>();

  protected readonly editing = signal(false);
  protected readonly summary = computed(() => summarize(this.changes()));
}
