import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { InputComponent } from './input.component';

describe('InputComponent', () => {
  it('renders the label and binds the value to the native input', async () => {
    await TestBed.configureTestingModule({ imports: [InputComponent] }).compileComponents();
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('label', 'Company name');
    fixture.componentRef.setInput('value', 'Acme');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('label')?.textContent).toContain('Company name');
    expect((el.querySelector('input') as HTMLInputElement).value).toBe('Acme');
  });

  it('emits valueChange on input', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.detectChanges();
    let emitted: string | undefined;
    fixture.componentInstance.valueChange.subscribe((value) => (emitted = value));

    const input = fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
    input.value = 'new value';
    input.dispatchEvent(new Event('input'));

    expect(emitted).toBe('new value');
  });

  it('marks the input aria-invalid and links the error message when error is set', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('error', 'Name is required');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.textContent).toContain('Name is required');
  });

  it('disables the native input when disabled is true', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
