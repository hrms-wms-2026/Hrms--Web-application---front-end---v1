import { TestBed } from '@angular/core/testing';
import { FieldErrorComponent } from './field-error.component';

describe('FieldErrorComponent', () => {
  it('renders the message with the shared error style, and nothing when empty', () => {
    const fixture = TestBed.createComponent(FieldErrorComponent);
    fixture.componentRef.setInput('message', '');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.ui-field-error')).toBeNull();

    fixture.componentRef.setInput('message', 'Code is required.');
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('.ui-field-error');
    expect(el?.textContent?.trim()).toBe('Code is required.');
    expect(el?.getAttribute('role')).toBe('alert');
  });
});
