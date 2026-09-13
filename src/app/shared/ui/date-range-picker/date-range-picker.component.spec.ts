import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DateRangePickerComponent } from './date-range-picker.component';

@Component({
  standalone: true,
  imports: [DateRangePickerComponent],
  template: `
    <app-date-range-picker
      [from]="from()"
      [to]="to()"
      [maxDate]="maxDate()"
      [align]="align()"
      (rangeChange)="onRangeChange($event)"
    />
  `
})
class TestHostComponent {
  readonly from = signal('2026-08-17');
  readonly to = signal('2026-08-23');
  readonly maxDate = signal('');
  readonly align = signal<'auto' | 'left' | 'right'>('auto');
  lastEmitted: { from: string; to: string } | null = null;

  onRangeChange(range: { from: string; to: string }): void {
    this.lastEmitted = range;
    this.from.set(range.from);
    this.to.set(range.to);
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

  it('aligns popover to the right when align is set to right', () => {
    fixture.componentInstance.align.set('right');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('.drp-popover');
    expect(popover).toBeTruthy();
    expect(popover.classList.contains('drp-popover--right')).toBe(true);
  });

  it('disables dates after maxDate and prevents selecting them', () => {
    fixture.componentInstance.maxDate.set('2026-08-15');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const btn15 = dayButton('15');
    const btn16 = dayButton('16');

    expect(btn15.disabled).toBe(false);
    expect(btn15.classList.contains('drp-day-btn--disabled')).toBe(false);

    expect(btn16.disabled).toBe(true);
    expect(btn16.classList.contains('drp-day-btn--disabled')).toBe(true);

    btn16.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastEmitted).toBeNull();

    btn15.click();
    fixture.detectChanges();
    btn16.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastEmitted).toBeNull();
  });

  it('disables next month navigation when next month starts after maxDate', () => {
    fixture.componentInstance.maxDate.set('2026-08-31');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.drp-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const nextBtn = fixture.nativeElement.querySelector('.drp-nav-btn:last-of-type') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });
});

