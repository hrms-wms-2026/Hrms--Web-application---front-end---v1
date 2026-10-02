import { TestBed } from '@angular/core/testing';
import { CustomSelectComponent } from './custom-select.component';

describe('CustomSelectComponent', () => {
  it('renders placeholder and toggles dropdown menu on click', () => {
    const fixture = TestBed.createComponent(CustomSelectComponent);
    fixture.componentRef.setInput('placeholder', 'Select department');
    fixture.componentRef.setInput('options', [
      { value: 'd1', label: 'Engineering' },
      { value: 'd2', label: 'Design' }
    ]);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    expect(trigger.textContent).toContain('Select department');
    expect(fixture.nativeElement.querySelector('.custom-select__menu')).toBeNull();

    trigger.click();
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('.custom-select__menu');
    expect(menu).not.toBeNull();
    const options = fixture.nativeElement.querySelectorAll('.custom-select__option');
    expect(options.length).toBe(2);
  });

  it('emits valueChange and closes when an option is selected', () => {
    const fixture = TestBed.createComponent(CustomSelectComponent);
    fixture.componentRef.setInput('options', [
      { value: 'd1', label: 'Engineering' },
      { value: 'd2', label: 'Design' }
    ]);
    fixture.detectChanges();

    let selectedValue: string | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (selectedValue = v));

    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const optionButtons = fixture.nativeElement.querySelectorAll('.custom-select__option') as NodeListOf<HTMLButtonElement>;
    optionButtons[1].click();
    fixture.detectChanges();

    expect(selectedValue).toBe('d2');
    expect(fixture.nativeElement.querySelector('.custom-select__menu')).toBeNull();
  });

  it('renders disabled options with badge and prevents selection', () => {
    const fixture = TestBed.createComponent(CustomSelectComponent);
    fixture.componentRef.setInput('options', [
      { value: 'pos-1', label: 'Software Engineer [2]' },
      { value: 'pos-2', label: 'Project Manager [No vacancy]', disabled: true }
    ]);
    fixture.detectChanges();

    let selectedValue: string | undefined;
    fixture.componentInstance.valueChange.subscribe((v) => (selectedValue = v));

    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll('.custom-select__option-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent).toContain('2 open');
    expect(badges[1].textContent).toContain('No vacancy');

    const optionButtons = fixture.nativeElement.querySelectorAll('.custom-select__option') as NodeListOf<HTMLButtonElement>;
    expect(optionButtons[1].disabled).toBe(true);

    optionButtons[1].click();
    fixture.detectChanges();
    expect(selectedValue).toBeUndefined();
  });

  it('renders search bar and filters options dynamically', () => {
    const fixture = TestBed.createComponent(CustomSelectComponent);
    fixture.componentRef.setInput('placeholder', 'Select department');
    fixture.componentRef.setInput('options', [
      { value: 'd1', label: 'Engineering' },
      { value: 'd2', label: 'Design' },
      { value: 'd3', label: 'Human Resources' }
    ]);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.custom-select__trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const searchInput = fixture.nativeElement.querySelector('.custom-select__search-input') as HTMLInputElement;
    expect(searchInput).not.toBeNull();
    expect(searchInput.placeholder).toBe('Search...');

    // Type query "eng"
    searchInput.value = 'eng';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    let options = fixture.nativeElement.querySelectorAll('.custom-select__option');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('Engineering');

    // Type non-matching query
    searchInput.value = 'xyz';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    options = fixture.nativeElement.querySelectorAll('.custom-select__option');
    expect(options.length).toBe(0);
    const emptyMsg = fixture.nativeElement.querySelector('.custom-select__empty');
    expect(emptyMsg.textContent).toContain('No matches found');

    // Click clear button
    const clearBtn = fixture.nativeElement.querySelector('.custom-select__search-clear') as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();
    clearBtn.click();
    fixture.detectChanges();

    options = fixture.nativeElement.querySelectorAll('.custom-select__option');
    expect(options.length).toBe(3);
  });
});
