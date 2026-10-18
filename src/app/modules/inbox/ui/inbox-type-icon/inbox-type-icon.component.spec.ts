import { TestBed } from '@angular/core/testing';
import { InboxTypeIconComponent } from './inbox-type-icon.component';

describe('InboxTypeIconComponent', () => {
  function render(icon: string, tone: 'accent' | 'danger' = 'accent') {
    TestBed.configureTestingModule({ imports: [InboxTypeIconComponent] });
    const fixture = TestBed.createComponent(InboxTypeIconComponent);
    fixture.componentRef.setInput('icon', icon);
    fixture.componentRef.setInput('tone', tone);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the alert glyph with the tone class', () => {
    const el = render('alert', 'danger');
    expect(el.getAttribute('data-icon')).toBe('alert');
    expect(el.classList).toContain('iti--danger');
    expect(el.querySelectorAll('path').length).toBe(3);
  });

  it('falls back to the task glyph for an unknown icon', () => {
    expect(render('nope').querySelectorAll('path').length).toBe(3);
  });
});
