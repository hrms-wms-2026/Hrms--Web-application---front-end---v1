import { TestBed } from '@angular/core/testing';
import { FieldErrorComponent } from './field-error.component';

describe('FieldErrorComponent', () => {
  it('renders the message with the shared error style, and nothing when empty', () => {
    const fixture = TestBed.createComponent(FieldErrorComponent);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ui-field-error')).toBeNull();

    fixture.componentRef.setInput('message', 'Use a colour like #2563EB.');
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('.ui-field-error');
    expect(el?.textContent?.trim()).toBe('Use a colour like #2563EB.');
    expect(el?.getAttribute('role')).toBe('alert');
  });
});
