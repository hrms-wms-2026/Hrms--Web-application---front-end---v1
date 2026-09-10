import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarSelectComponent } from './calendar-select.component';

const OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

describe('CalendarSelectComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarSelectComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarSelectComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarSelectComponent);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('value', 'none');
    fixture.detectChanges();
  });

  const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
  const trigger = () => q('[data-testid="calendar-select-trigger"]') as HTMLButtonElement;

  it('shows the label of the current value on the trigger, panel closed', () => {
    expect(trigger().textContent).toContain('Does not repeat');
    expect(q('[data-testid="calendar-select-panel"]')).toBeNull();
  });

  it('opens the styled panel (not a native select) on trigger click', () => {
    trigger().click();
    fixture.detectChanges();
    const panel = q('[data-testid="calendar-select-panel"]');
    expect(panel).not.toBeNull();
    expect(panel!.getAttribute('role')).toBe('listbox');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-select-option"]').length).toBe(4);
  });

  it('emits valueChange and closes when an option is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    trigger().click();
    fixture.detectChanges();
    const weekly = [...fixture.nativeElement.querySelectorAll('[data-testid="calendar-select-option"]')]
      .find((b: HTMLElement) => b.textContent?.trim() === 'Weekly') as HTMLButtonElement;
    weekly.click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith('weekly');
    expect(q('[data-testid="calendar-select-panel"]')).toBeNull();
  });

  it('closes on Escape without emitting', () => {
    const spy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    trigger().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(q('[data-testid="calendar-select-panel"]')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    trigger().click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(q('[data-testid="calendar-select-panel"]')).toBeNull();
  });

  it('marks the selected option aria-selected', () => {
    fixture.componentRef.setInput('value', 'monthly');
    trigger().click();
    fixture.detectChanges();
    const selected = [...fixture.nativeElement.querySelectorAll('[data-testid="calendar-select-option"]')]
      .find((b: HTMLElement) => b.getAttribute('aria-selected') === 'true') as HTMLButtonElement;
    expect(selected.textContent?.trim()).toBe('Monthly');
  });
});
