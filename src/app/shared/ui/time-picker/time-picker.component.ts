import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { nextUniqueId } from '../../utils/unique-id';
import { StopClickPropagationDirective } from '../../directives/stop-click-propagation.directive';

export function parseHHMM(str: string): { hour: number; minute: number } | null {
  if (!str || !/^([01]\d|2[0-3]):[0-5]\d$/.test(str.trim())) {
    return null;
  }
  const [h, m] = str.trim().split(':').map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return { hour: h, minute: m };
}

export function to12Hour(hour24: number): { hour12: number; period: 'AM' | 'PM' } {
  if (hour24 === 0) {
    return { hour12: 12, period: 'AM' };
  }
  if (hour24 < 12) {
    return { hour12: hour24, period: 'AM' };
  }
  if (hour24 === 12) {
    return { hour12: 12, period: 'PM' };
  }
  return { hour12: hour24 - 12, period: 'PM' };
}

export function to24Hour(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') {
    return hour12 === 12 ? 0 : hour12;
  }
  return hour12 === 12 ? 12 : hour12 + 12;
}

export function formatHHMM(hour24: number, minute: number): string {
  const h = String(hour24).padStart(2, '0');
  const m = String(minute).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDisplayTime(hour24: number, minute: number, is12Hour: boolean): string {
  const m = String(minute).padStart(2, '0');
  if (is12Hour) {
    const { hour12, period } = to12Hour(hour24);
    const h = String(hour12).padStart(2, '0');
    return `${h}:${m} ${period}`;
  }
  return `${String(hour24).padStart(2, '0')}:${m}`;
}

const POSITIONS_DOWN: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 }
];

const POSITIONS_UP: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -4 },
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 }
];

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [StopClickPropagationDirective, OverlayModule],
  templateUrl: './time-picker.component.html',
  styleUrl: './time-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimePickerComponent {
  label = input<string>('');
  /** Shows a red asterisk after the label. */
  required = input(false);
  /** 'sm' is the compact field for dense panels and toolbars. */
  size = input<'md' | 'sm'>('md');
  placeholder = input<string>('--:-- --');
  disabled = input(false);
  value = input<string>(''); // 24h format HH:mm e.g. "09:00"
  readonlyInput = input(true);
  error = input<string>('');
  hint = input<string>('');
  format = input<'12h' | '24h'>('12h');
  minuteStep = input<number>(5);

  valueChange = output<string>();
  blurred = output<void>();

  readonly inputId = nextUniqueId('app-time-picker');
  readonly errorId = computed(() => `${this.inputId}-error`);
  readonly hintId = computed(() => `${this.inputId}-hint`);

  readonly isOpen = signal(false);
  readonly openUpward = signal(false);
  readonly popoverPositions = computed(() => (this.openUpward() ? POSITIONS_UP : POSITIONS_DOWN));


  readonly activeHour12 = signal<number>(9);
  readonly activeMinute = signal<number>(0);
  readonly activePeriod = signal<'AM' | 'PM'>('AM');
  readonly activeHour24 = signal<number>(9);

  readonly is12h = computed(() => this.format() === '12h');

  readonly displayValue = computed(() => {
    const parsed = parseHHMM(this.value());
    if (!parsed) {
      return '';
    }
    return formatDisplayTime(parsed.hour, parsed.minute, this.is12h());
  });

  readonly hoursList = computed<number[]>(() => {
    if (this.is12h()) {
      return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }
    return Array.from({ length: 24 }, (_, i) => i);
  });

  readonly minutesList = computed<number[]>(() => {
    const step = Math.max(1, Math.min(30, this.minuteStep()));
    const mins: number[] = [];
    for (let m = 0; m < 60; m += step) {
      mins.push(m);
    }
    return mins;
  });

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  togglePopover(): void {
    if (this.disabled()) {
      return;
    }
    const nextState = !this.isOpen();
    if (nextState) {
      this.checkDirection();
      this.syncFromValue();
    }
    this.isOpen.set(nextState);
    if (!nextState) {
      this.blurred.emit();
    }
  }

  closePopover(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.blurred.emit();
    }
  }

  selectHour(hour: number): void {
    if (this.is12h()) {
      this.activeHour12.set(hour);
      const h24 = to24Hour(hour, this.activePeriod());
      this.activeHour24.set(h24);
      this.emitCurrentTime(h24, this.activeMinute());
    } else {
      this.activeHour24.set(hour);
      this.emitCurrentTime(hour, this.activeMinute());
    }
  }

  selectMinute(minute: number): void {
    this.activeMinute.set(minute);
    const h24 = this.is12h()
      ? to24Hour(this.activeHour12(), this.activePeriod())
      : this.activeHour24();
    this.emitCurrentTime(h24, minute);
  }

  selectPeriod(period: 'AM' | 'PM'): void {
    this.activePeriod.set(period);
    const h24 = to24Hour(this.activeHour12(), period);
    this.activeHour24.set(h24);
    this.emitCurrentTime(h24, this.activeMinute());
  }

  setNow(): void {
    const now = new Date();
    const h24 = now.getHours();
    const step = this.minuteStep();
    const roundedMin = Math.round(now.getMinutes() / step) * step;
    const finalMin = roundedMin >= 60 ? 55 : roundedMin;
    this.updateInternalState(h24, finalMin);
    this.emitCurrentTime(h24, finalMin);
  }

  clearValue(): void {
    this.valueChange.emit('');
    this.closePopover();
  }

  pad2(val: number): string {
    return String(val).padStart(2, '0');
  }

  isActiveHour(hour: number): boolean {
    return this.is12h()
      ? this.activeHour12() === hour
      : this.activeHour24() === hour;
  }

  private syncFromValue(): void {
    const parsed = parseHHMM(this.value());
    if (parsed) {
      this.updateInternalState(parsed.hour, parsed.minute);
    } else {
      // Default to 09:00 AM if no value set
      this.updateInternalState(9, 0);
    }
  }

  private updateInternalState(hour24: number, minute: number): void {
    this.activeHour24.set(hour24);
    this.activeMinute.set(minute);
    const { hour12, period } = to12Hour(hour24);
    this.activeHour12.set(hour12);
    this.activePeriod.set(period);
  }

  private emitCurrentTime(hour24: number, minute: number): void {
    const val = formatHHMM(hour24, minute);
    this.valueChange.emit(val);
  }

  private checkDirection(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    this.openUpward.set(spaceBelow < 260);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePopover();
  }
}
