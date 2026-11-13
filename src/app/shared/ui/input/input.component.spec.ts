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

  it('renders a native date input when type is "date"', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('type', 'date');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('date');
  });

  it('toggles password visibility when eye toggle button is clicked', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('type', 'password');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(input.type).toBe('password');
    expect(button.getAttribute('aria-label')).toBe('Show password');

    button.click();
    fixture.detectChanges();

    expect(input.type).toBe('text');
    expect(button.getAttribute('aria-label')).toBe('Hide password');
  });

  it('shows a character counter once typing reaches 80% of maxlength', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('multiline', true);
    fixture.componentRef.setInput('maxlength', 10);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const textarea = el.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('maxlength')).toBe('10');

    textarea.value = 'abcdefg';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="char-counter"]')).toBeNull();

    textarea.value = 'abcdefgh';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="char-counter"]')?.textContent?.trim()).toBe('8 / 10');
  });

  it('counts a value set by the host, not only typing', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('maxlength', 5);
    fixture.componentRef.setInput('value', 'hello');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="char-counter"]')?.textContent).toContain('Character limit reached');
  });

  it('shows no counter without maxlength', () => {
    const fixture = TestBed.createComponent(InputComponent);
    fixture.componentRef.setInput('value', 'x'.repeat(5000));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-char-counter')).toBeNull();
  });
});
