import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
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

    const popover = document.body.querySelector('.dp-popover');
    expect(popover).toBeTruthy();
    expect(popover!.textContent).toContain('August 2026');
  });

  it('navigates months with previous and next buttons', () => {
    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const nextBtn = document.body.querySelector('.dp-nav-btn:last-of-type') as HTMLButtonElement;
    nextBtn.click();
    fixture.detectChanges();

    const popover = document.body.querySelector('.dp-popover');
    expect(popover!.textContent).toContain('September 2026');

    const prevBtn = document.body.querySelector('.dp-nav-btn:first-of-type') as HTMLButtonElement;
    prevBtn.click();
    fixture.detectChanges();

    expect(popover!.textContent).toContain('August 2026');
  });

  it('changes month when scrolling mouse wheel on popover', () => {
    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const popover = document.body.querySelector('.dp-popover') as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.textContent).toContain('August 2026');

    // Scroll down (deltaY > 0) -> next month (September)
    const wheelDown = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    popover.dispatchEvent(wheelDown);
    fixture.detectChanges();

    expect(popover.textContent).toContain('September 2026');

    // Reset throttle time to test previous month scroll
    const component = fixture.debugElement.children[0].componentInstance as DatePickerComponent;
    (component as any).lastWheelTime = 0;

    // Scroll up (deltaY < 0) -> prev month (August)
    const wheelUp = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    popover.dispatchEvent(wheelUp);
    fixture.detectChanges();

    expect(popover.textContent).toContain('August 2026');
  });

  it('detects available space and opens upward when near viewport bottom', () => {
    const dpDebugEl = fixture.debugElement.query(By.directive(DatePickerComponent));
    const component = dpDebugEl.componentInstance as DatePickerComponent;

    const origHeight = window.innerHeight;
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true, writable: true });

    // Mock getBoundingClientRect near viewport bottom (spaceBelow = 60px < 350px, spaceAbove = 500px)
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 500,
      bottom: 540,
      left: 100,
      right: 360,
      width: 260,
      height: 40,
      x: 100,
      y: 500,
      toJSON: () => {}
    } as DOMRect);

    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(component.openUpward()).toBe(true);
    const popover = document.body.querySelector('.dp-popover') as HTMLElement;
    expect(popover).toBeTruthy();
    expect(popover.classList.contains('dp-popover--up')).toBe(true);

    rectSpy.mockRestore();
    Object.defineProperty(window, 'innerHeight', { value: origHeight, configurable: true, writable: true });
  });

  it('selects a date when a day cell is clicked', () => {
    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const dayBtns: HTMLButtonElement[] = Array.from(document.body.querySelectorAll('.dp-day-btn'));
    const day15 = dayBtns.find((b) => !b.classList.contains('dp-day-btn--outside') && b.textContent?.trim() === '15');

    expect(day15).toBeTruthy();
    day15?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.val).toBe('2026-08-15');
    expect(document.body.querySelector('.dp-popover')).toBeFalsy();
  });

  it('opens calendar popover when clicking anywhere on the input element', () => {
    const inputEl = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(inputEl.readOnly).toBe(true);

    inputEl.click();
    fixture.detectChanges();

    const popover = document.body.querySelector('.dp-popover');
    expect(popover).toBeTruthy();
  });

  it('clears date when clear link is clicked', () => {
    const trigger = fixture.nativeElement.querySelector('.dp-icon-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const clearBtn = document.body.querySelector('.dp-clear-link') as HTMLButtonElement;
    expect(clearBtn).toBeTruthy();
    clearBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.val).toBe('');
    expect(document.body.querySelector('.dp-popover')).toBeFalsy();
  });
});

@Component({
  standalone: true,
  imports: [DatePickerComponent],
  template: `
    <app-date-picker
      variant="chip"
      [value]="val"
      (valueChange)="val = $event"
    />
  `
})
class TestChipHostComponent {
  val = '2026-09-17';
}

describe('DatePickerComponent (chip variant)', () => {
  it('renders button chip and opens calendar popover when clicked', async () => {
    const fixture = TestBed.createComponent(TestChipHostComponent);
    fixture.detectChanges();

    const inputEl = fixture.nativeElement.querySelector('input');
    expect(inputEl).toBeFalsy();

    const chipBtn = fixture.nativeElement.querySelector('button.dp-chip') as HTMLButtonElement;
    expect(chipBtn).toBeTruthy();
    expect(chipBtn.textContent).toContain('Sep 17');

    // Click to open popover
    chipBtn.click();
    fixture.detectChanges();

    const popover = document.body.querySelector('.dp-popover');
    expect(popover).toBeTruthy();
    expect(popover!.textContent).toContain('September 2026');

    // Quick presets are present
    const quickBtns = Array.from(popover!.querySelectorAll('.dp-quick-btn')) as HTMLButtonElement[];
    expect(quickBtns.length).toBe(3);

    const dayBtns: HTMLButtonElement[] = Array.from(popover!.querySelectorAll('.dp-day-btn'));
    const day10 = dayBtns.find((b) => !b.classList.contains('dp-day-btn--outside') && b.textContent?.trim() === '10');
    expect(day10).toBeTruthy();
    day10?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.val).toBe('2026-09-10');
  });
});
