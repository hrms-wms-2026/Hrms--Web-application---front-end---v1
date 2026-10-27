import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimePickerComponent, formatDisplayTime, parseHHMM, to12Hour, to24Hour } from './time-picker.component';

describe('TimePickerComponent', () => {
  let component: TimePickerComponent;
  let fixture: ComponentFixture<TimePickerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimePickerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TimePickerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  describe('helper functions', () => {
    it('parseHHMM parses valid 24h strings', () => {
      expect(parseHHMM('09:00')).toEqual({ hour: 9, minute: 0 });
      expect(parseHHMM('17:30')).toEqual({ hour: 17, minute: 30 });
      expect(parseHHMM('00:00')).toEqual({ hour: 0, minute: 0 });
      expect(parseHHMM('23:59')).toEqual({ hour: 23, minute: 59 });
    });

    it('parseHHMM rejects invalid strings', () => {
      expect(parseHHMM('')).toBeNull();
      expect(parseHHMM('25:00')).toBeNull();
      expect(parseHHMM('12:60')).toBeNull();
      expect(parseHHMM('abc')).toBeNull();
    });

    it('to12Hour converts midnight and noon correctly', () => {
      expect(to12Hour(0)).toEqual({ hour12: 12, period: 'AM' });
      expect(to12Hour(12)).toEqual({ hour12: 12, period: 'PM' });
      expect(to12Hour(9)).toEqual({ hour12: 9, period: 'AM' });
      expect(to12Hour(17)).toEqual({ hour12: 5, period: 'PM' });
    });

    it('to24Hour converts 12h + period back correctly', () => {
      expect(to24Hour(12, 'AM')).toBe(0);
      expect(to24Hour(12, 'PM')).toBe(12);
      expect(to24Hour(9, 'AM')).toBe(9);
      expect(to24Hour(5, 'PM')).toBe(17);
    });

    it('formatDisplayTime formats 12h and 24h', () => {
      expect(formatDisplayTime(9, 0, true)).toBe('09:00 AM');
      expect(formatDisplayTime(17, 30, true)).toBe('05:30 PM');
      expect(formatDisplayTime(17, 30, false)).toBe('17:30');
    });
  });

  describe('component behavior', () => {
    it('displays formatted 12h value', () => {
      fixture.componentRef.setInput('value', '09:30');
      fixture.detectChanges();
      expect(component.displayValue()).toBe('09:30 AM');
    });

    it('toggles popover open and closed', () => {
      expect(component.isOpen()).toBe(false);
      component.togglePopover();
      expect(component.isOpen()).toBe(true);
      component.closePopover();
      expect(component.isOpen()).toBe(false);
    });

    it('emits valueChange when hour and minute are chosen', () => {
      const emitted: string[] = [];
      component.valueChange.subscribe((val) => emitted.push(val));

      component.togglePopover();
      component.selectPeriod('PM');
      component.selectHour(5);
      component.selectMinute(30);

      expect(emitted).toContain('17:30');
    });

    it('emits empty string when cleared', () => {
      let emitted = 'initial';
      component.valueChange.subscribe((val) => (emitted = val));

      component.clearValue();
      expect(emitted).toBe('');
      expect(component.isOpen()).toBe(false);
    });
  });
});
