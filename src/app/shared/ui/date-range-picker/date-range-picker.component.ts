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
  isDisabled: boolean;
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
  maxDate = input<string>('');
  minDate = input<string>('');
  align = input<'auto' | 'left' | 'right'>('auto');

  rangeChange = output<{ from: string; to: string }>();

  readonly isOpen = signal(false);
  readonly openUpward = signal(false);
  readonly openRightAligned = signal(false);
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

  readonly isTodayDisabled = computed(() => {
    const max = this.maxDate();
    const min = this.minDate();
    return !!((max && this.todayFormatted > max) || (min && this.todayFormatted < min));
  });

  readonly isNextMonthDisabled = computed(() => {
    const max = this.maxDate();
    if (!max) return false;
    const year = this.viewYear();
    const month = this.viewMonth();
    const nextMonthYear = month === 11 ? year + 1 : year;
    const nextMonth = month === 11 ? 0 : month + 1;
    const firstOfNextMonth = formatYYYYMMDD(nextMonthYear, nextMonth, 1);
    return firstOfNextMonth > max;
  });

  readonly isPrevMonthDisabled = computed(() => {
    const min = this.minDate();
    if (!min) return false;
    const year = this.viewYear();
    const month = this.viewMonth();
    const prevMonthYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate();
    const lastOfPrevMonth = formatYYYYMMDD(prevMonthYear, prevMonth, daysInPrevMonth);
    return lastOfPrevMonth < min;
  });

  readonly calendarDays = computed<RangeCalendarDay[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const pendingStart = this.pendingStart();
    const rangeStart = pendingStart ?? this.from();
    const rangeEndRaw = pendingStart ? (this.hoverDate() ?? pendingStart) : this.to();
    const lo = rangeStart && rangeEndRaw ? (rangeStart <= rangeEndRaw ? rangeStart : rangeEndRaw) : rangeStart || null;
    const hi = rangeStart && rangeEndRaw ? (rangeStart <= rangeEndRaw ? rangeEndRaw : rangeStart) : null;
    const max = this.maxDate();
    const min = this.minDate();

    const firstDate = new Date(year, month, 1);
    const startDayOfWeek = firstDate.getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: RangeCalendarDay[] = [];

    const pushDay = (y: number, m: number, d: number, isCurrentMonth: boolean) => {
      const formatted = formatYYYYMMDD(y, m, d);
      const isAfterMax = !!max && formatted > max;
      const isBeforeMin = !!min && formatted < min;
      const isDisabled = isAfterMax || isBeforeMin;
      days.push({
        year: y,
        month: m,
        date: d,
        isCurrentMonth,
        isToday: formatted === this.todayFormatted,
        isRangeStart: !isDisabled && formatted === lo,
        isRangeEnd: !isDisabled && (formatted === hi || (hi === null && formatted === lo)),
        isInRange: !isDisabled && !!lo && !!hi && formatted > lo && formatted < hi,
        isDisabled,
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

    const alignPref = this.align();
    if (alignPref === 'right') {
      this.openRightAligned.set(true);
    } else if (alignPref === 'left') {
      this.openRightAligned.set(false);
    } else {
      const spaceRight = window.innerWidth - rect.left;
      this.openRightAligned.set(spaceRight < 275);
    }
  }

  closePopover(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.pendingStart.set(null);
      this.hoverDate.set(null);
    }
  }

  prevMonth(): void {
    if (this.isPrevMonthDisabled()) return;
    if (this.viewMonth() === 0) {
      this.viewMonth.set(11);
      this.viewYear.update((y) => y - 1);
    } else {
      this.viewMonth.update((m) => m - 1);
    }
  }

  nextMonth(): void {
    if (this.isNextMonthDisabled()) return;
    if (this.viewMonth() === 11) {
      this.viewMonth.set(0);
      this.viewYear.update((y) => y + 1);
    } else {
      this.viewMonth.update((m) => m + 1);
    }
  }

  goToToday(): void {
    if (this.isTodayDisabled()) return;
    this.rangeChange.emit({ from: this.todayFormatted, to: this.todayFormatted });
    this.closePopover();
  }

  hoverDay(day: RangeCalendarDay): void {
    if (day.isDisabled) return;
    if (this.pendingStart()) {
      this.hoverDate.set(day.formattedDate);
    }
  }

  selectDay(day: RangeCalendarDay): void {
    if (day.isDisabled) return;
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
