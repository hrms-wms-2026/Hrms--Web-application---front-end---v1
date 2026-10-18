import { Component, effect, input, output, signal } from '@angular/core';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { InboxChangeDto } from '../../models/inbox.dto';

/** One break of a "breaks" row, as the API takes it. */
export interface InboxBreak {
  breakStart: string;
  breakEnd: string;
  breakType: string;
}

/** Reads a breaks JSON value (camelCase or PascalCase rows) into the editor's shape. */
export function parseBreaks(json: string | null | undefined): InboxBreak[] {
  if (!json) return [];
  try {
    const rows = JSON.parse(json);
    if (!Array.isArray(rows)) return [];
    return rows.map((r: Record<string, unknown>) => ({
      breakStart: String(r['breakStart'] ?? r['BreakStart'] ?? ''),
      breakEnd: String(r['breakEnd'] ?? r['BreakEnd'] ?? ''),
      breakType: String(r['breakType'] ?? r['BreakType'] ?? 'break')
    }));
  } catch {
    return [];
  }
}

/** ISO instant → the value of a datetime-local input (local time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A datetime-local value (local time) → ISO instant; '' stays ''. */
export function fromLocalInput(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  return isNaN(d.getTime()) ? local : d.toISOString();
}

/** Overwrites the edited keys on the requested payload. Keys are the payload's own property names. */
export function buildEditedPayload(requestedJson: string | null, changes: readonly InboxChangeDto[], edits: Record<string, string>): string | undefined {
  const keys = Object.keys(edits);
  if (keys.length === 0) return undefined;
  const payload = requestedJson ? JSON.parse(requestedJson) as Record<string, unknown> : {};
  for (const key of keys) {
    const change = changes.find((c) => c.field === key);
    if (!change) continue;
    const raw = edits[key].trim();
    if (change.kind === 'breaks') payload[key] = parseBreaks(raw);
    else payload[key] = raw === '' ? null : change.kind === 'number' || change.kind === 'hours' ? Number(raw) : raw;
  }
  return JSON.stringify(payload);
}

/** Field key → message for edits that cannot be sent. */
export function validateEdits(changes: readonly InboxChangeDto[], edits: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, raw] of Object.entries(edits)) {
    const change = changes.find((c) => c.field === key);
    if (!change || raw.trim() === '') continue;
    if (change.kind === 'number' || change.kind === 'hours') {
      const n = Number(raw);
      if (!Number.isFinite(n)) errors[key] = 'Enter a number.';
      else if (change.kind === 'hours' && n <= 0) errors[key] = 'Hours must be greater than zero.';
    } else if (change.kind === 'datetime') {
      if (isNaN(new Date(raw).getTime())) errors[key] = 'Enter a valid date and time.';
    } else if (change.kind === 'time') {
      if (!/^\d{2}:\d{2}$/.test(raw.trim())) errors[key] = 'Enter a time (HH:mm).';
    } else if (change.kind === 'breaks') {
      const breaks = parseBreaks(raw);
      if (breaks.some((b) => !b.breakStart || !b.breakEnd)) errors[key] = 'Each break needs a start and an end.';
      else if (breaks.some((b) => new Date(b.breakEnd).getTime() <= new Date(b.breakStart).getTime())) errors[key] = 'Each break must end after it starts.';
    }
  }
  return errors;
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

/** The change set of a request: before → requested (→ applied). When `editable`, the approver can adjust
 *  the requested values in place before approving ("edit before approve"). One editor per field kind:
 *  text, longtext, number, hours, date, datetime, time, select, employee, priority, breaks. */
@Component({
  selector: 'app-inbox-change-set',
  standalone: true,
  imports: [DatePickerComponent, SelectComponent],
  template: `
    <div class="ics" data-testid="inbox-change-set">
      @for (c of changes(); track c.field) {
        <div class="ics__field" [class.ics__field--changed]="c.before !== c.after" data-testid="inbox-change" [attr.data-field]="c.field">
          <div class="ics__label">{{ c.label }}</div>
          <div class="ics__grid">
            <div class="ics__cell"><div class="ics__mini">Current</div><div class="ics__value">{{ display(c, c.before) }}</div></div>
            <div class="ics__cell">
              <div class="ics__mini">Requested</div>
              @if (editable() && c.editable) {
                @switch (c.kind) {
                  @case ('date') {
                    <app-date-picker class="ics__control" [value]="editValue(c)" [showQuickPresets]="false" [ariaLabel]="c.label"
                      [inputTestId]="'inbox-edit-' + c.field" (valueChange)="setEdit(c, $event)" />
                  }
                  @case ('datetime') {
                    <input class="ics__input" type="datetime-local" [attr.data-testid]="'inbox-edit-' + c.field" [attr.aria-label]="c.label"
                      [value]="localValue(editValue(c))" (input)="setEdit(c, fromLocal($any($event.target).value))" />
                  }
                  @case ('time') {
                    <input class="ics__input" type="time" [attr.data-testid]="'inbox-edit-' + c.field" [attr.aria-label]="c.label"
                      [value]="editValue(c)" (input)="setEdit(c, $any($event.target).value)" />
                  }
                  @case ('priority') {
                    <app-select class="ics__select" [attr.data-testid]="'inbox-edit-' + c.field" [ariaLabel]="c.label"
                      [options]="priorityOptions" [value]="editValue(c)" [searchable]="false" (valueChange)="setEdit(c, $event)" />
                  }
                  @case ('longtext') {
                    <textarea class="ics__input ics__textarea" rows="3" [attr.data-testid]="'inbox-edit-' + c.field" [attr.aria-label]="c.label"
                      [value]="editValue(c)" (input)="setEdit(c, $any($event.target).value)"></textarea>
                  }
                  @case ('breaks') {
                    <div class="ics__breaks" [attr.data-testid]="'inbox-edit-' + c.field">
                      @for (b of breaksOf(c); track $index; let i = $index) {
                        <div class="ics__break" data-testid="inbox-break-row">
                          <input class="ics__input" type="datetime-local" aria-label="Break start" [attr.data-testid]="'inbox-break-start-' + i"
                            [value]="localValue(b.breakStart)" (input)="setBreak(c, i, 'breakStart', fromLocal($any($event.target).value))" />
                          <input class="ics__input" type="datetime-local" aria-label="Break end" [attr.data-testid]="'inbox-break-end-' + i"
                            [value]="localValue(b.breakEnd)" (input)="setBreak(c, i, 'breakEnd', fromLocal($any($event.target).value))" />
                          <button type="button" class="ics__icon-btn" aria-label="Remove break" [attr.data-testid]="'inbox-break-remove-' + i"
                            (click)="removeBreak(c, i)">×</button>
                        </div>
                      }
                      <button type="button" class="ics__add" data-testid="inbox-break-add" (click)="addBreak(c)">+ Add break</button>
                    </div>
                  }
                  @default {
                    @if (c.kind === 'select' || (c.kind === 'employee' && c.options?.length)) {
                      <app-select class="ics__select" [attr.data-testid]="'inbox-edit-' + c.field" [ariaLabel]="c.label"
                        [options]="c.options ?? []" [value]="editValue(c)" (valueChange)="setEdit(c, $event)" />
                    } @else {
                      <span class="ics__input-wrap">
                        <input class="ics__input ics__input--bare" [attr.data-testid]="'inbox-edit-' + c.field" [attr.aria-label]="c.label"
                          [type]="c.kind === 'number' || c.kind === 'hours' ? 'number' : 'text'"
                          [value]="editValue(c)" (input)="setEdit(c, $any($event.target).value)" />
                        @if (c.kind === 'hours') { <span class="ics__suffix">h</span> }
                      </span>
                    }
                  }
                }
                @if (errors()[c.field]; as err) {
                  <span class="ics__error" role="alert" [attr.data-testid]="'inbox-edit-error-' + c.field">{{ err }}</span>
                }
              } @else {
                <div class="ics__value ics__requested">{{ display(c, c.applied ?? c.after) }}</div>
                @if (c.applied !== null && c.applied !== c.after) {
                  <div class="ics__was" data-testid="inbox-change-applied">Requested {{ display(c, c.after) }}, changed by the approver</div>
                }
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .ics { display: flex; flex-direction: column; gap: 8px; }
    .ics__field { min-width: 0; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 12px; background: color-mix(in srgb, var(--color-surface-secondary) 30%, transparent); }
    .ics__field--changed { border-color: color-mix(in srgb, var(--color-accent) 40%, var(--color-border)); }
    .ics__label { margin-bottom: 6px; color: var(--color-text-primary); font-size: 12px; font-weight: 650; }
    .ics__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ics__cell { min-width: 0; }
    .ics__mini { margin-bottom: 2px; color: var(--color-text-secondary); font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .ics__value { color: var(--color-text-primary); font-size: 12px; overflow-wrap: anywhere; white-space: pre-line; }
    .ics__field--changed .ics__requested { color: var(--color-accent); font-weight: 650; }
    .ics__was { margin-top: 2px; color: var(--color-text-secondary); font-size: 10px; overflow-wrap: anywhere; }
    .ics__control { display: block; width: 100%; min-width: 0; }
    .ics__control ::ng-deep .dp-input { height: 32px; padding: 0 30px 0 8px; border-radius: 8px; font-size: 12px; }
    .ics__input-wrap { display: flex; height: 32px; width: 100%; min-width: 0; align-items: center; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .ics__input-wrap:focus-within, .ics__input:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .ics__input { width: 100%; min-width: 0; height: 32px; padding: 6px 8px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 12px; outline: none; }
    /* The shared dropdown, sized like the inline inputs beside it. */
    .ics__select { width: 100%; min-width: 0; }
    .ics__select ::ng-deep .app-select__trigger { height: 32px; padding: 6px 8px; border-radius: 8px; font-size: 12px; }
    .ics__input--bare { height: auto; border: 0; background: transparent; box-shadow: none !important; }
    .ics__textarea { height: auto; min-height: 64px; resize: vertical; }
    .ics__suffix { padding-right: 8px; color: var(--color-text-secondary); font-size: 12px; }
    .ics__error { display: block; margin-top: 3px; color: var(--color-danger); font-size: 11px; }
    .ics__breaks { display: flex; flex-direction: column; gap: 6px; }
    .ics__break { display: grid; grid-template-columns: 1fr 1fr auto; gap: 4px; align-items: center; }
    .ics__icon-btn { width: 28px; height: 28px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; }
    .ics__add { align-self: flex-start; padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  `]
})
export class InboxChangeSetComponent {
  changes = input.required<readonly InboxChangeDto[]>();
  /** The caller may adjust requested values before approving. */
  editable = input(false);
  errors = input<Record<string, string>>({});
  editsChange = output<Record<string, string>>();

  protected readonly priorities = PRIORITIES;
  /** The app's shared dropdown takes options, not <option> children. */
  protected readonly priorityOptions: readonly SelectOption[] = PRIORITIES.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }));
  protected readonly localValue = toLocalInput;
  protected readonly fromLocal = fromLocalInput;
  private readonly edits = signal<Record<string, string>>({});

  constructor() {
    // A different change set starts with no edits.
    effect(() => {
      this.changes();
      this.edits.set({});
    });
  }

  protected editValue(change: InboxChangeDto): string {
    return this.edits()[change.field] ?? change.after ?? '';
  }

  protected setEdit(change: InboxChangeDto, value: string): void {
    const next = { ...this.edits() };
    // Setting a value back to what was requested is no edit.
    if (value === (change.after ?? '')) delete next[change.field];
    else next[change.field] = value;
    this.edits.set(next);
    this.editsChange.emit(next);
  }

  protected breaksOf(change: InboxChangeDto): InboxBreak[] {
    return parseBreaks(this.editValue(change));
  }

  protected setBreak(change: InboxChangeDto, index: number, key: 'breakStart' | 'breakEnd', value: string): void {
    const breaks = this.breaksOf(change);
    breaks[index] = { ...breaks[index], [key]: value };
    this.setEdit(change, JSON.stringify(breaks));
  }

  protected addBreak(change: InboxChangeDto): void {
    this.setEdit(change, JSON.stringify([...this.breaksOf(change), { breakStart: '', breakEnd: '', breakType: 'break' }]));
  }

  protected removeBreak(change: InboxChangeDto, index: number): void {
    this.setEdit(change, JSON.stringify(this.breaksOf(change).filter((_, i) => i !== index)));
  }

  protected capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  protected display(change: InboxChangeDto, value: string | null): string {
    if (value === null || value === '') return '—';
    switch (change.kind) {
      case 'hours': return `${value}h`;
      case 'priority': return this.capitalize(value);
      case 'select':
      case 'employee': return change.options?.find((o) => o.value === value)?.label ?? value;
      case 'date': {
        const date = new Date(`${value}T00:00:00`);
        return isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });
      }
      case 'datetime': return formatDateTime(value);
      case 'breaks': {
        const breaks = parseBreaks(value);
        return breaks.length === 0 ? 'No breaks' : breaks.map((b) => `${formatTime(b.breakStart)} – ${formatTime(b.breakEnd)}`).join('\n');
      }
      default: return value;
    }
  }
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value : d.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' });
}

function formatTime(value: string): string {
  const d = new Date(value);
  return isNaN(d.getTime()) ? value || '?' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
