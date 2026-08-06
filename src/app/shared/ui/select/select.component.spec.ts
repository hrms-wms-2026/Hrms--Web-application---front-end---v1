import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SelectComponent } from './select.component';

describe('SelectComponent', () => {
  it('renders every option and selects the bound value', () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('options', [
      { value: 'us', label: 'United States' },
      { value: 'in', label: 'India' }
    ]);
    fixture.componentRef.setInput('value', 'in');
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.value).toBe('in');
  });

  it('emits valueChange on selection', () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('options', [
      { value: 'us', label: 'United States' },
      { value: 'in', label: 'India' }
    ]);
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.valueChange.subscribe((value) => (emitted = value));

    const select = fixture.debugElement.query(By.css('select')).nativeElement as HTMLSelectElement;
    select.value = 'us';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toBe('us');
  });

  it('renders a disabled placeholder option when placeholder is set', () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('placeholder', 'Select a country');
    fixture.componentRef.setInput('options', [{ value: 'us', label: 'United States' }]);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options[0].textContent).toBe('Select a country');
    expect(select.options[0].disabled).toBe(true);
  });
});
