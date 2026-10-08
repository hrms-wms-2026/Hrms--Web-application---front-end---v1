import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ListboxSelectComponent } from './listbox-select.component';

const OPTIONS = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

describe('ListboxSelectComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ListboxSelectComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ListboxSelectComponent] }).compileComponents();
    fixture = TestBed.createComponent(ListboxSelectComponent);
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('value', 'none');
    fixture.detectChanges();
  });

  const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
  const trigger = () => q('[data-testid="listbox-select-trigger"]') as HTMLButtonElement;

  it('shows the label of the current value on the trigger, panel closed', () => {
    expect(trigger().textContent).toContain('Does not repeat');
    expect(q('[data-testid="listbox-select-panel"]')).toBeNull();
  });

  it('opens the styled panel (not a native select) on trigger click', () => {
    trigger().click();
    fixture.detectChanges();
    const panel = q('[data-testid="listbox-select-panel"]');
    expect(panel).not.toBeNull();
    expect(panel!.querySelector('[role="listbox"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="listbox-select-option"]').length).toBe(4);
  });

  it('emits valueChange and closes when an option is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    trigger().click();
    fixture.detectChanges();
    const weekly = [...fixture.nativeElement.querySelectorAll('[data-testid="listbox-select-option"]')]
      .find((b: HTMLElement) => b.textContent?.trim() === 'Weekly') as HTMLButtonElement;
    weekly.click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledWith('weekly');
    expect(q('[data-testid="listbox-select-panel"]')).toBeNull();
  });

  it('closes on Escape without emitting', () => {
    const spy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    trigger().click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(q('[data-testid="listbox-select-panel"]')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('closes on outside click', () => {
    trigger().click();
    fixture.detectChanges();
    document.body.click();
    fixture.detectChanges();
    expect(q('[data-testid="listbox-select-panel"]')).toBeNull();
  });

  it('marks the selected option aria-selected', () => {
    fixture.componentRef.setInput('value', 'monthly');
    trigger().click();
    fixture.detectChanges();
    const selected = [...fixture.nativeElement.querySelectorAll('[data-testid="listbox-select-option"]')]
      .find((b: HTMLElement) => b.getAttribute('aria-selected') === 'true') as HTMLButtonElement;
    expect(selected.textContent?.trim()).toBe('Monthly');
  });

  it('filters the options by the search box when searchable, and shows no search box otherwise', () => {
    trigger().click();
    fixture.detectChanges();
    expect(q('[data-testid="listbox-select-search"]')).toBeNull();
    trigger().click();
    fixture.detectChanges();

    fixture.componentRef.setInput('searchable', true);
    trigger().click();
    fixture.detectChanges();
    const search = q('[data-testid="listbox-select-search"]') as HTMLInputElement;
    search.value = 'week';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll('[data-testid="listbox-select-option"]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('Weekly');
  });

  it('Enter in the search box picks the first match', () => {
    fixture.componentRef.setInput('searchable', true);
    const spy = vi.fn();
    fixture.componentInstance.valueChange.subscribe(spy);
    trigger().click();
    fixture.detectChanges();
    const search = q('[data-testid="listbox-select-search"]') as HTMLInputElement;
    search.value = 'mon';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(spy).toHaveBeenCalledWith('monthly');
  });

  it('renders a label tied to the trigger and an error message', () => {
    fixture.componentRef.setInput('label', 'Time zone');
    fixture.componentRef.setInput('error', 'Required.');
    fixture.detectChanges();

    const label = q('label') as HTMLLabelElement;
    expect(label.textContent).toContain('Time zone');
    expect(label.htmlFor).toBe(trigger().id);
    expect(fixture.nativeElement.textContent).toContain('Required.');
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
  });
});
