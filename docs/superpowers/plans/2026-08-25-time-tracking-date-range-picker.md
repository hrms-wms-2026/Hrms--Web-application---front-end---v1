# Time Tracking Date-Range Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Time Tracking page's two From/To date pickers plus a separate Apply button with a single icon-triggered calendar popover that selects a date range in one flow.

**Architecture:** A new standalone Angular component, `DateRangePickerComponent`, modeled on the existing `DatePickerComponent`'s calendar-grid rendering and popover styling but for two-click range selection with immediate emission (no Apply button, no free-text entry). It replaces both `app-date-picker` pairs on the Time Tracking page; the shared single-date `app-date-picker` used elsewhere in the app is untouched.

**Tech Stack:** Angular 21 standalone components, signals (`signal`/`computed`/`input`/`output`), Vitest + Angular TestBed (component specs), no new dependencies.

## Global Constraints

- New component lives at `src/app/shared/ui/date-range-picker/` with selector `app-date-range-picker`.
- Calendar-only selection — no free-text date entry, no "Apply" button, no invalid-range error state (the two-click flow guarantees `from <= to` by construction).
- Only the Time Tracking page's two range controls are touched. The existing `app-date-picker` component and its other three call sites (employee wizard, dependents panel, personal-info form) are not modified.
- Spec: `docs/superpowers/specs/2026-08-25-time-tracking-date-range-picker-design.md` (this repo).

---

### Task 1: Create the `DateRangePickerComponent`

**Files:**
- Create: `src/app/shared/ui/date-range-picker/date-range-picker.component.ts`
- Create: `src/app/shared/ui/date-range-picker/date-range-picker.component.html`
- Create: `src/app/shared/ui/date-range-picker/date-range-picker.component.css`
- Create: `src/app/shared/ui/date-range-picker/date-range-picker.component.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DateRangePickerComponent` (selector `app-date-range-picker`) with `from = input<string>('')`, `to = input<string>('')`, `disabled = input(false)`, `rangeChange = output<{ from: string; to: string }>()` — consumed by Task 2's Time Tracking template.

- [ ] **Step 1: Write the component's test suite against the not-yet-created component**

Create `src/app/shared/ui/date-range-picker/date-range-picker.component.spec.ts`:

```ts
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRangePickerComponent } from './date-range-picker.component';

@Component({
  standalone: true,
  imports: [DateRangePickerComponent],
  template: `
    <app-date-range-picker
      [from]="from"
      [to]="to"
      (rangeChange)="onRangeChange($event)"
    />
  `
})
class TestHostComponent {
  from = '2026-08-17';
  to = '2026-08-23';
  lastEmitted: { from: string; to: string } | null = null;

  onRangeChange(range: { from: string; to: string }): void {
    this.lastEmitted = range;
    this.from = range.from;
    this.to = range.to;
  }
}

describe('DateRangePickerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  function dayButton(label: string): HTMLButtonElement {
    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.drp-day-btn'));
    const match = buttons.find((b) => !b.classList.contains('drp-day-btn--outside') && b.textContent?.trim() === label);
    if (!match) throw new Error(`day button ${label} not found`);
    return match;
  }

  it('renders the calendar icon trigger with the applied range as text', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Aug 17');
    expect(trigger.textContent).toContain('Aug 23');
  });

  it('opens the calendar popover when the trigger is clicked', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('.drp-popover');
    expect(popover).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('August 2026');
  });

  it('navigates months with previous and next buttons', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const nextBtn = fixture.nativeElement.querySelector('.drp-nav-btn:last-of-type') as HTMLButtonElement;
    nextBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('September 2026');

    const prevBtn = fixture.nativeElement.querySelector('.drp-nav-btn:first-of-type') as HTMLButtonElement;
    prevBtn.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('August 2026');
  });

  it('selects a range with two clicks in order and emits rangeChange, closing the popover', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    dayButton('5').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastEmitted).toBeNull();
    expect(fixture.nativeElement.querySelector('.drp-popover')).toBeTruthy();

    dayButton('12').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.lastEmitted).toEqual({ from: '2026-08-05', to: '2026-08-12' });
    expect(fixture.nativeElement.querySelector('.drp-popover')).toBeFalsy();
  });

  it('swaps the picked dates when the second click is before the first', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    dayButton('20').click();
    fixture.detectChanges();
    dayButton('9').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.lastEmitted).toEqual({ from: '2026-08-09', to: '2026-08-20' });
  });

  it('starts a fresh range on the first click after reopening, instead of extending the existing range', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    dayButton('3').click();
    fixture.detectChanges();
    dayButton('7').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastEmitted).toEqual({ from: '2026-08-03', to: '2026-08-07' });

    trigger.click();
    fixture.detectChanges();
    dayButton('14').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastEmitted).toEqual({ from: '2026-08-03', to: '2026-08-07' });

    dayButton('16').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastEmitted).toEqual({ from: '2026-08-14', to: '2026-08-16' });
  });

  it('applies a same-day range immediately when the Today shortcut is clicked', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const todayLink = fixture.nativeElement.querySelector('.drp-today-link') as HTMLButtonElement;
    todayLink.click();
    fixture.detectChanges();

    const emitted = fixture.componentInstance.lastEmitted;
    expect(emitted).not.toBeNull();
    expect(emitted!.from).toBe(emitted!.to);
    expect(fixture.nativeElement.querySelector('.drp-popover')).toBeFalsy();
  });

  it('closes the calendar popover when the Escape key is pressed', () => {
    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.drp-popover')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.drp-popover')).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx ng test --watch=false --include='**/date-range-picker.component.spec.ts'`
Expected: FAIL — `date-range-picker.component.ts` does not exist yet, so this is a compile error, not a runtime assertion failure. That is the expected "red" state for a brand-new component.

- [ ] **Step 3: Create the component TypeScript**

Create `src/app/shared/ui/date-range-picker/date-range-picker.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';

export interface RangeCalendarDay {
  year: number;
  month: number;
  date: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  formattedDate: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatYYYYMMDD(year: number, monthZeroBased: number, date: number): string {
  const m = String(monthZeroBased + 1).padStart(2, '0');
  const d = String(date).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function parseYYYYMMDD(str: string): { year: number; month: number; date: number } | null {
  if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str.trim())) return null;
  const [y, m, d] = str.trim().split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { year: y, month: m - 1, date: d };
}

function formatShortDate(str: string): string {
  const parsed = parseYYYYMMDD(str);
  if (!parsed) return '';
  const date = new Date(parsed.year, parsed.month, parsed.date);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DateRangePickerComponent {
  from = input<string>('');
  to = input<string>('');
  disabled = input(false);

  rangeChange = output<{ from: string; to: string }>();

  readonly isOpen = signal(false);
  readonly openUpward = signal(false);
  readonly pendingStart = signal<string | null>(null);
  readonly hoverDate = signal<string | null>(null);

  private readonly today = new Date();
  readonly todayFormatted = formatYYYYMMDD(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());

  readonly viewYear = signal<number>(this.today.getFullYear());
  readonly viewMonth = signal<number>(this.today.getMonth());

  readonly weekdayNames = WEEKDAY_NAMES;

  readonly currentMonthLabel = computed(() => `${MONTH_NAMES[this.viewMonth()]} ${this.viewYear()}`);

  readonly triggerLabel = computed(() => {
    const from = this.from();
    const to = this.to();
    return from && to ? `${formatShortDate(from)} – ${formatShortDate(to)}` : '';
  });

  readonly calendarDays = computed<RangeCalendarDay[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const pendingStart = this.pendingStart();
    const rangeStart = pendingStart ?? this.from();
    const rangeEndRaw = pendingStart ? (this.hoverDate() ?? pendingStart) : this.to();
    const lo = rangeStart && rangeEndRaw ? (rangeStart <= rangeEndRaw ? rangeStart : rangeEndRaw) : rangeStart || null;
    const hi = rangeStart && rangeEndRaw ? (rangeStart <= rangeEndRaw ? rangeEndRaw : rangeStart) : null;

    const firstDate = new Date(year, month, 1);
    const startDayOfWeek = firstDate.getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: RangeCalendarDay[] = [];

    const pushDay = (y: number, m: number, d: number, isCurrentMonth: boolean) => {
      const formatted = formatYYYYMMDD(y, m, d);
      days.push({
        year: y,
        month: m,
        date: d,
        isCurrentMonth,
        isToday: formatted === this.todayFormatted,
        isRangeStart: formatted === lo,
        isRangeEnd: formatted === hi || (hi === null && formatted === lo),
        isInRange: !!lo && !!hi && formatted > lo && formatted < hi,
        formattedDate: formatted
      });
    };

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      pushDay(prevYear, prevMonth, prevDate, false);
    }

    for (let d = 1; d <= daysInCurrentMonth; d++) {
      pushDay(year, month, d, true);
    }

    const remainingCells = 42 - days.length;
    for (let d = 1; d <= remainingCells; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      pushDay(nextYear, nextMonth, d, false);
    }

    return days;
  });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  togglePopover(): void {
    if (this.disabled()) return;
    const nextState = !this.isOpen();
    if (nextState) {
      this.checkDirection();
      this.syncViewToRangeOrToday();
      this.pendingStart.set(null);
      this.hoverDate.set(null);
    }
    this.isOpen.set(nextState);
  }

  private checkDirection(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    this.openUpward.set(spaceBelow < 260);
  }

  closePopover(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.pendingStart.set(null);
      this.hoverDate.set(null);
    }
  }

  prevMonth(): void {
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  nextMonth(): void {
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  goToToday(): void {
    this.rangeChange.emit({ from: this.todayFormatted, to: this.todayFormatted });
    this.closePopover();
  }

  hoverDay(day: RangeCalendarDay): void {
    if (this.pendingStart()) {
      this.hoverDate.set(day.formattedDate);
    }
  }

  selectDay(day: RangeCalendarDay): void {
    const start = this.pendingStart();
    if (!start) {
      this.pendingStart.set(day.formattedDate);
      this.hoverDate.set(day.formattedDate);
      return;
    }

    const from = start <= day.formattedDate ? start : day.formattedDate;
    const to = start <= day.formattedDate ? day.formattedDate : start;
    this.rangeChange.emit({ from, to });
    this.pendingStart.set(null);
    this.hoverDate.set(null);
    this.closePopover();
  }

  private syncViewToRangeOrToday(): void {
    const parsed = parseYYYYMMDD(this.from()) ?? parseYYYYMMDD(this.to());
    if (parsed) {
      this.viewYear.set(parsed.year);
      this.viewMonth.set(parsed.month);
    } else {
      this.viewYear.set(this.today.getFullYear());
      this.viewMonth.set(this.today.getMonth());
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePopover();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closePopover();
    }
  }
}
```

- [ ] **Step 4: Create the component template**

Create `src/app/shared/ui/date-range-picker/date-range-picker.component.html`:

```html
<div class="drp-container">
  <button
    type="button"
    class="drp-trigger"
    (click)="togglePopover()"
    [disabled]="disabled()"
    [attr.aria-expanded]="isOpen()"
    aria-haspopup="dialog"
    [attr.aria-label]="triggerLabel() ? 'Change date range, currently ' + triggerLabel() : 'Choose date range'"
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
    @if (triggerLabel()) {
      <span class="drp-trigger-label">{{ triggerLabel() }}</span>
    }
  </button>

  @if (isOpen()) {
    <div class="drp-popover" [class.drp-popover--up]="openUpward()" role="dialog" aria-label="Date range calendar">
      <div class="drp-header">
        <button type="button" class="drp-nav-btn" (click)="prevMonth()" title="Previous month" aria-label="Previous month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>

        <span class="drp-month-title">{{ currentMonthLabel() }}</span>

        <button type="button" class="drp-nav-btn" (click)="nextMonth()" title="Next month" aria-label="Next month">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      </div>

      <div class="drp-weekdays">
        @for (wd of weekdayNames; track wd) {
          <span class="drp-weekday">{{ wd }}</span>
        }
      </div>

      <div class="drp-grid">
        @for (day of calendarDays(); track day.formattedDate) {
          <button
            type="button"
            class="drp-day-btn"
            [class.drp-day-btn--outside]="!day.isCurrentMonth"
            [class.drp-day-btn--today]="day.isToday"
            [class.drp-day-btn--start]="day.isRangeStart"
            [class.drp-day-btn--end]="day.isRangeEnd"
            [class.drp-day-btn--in-range]="day.isInRange"
            (mouseenter)="hoverDay(day)"
            (click)="selectDay(day)"
          >
            <span>{{ day.date }}</span>
          </button>
        }
      </div>

      <div class="drp-footer">
        <button type="button" class="drp-today-link" (click)="goToToday()">Today</button>
      </div>
    </div>
  }
</div>
```

- [ ] **Step 5: Create the component styles**

Create `src/app/shared/ui/date-range-picker/date-range-picker.component.css`:

```css
.drp-container {
  position: relative;
  display: inline-flex;
}

.drp-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.drp-trigger:hover:not(:disabled) {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.drp-trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.drp-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.drp-trigger-label {
  white-space: nowrap;
}

.drp-popover {
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  z-index: 50;
  width: 260px;
  padding: 0.625rem;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.05);
  animation: drpFadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

.drp-popover--up {
  top: auto;
  bottom: calc(100% + 0.25rem);
  animation: drpFadeInUp 0.12s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes drpFadeIn {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes drpFadeInUp {
  from { opacity: 0; transform: translateY(4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.drp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.drp-month-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  user-select: none;
}

.drp-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.drp-nav-btn:hover {
  background-color: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.drp-nav-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.drp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 0.25rem;
}

.drp-weekday {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.125rem 0;
  user-select: none;
}

.drp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.drp-day-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  width: 100%;
  border-radius: 50%;
  border: none;
  background: transparent;
  font-size: 0.78125rem;
  font-weight: 500;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background-color 0.12s ease, color 0.12s ease;
  user-select: none;
}

.drp-day-btn:hover:not(.drp-day-btn--start):not(.drp-day-btn--end) {
  background-color: var(--color-surface-secondary);
  color: var(--color-accent);
}

.drp-day-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}

.drp-day-btn--outside {
  color: var(--color-text-secondary);
  opacity: 0.3;
}

.drp-day-btn--today:not(.drp-day-btn--start):not(.drp-day-btn--end) {
  font-weight: 700;
  color: var(--color-accent);
}

.drp-day-btn--in-range {
  background-color: color-mix(in srgb, var(--color-accent) 16%, transparent);
  border-radius: 0;
}

.drp-day-btn--start,
.drp-day-btn--end {
  background-color: var(--color-accent);
  color: var(--color-accent-contrast);
  font-weight: 600;
}

.drp-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 0.375rem;
  padding-top: 0.375rem;
  border-top: 1px solid var(--color-border);
}

.drp-today-link {
  border: none;
  background: transparent;
  font-size: 0.71875rem;
  font-weight: 600;
  color: var(--color-accent);
  cursor: pointer;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}

.drp-today-link:hover {
  background-color: var(--color-surface-secondary);
}

.drp-today-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-focus-ring);
}
```

- [ ] **Step 6: Run the test suite to confirm it passes**

Run: `npx ng test --watch=false --include='**/date-range-picker.component.spec.ts'`
Expected: PASS, all 8 tests in the file.

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/ui/date-range-picker/date-range-picker.component.ts src/app/shared/ui/date-range-picker/date-range-picker.component.html src/app/shared/ui/date-range-picker/date-range-picker.component.css src/app/shared/ui/date-range-picker/date-range-picker.component.spec.ts
git commit -m "feat: add single-calendar date-range picker component"
```

---

### Task 2: Replace the Time Tracking range controls with the new picker

**Files:**
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.html`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.css`

**Interfaces:**
- Consumes: `DateRangePickerComponent` (`app-date-range-picker`, `[from]`/`[to]`/`[disabled]`/`(rangeChange)`) from Task 1.
- Produces: nothing new — this is the final integration task for this plan.

- [ ] **Step 1: Update the component's imports and remove the free-text range signal/methods**

In `time-tracking.component.ts`, replace the `DatePickerComponent` import:

```ts
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
```

with:

```ts
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
```

Replace the `imports` array in the `@Component` decorator:

```ts
  imports: [BreadcrumbHeaderComponent, ButtonComponent, DatePickerComponent, FormsModule, ModalComponent],
```

with:

```ts
  imports: [BreadcrumbHeaderComponent, ButtonComponent, DateRangePickerComponent, FormsModule, ModalComponent],
```

Replace:

```ts
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
  readonly rangeError = signal('');
```

with:

```ts
  readonly historyFrom = signal('');
  readonly historyTo = signal('');
```

Replace the `applyHistoryRange` method:

```ts
  applyHistoryRange(): void {
    const range = this.selectedRange();
    if (!range) {
      return;
    }

    if (this.viewMode() === 'team') {
      if (this.hasCoveredAccess()) {
        void this.store.loadCoveredHistory(range);
      }
      return;
    }

    void this.store.loadMyHistory(range);
  }
```

with:

```ts
  onRangeSelected(range: TimeTrackingRange): void {
    this.historyFrom.set(range.from);
    this.historyTo.set(range.to);
    this.loadForCurrentView(range);
  }

  private loadForCurrentView(range: TimeTrackingRange): void {
    if (this.viewMode() === 'team') {
      if (this.hasCoveredAccess()) {
        void this.store.loadCoveredHistory(range);
      }
      return;
    }

    void this.store.loadMyHistory(range);
  }
```

Replace the `retryHistory` method:

```ts
  retryHistory(): void {
    this.applyHistoryRange();
  }
```

with:

```ts
  retryHistory(): void {
    this.loadForCurrentView({ from: this.historyFrom(), to: this.historyTo() });
  }
```

Remove the `setHistoryFrom`, `setHistoryTo`, and `selectedRange` methods entirely:

```ts
  setHistoryFrom(value: string): void {
    this.historyFrom.set(value);
    this.rangeError.set('');
  }

  setHistoryTo(value: string): void {
    this.historyTo.set(value);
    this.rangeError.set('');
  }

  selectedRange(): TimeTrackingRange | null {
    const range = { from: this.historyFrom().trim(), to: this.historyTo().trim() };
    if (!range.from || !range.to) {
      this.rangeError.set('Select both a start date and an end date.');
      return null;
    }
    if (range.from > range.to) {
      this.rangeError.set('The start date must be on or before the end date.');
      return null;
    }
    this.rangeError.set('');
    return range;
  }

```

(delete the block; nothing replaces it at that location)

- [ ] **Step 2: Replace the "My attendance history" range control**

In `time-tracking.component.html`, replace:

```html
      <div class="range-controls" aria-label="Attendance history date range">
        <app-date-picker label="From" [value]="historyFrom()" (valueChange)="setHistoryFrom($event)" />
        <app-date-picker label="To" [value]="historyTo()" (valueChange)="setHistoryTo($event)" />
        <app-button type="button" size="sm" [disabled]="store.historyLoading()" (pressed)="applyHistoryRange()">Apply</app-button>
      </div>
    </div>
    @if (rangeError()) { <p class="field-error" role="alert">{{ rangeError() }}</p> }
```

with:

```html
      <div class="range-controls" aria-label="Attendance history date range">
        <app-date-range-picker
          [from]="historyFrom()"
          [to]="historyTo()"
          [disabled]="store.historyLoading()"
          (rangeChange)="onRangeSelected($event)"
        />
      </div>
    </div>
```

- [ ] **Step 3: Replace the "Team attendance" range control**

Replace:

```html
          <div class="range-controls" aria-label="Team attendance date range">
            <app-date-picker label="From" [value]="historyFrom()" (valueChange)="setHistoryFrom($event)" />
            <app-date-picker label="To" [value]="historyTo()" (valueChange)="setHistoryTo($event)" />
            <app-button type="button" size="sm" [disabled]="store.coveredHistoryLoading()" (pressed)="applyHistoryRange()">Apply</app-button>
          </div>
        </div>
      </div>
      @if (rangeError()) { <p class="field-error" role="alert">{{ rangeError() }}</p> }
```

with:

```html
          <div class="range-controls" aria-label="Team attendance date range">
            <app-date-range-picker
              [from]="historyFrom()"
              [to]="historyTo()"
              [disabled]="store.coveredHistoryLoading()"
              (rangeChange)="onRangeSelected($event)"
            />
          </div>
        </div>
      </div>
```

- [ ] **Step 4: Clean up the now-unused per-child CSS in `.range-controls`**

In `time-tracking.component.css`, replace:

```css
.range-controls{display:flex;align-items:flex-end;gap:.625rem}.range-controls app-date-picker{width:9.5rem}.range-controls app-button{width:6rem}.field-error{margin:-.35rem 0 0;color:var(--color-danger-text);font-size:.75rem}
```

with:

```css
.range-controls{display:flex;align-items:flex-end;gap:.625rem}.field-error{margin:-.35rem 0 0;color:var(--color-danger-text);font-size:.75rem}
```

Replace:

```css
.range-controls{align-items:stretch;flex-wrap:wrap;width:100%}.range-controls app-date-picker{flex:1 1 9rem;width:auto}.range-controls app-button{width:100%}
```

with:

```css
.range-controls{align-items:stretch;flex-wrap:wrap;width:100%}
```

(`.field-error` stays — it is still used by the attendance-correction form's field-level error messages elsewhere in this template. `.team-heading-actions .range-controls` and its responsive rule are untouched — the wrapping `div.range-controls` element still exists, just with a different child.)

- [ ] **Step 5: Build the frontend and run the full Vitest suite**

Run: `npx ng build`
Expected: builds with no errors (confirms nothing else references the removed `applyHistoryRange`/`setHistoryFrom`/`setHistoryTo`/`selectedRange`/`rangeError` members or the `DatePickerComponent` import in this file).

Run: `npx ng test --watch=false`
Expected: no new failures beyond the 3 pre-existing MY/TEAM-toggle failures in `time-tracking.component.spec.ts` (unrelated to this change — see `docs/superpowers/plans/2026-08-25-attendance-list-pagination.md` Task 9 for that context). `time-tracking.component.spec.ts` needs no edits for this task: it does not reference `app-date-picker`, `Apply`, `rangeError`, or any of the removed methods directly.

- [ ] **Step 6: Manual smoke check in the browser**

Run the dev server, open `/attendance/time-tracking`, and confirm:
- The "My attendance history" and "Team attendance" sections each show a single calendar-icon button with the current week's range as text (e.g. "Aug 17 – Aug 23"), not two separate date inputs and an Apply button.
- Clicking the button opens a one-month calendar; clicking a day highlights it as the range start, clicking a later day completes the range, applies it immediately, and closes the popover.
- Clicking an earlier day second swaps start/end correctly.
- The "Today" shortcut applies a single-day range immediately.
- Switching the MY/TEAM tab keeps showing the same applied range on the newly selected tab's picker.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts src/app/modules/attendance/feature/time-tracking/time-tracking.component.html src/app/modules/attendance/feature/time-tracking/time-tracking.component.css
git commit -m "feat: use single-calendar range picker on Time Tracking page"
```
