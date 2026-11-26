import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { AttendanceErrorBannerComponent } from './attendance-error-banner.component';

describe('AttendanceErrorBannerComponent', () => {
  it('announces the message and emits retryRequested from the button', () => {
    const fixture = TestBed.createComponent(AttendanceErrorBannerComponent);
    fixture.componentRef.setInput('message', 'Could not load.');
    fixture.detectChanges();
    const retry = vi.fn();
    fixture.componentInstance.retryRequested.subscribe(retry);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Could not load.');
    root.querySelector<HTMLButtonElement>('button')!.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('hides the retry button when canRetry is false', () => {
    const fixture = TestBed.createComponent(AttendanceErrorBannerComponent);
    fixture.componentRef.setInput('message', 'No access.');
    fixture.componentRef.setInput('canRetry', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
