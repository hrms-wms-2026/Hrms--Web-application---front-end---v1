import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AttendanceEmptyStateComponent } from './attendance-empty-state.component';

describe('AttendanceEmptyStateComponent', () => {
  it('renders the message and one svg path per icon path, hiding the icon from assistive tech', () => {
    const fixture = TestBed.createComponent(AttendanceEmptyStateComponent);
    fixture.componentRef.setInput('iconPaths', ['M0 0h1', 'M1 1h2']);
    fixture.componentRef.setInput('message', 'Nothing here yet.');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.empty-copy')?.textContent).toContain('Nothing here yet.');
    expect(Array.from(root.querySelectorAll('path')).map((path) => path.getAttribute('d'))).toEqual(['M0 0h1', 'M1 1h2']);
    expect(root.querySelector('.empty-state-icon')?.getAttribute('aria-hidden')).toBe('true');
  });
});
