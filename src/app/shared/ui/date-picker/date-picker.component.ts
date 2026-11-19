import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { nextUniqueId } from '../../utils/unique-id';
import { getTaskDueDateInfo } from '../../utils/date-format.util';
import { StopClickPropagationDirective } from '../../directives/stop-click-propagation.directive';

export interface CalendarDay {
  year: number;
  month: number;
  date: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
  formattedDate: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const POSITIONS_DOWN: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 }
];

const POSITIONS_UP: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 }
];

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
  imports: [StopClickPropagationDirective, OverlayModule],
  templateUrl: './date-picker.component.html',
  styleUrl: './date-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatePickerComponent {
  label = input<string>('');
  /** Shows a red asterisk after the label. */
  required = input(false);
  /** 'sm' is the compact field for dense panels and toolbars. */
  size = input<'md' | 'sm'>('md');
  placeholder = input<string>('YYYY-MM-DD');
  disabled = input(false);
  value = input<string>('');
  readonlyInput = input(true);
  error = input<string>('');
  hint = input<string>('');
  /** 'custom': the host projects its own trigger (any button) and the calendar opens from it, with no input box. */
  variant = input<'input' | 'chip' | 'custom'>('input');
  isCompleted = input(false);
  chipClass = input<string>('');
  btnTestId = input<string>('task-card-due-date-btn');
  inputTestId = input<string>('');
  ariaLabel = input<string>('');
  name = input<string>('');
  minDate = input<string>('');
  emptyLabel = input<string>('');
  showQuickPresets = input(true);
  showClear = input(true);
  /** The open calendar's accessible name. */
  panelLabel = input('Change due date');

  valueChange = output<string>();
  blurred = output<void>();
  /** Fires when the calendar opens or closes, so a custom trigger can reflect it (aria-expanded). */
  openChange = output<boolean>();

  readonly openUpward = signal(false);
  readonly popoverPositions = computed(() => (this.openUpward() ? POSITIONS_UP : POSITIONS_DOWN));
  readonly dueDateInfo = computed(() => getTaskDueDateInfo(this.value(), this.isCompleted()));

  readonly inputId = nextUniqueId('app-date-picker');
  readonly errorId = computed(() => `${this.inputId}-error`);
  readonly hintId = computed(() => `${this.inputId}-hint`);

  readonly isOpen = signal(false);

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
    const min = this.minDate();
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
        isDisabled: !!min && formatted < min,
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
        isDisabled: !!min && formatted < min,
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
        isDisabled: !!min && formatted < min,
        formattedDate: formatted
      });
    }

    return days;
  });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      const parsed = this.parsedSelected();
      if (parsed) {
        untracked(() => {
          this.viewYear.set(parsed.year);
          this.viewMonth.set(parsed.month);
        });
      }
    });
  }

  private lastWheelTime = 0;
  private readonly WHEEL_THROTTLE_MS = 200;

  /** Keyboard way in to the calendar: Enter, Space or Down on the read-only input. */
  onInputKeydown(event: KeyboardEvent): void {
    if (!this.readonlyInput() || this.isOpen()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.togglePopover();
    }
  }

  togglePopover(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.disabled()) return;
    const nextState = !this.isOpen();
    if (nextState) {
      this.syncViewToSelectedOrToday();

      // Check available space below vs above to decide whether to open upward
      if (typeof window !== 'undefined') {
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        // Calendar popover is ~340px tall. If space below is not enough and space above is greater, open upward!
        this.openUpward.set(spaceBelow < 350 && spaceAbove > spaceBelow);
      }
    }
    this.isOpen.set(nextState);
    this.openChange.emit(nextState);
    if (!nextState) {
      this.blurred.emit();
    }
  }



  onWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const now = Date.now();
    if (now - this.lastWheelTime < this.WHEEL_THROTTLE_MS) {
      return;
    }

    if (Math.abs(event.deltaY) < 5) {
      return;
    }

    this.lastWheelTime = now;
    if (event.deltaY > 0) {
      this.nextMonth();
    } else if (event.deltaY < 0) {
      this.prevMonth();
    }
  }

  closePopover(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.openChange.emit(false);
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

  setQuickDate(preset: 'today' | 'tomorrow' | 'nextWeek'): void {
    const d = new Date();
    if (preset === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (preset === 'nextWeek') {
      d.setDate(d.getDate() + 7);
    }
    const val = formatYYYYMMDD(d.getFullYear(), d.getMonth(), d.getDate());
    this.valueChange.emit(val);
    this.closePopover();
  }

  goToToday(): void {
    this.setQuickDate('today');
  }

  clearDate(): void {
    this.valueChange.emit('');
    this.closePopover();
  }

  selectDay(day: CalendarDay): void {
    if (day.isDisabled) return;
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
}
