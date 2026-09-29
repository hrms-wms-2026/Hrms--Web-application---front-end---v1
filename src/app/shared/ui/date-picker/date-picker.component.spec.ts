import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DatePickerComponent } from './date-picker.component';

@Component({
  standalone: true,
  imports: [DatePickerComponent],
  template: `
    <app-date-picker
      label="Start date"
      placeholder="YYYY-MM-DD"
      [value]="val"
      (valueChange)="val = $event"
    />
  `
})
class TestHostComponent {
  val = '2026-08-25';
}

describe('DatePickerComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('renders input with formatted value and calendar icon trigger', () => {
    const inputEl = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(inputEl).toBeTruthy();
    expect(inputEl.value).toBe('2026-08-25');

    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger');
    expect(trigger).toBeTruthy();
  });

  it('opens calendar popover when trigger button is clicked', () => {
    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('.dp-popover');
    expect(popover).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('August 2026');
  });

  it('navigates months with previous and next buttons', () => {
    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const nextBtn = fixture.nativeElement.querySelector('.dp-nav-btn:last-of-type') as HTMLButtonElement;
    nextBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('September 2026');

    const prevBtn = fixture.nativeElement.querySelector('.dp-nav-btn:first-of-type') as HTMLButtonElement;
    prevBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('August 2026');
  });

  it('selects a date when a day cell is clicked', () => {
    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const dayBtns: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.dp-day-btn'));
    const day15 = dayBtns.find((b) => !b.classList.contains('dp-day-btn--outside') && b.textContent?.trim() === '15');

    expect(day15).toBeTruthy();
    day15?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.val).toBe('2026-08-15');
    expect(fixture.nativeElement.querySelector('.dp-popover')).toBeFalsy();
  });

  it('opens calendar popover when clicking anywhere on the input element', () => {
    const inputEl = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(inputEl.readOnly).toBe(true);

    inputEl.click();
    fixture.detectChanges();

    const popover = fixture.nativeElement.querySelector('.dp-popover');
    expect(popover).toBeTruthy();
  });
});
