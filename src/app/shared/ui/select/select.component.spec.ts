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

    it('renders the requested Work Management leading icon without changing native select semantics', () => {
    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('options', [{ value: 'all', label: 'All modules' }]);
    fixture.componentRef.setInput('value', 'all');
    fixture.componentRef.setInput('icon', 'module');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('select')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="select-leading-icon"]')).not.toBeNull();
  });

  it('renders disabled options as disabled without affecting enabled options', () => {

    const fixture = TestBed.createComponent(SelectComponent);
    fixture.componentRef.setInput('options', [
      { value: 'open', label: 'Software Engineer [2]' },
      { value: 'full', label: 'Project Manager [No vacancy]', disabled: true }
    ]);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options[0].disabled).toBe(false);
    expect(select.options[1].disabled).toBe(true);
  });
});
