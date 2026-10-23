import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { UnsupportedWidgetComponent } from './unsupported-widget.component';

describe('UnsupportedWidgetComponent', () => {
  it('shows_title_and_unavailable_message', () => {
    const fixture = TestBed.createComponent(UnsupportedWidgetComponent);
    fixture.componentRef.setInput('title', 'Old widget');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Old widget');
    expect(el.textContent).toContain('no longer available');
    expect(el.querySelector('[data-testid="unsupported-widget"]')).not.toBeNull();
  });
});
