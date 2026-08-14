import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

export interface CalendarDay {
  year: number;
  month: number;
  date: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
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

@Component({
  selector: 'app-date-picker',
  standalone: true,
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatePickerComponent {
  label = input<string>('');
  placeholder = input<string>('YYYY-MM-DD');
  disabled = input(false);
  value = input<string>('');
  readonlyInput = input(true);
  error = input<string>('');
  hint = input<string>('');

  valueChange = output<string>();
  blurred = output<void>();

  readonly inputId = nextUniqueId('app-date-picker');
  readonly errorId = computed(() => `${this.inputId}-error`);
  readonly hintId = computed(() => `${this.inputId}-hint`);

  readonly isOpen = signal(false);
  readonly openUpward = signal(false);

  private readonly today = new Date();
  readonly todayFormatted = formatYYYYMMDD(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());

  readonly viewYear = signal<number>(this.today.getFullYear());
  readonly viewMonth = signal<number>(this.today.getMonth()); // 0-11

  readonly weekdayNames = WEEKDAY_NAMES;

  readonly currentMonthLabel = computed(() => {
    return `${MONTH_NAMES[this.viewMonth()]} ${this.viewYear()}`;
  });

  readonly parsedSelected = computed(() => parseYYYYMMDD(this.value()));

  readonly calendarDays = computed<CalendarDay[]>(() => {
    const year = this.viewYear();
    const month = this.viewMonth();
    const selectedStr = this.parsedSelected()
      ? formatYYYYMMDD(this.parsedSelected()!.year, this.parsedSelected()!.month, this.parsedSelected()!.date)
      : '';

    const firstDate = new Date(year, month, 1);
    const startDayOfWeek = firstDate.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];

    // Previous month trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const prevDate = daysInPrevMonth - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const formatted = formatYYYYMMDD(prevYear, prevMonth, prevDate);
      days.push({
        year: prevYear,
        month: prevMonth,
        date: prevDate,
        isCurrentMonth: false,
        isToday: formatted === this.todayFormatted,
        isSelected: formatted === selectedStr,
        formattedDate: formatted
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const formatted = formatYYYYMMDD(year, month, d);
      days.push({
        year,
        month,
        date: d,
        isCurrentMonth: true,
        isToday: formatted === this.todayFormatted,
        isSelected: formatted === selectedStr,
        formattedDate: formatted
      });
    }

    // Next month leading days (to complete 42 cells - 6 rows)
    const remainingCells = 42 - days.length;
    for (let d = 1; d <= remainingCells; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const formatted = formatYYYYMMDD(nextYear, nextMonth, d);
      days.push({
        year: nextYear,
        month: nextMonth,
        date: d,
        isCurrentMonth: false,
        isToday: formatted === this.todayFormatted,
        isSelected: formatted === selectedStr,
        formattedDate: formatted
      });
    }

    return days;
  });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  togglePopover(): void {
    if (this.disabled()) return;
    const nextState = !this.isOpen();
    if (nextState) {
      this.checkDirection();
      this.syncViewToSelectedOrToday();
    }
    this.isOpen.set(nextState);
    if (!nextState) {
      this.blurred.emit();
    }
  }

  private checkDirection(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    this.openUpward.set(spaceBelow < 220);
  }

  closePopover(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.blurred.emit();
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
    const y = this.today.getFullYear();
    const m = this.today.getMonth();
    this.viewYear.set(y);
    this.viewMonth.set(m);
    this.selectDay({
      year: y,
      month: m,
      date: this.today.getDate(),
      isCurrentMonth: true,
      isToday: true,
      isSelected: true,
      formattedDate: this.todayFormatted
    });
  }

  selectDay(day: CalendarDay): void {
    this.valueChange.emit(day.formattedDate);
    this.closePopover();
  }

  onInputText(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.valueChange.emit(val);
    const parsed = parseYYYYMMDD(val);
    if (parsed) {
      this.viewYear.set(parsed.year);
      this.viewMonth.set(parsed.month);
    }
  }

  private syncViewToSelectedOrToday(): void {
    const parsed = this.parsedSelected();
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
