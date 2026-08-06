import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  it('renders the message with an alert role', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('message', 'Could not load departments.');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not load departments.');
  });

  it('hides the retry button by default', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('message', 'Something went wrong.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeFalsy();
  });

  it('emits retry when the retry button is clicked', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.componentRef.setInput('message', 'Something went wrong.');
    fixture.componentRef.setInput('retryable', true);
    fixture.detectChanges();
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));

    fixture.debugElement.query(By.css('button')).nativeElement.click();

    expect(retried).toBe(true);
  });
});
