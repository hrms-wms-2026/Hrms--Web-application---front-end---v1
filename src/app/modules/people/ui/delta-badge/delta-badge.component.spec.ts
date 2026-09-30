import { TestBed } from '@angular/core/testing';
import { Delta } from '../../utils/employee-overview.utils';
import { DeltaBadgeComponent } from './delta-badge.component';

describe('DeltaBadgeComponent', () => {
  function render(delta: Delta | null) {
    TestBed.configureTestingModule({ imports: [DeltaBadgeComponent] });
    const fixture = TestBed.createComponent(DeltaBadgeComponent);
    fixture.componentRef.setInput('delta', delta);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const badge = (el: HTMLElement) => el.querySelector('[data-testid="delta"]') as HTMLElement | null;

  it('renders nothing without a delta', () => {
    expect(badge(render(null))).toBeNull();
  });

  it('shows an up arrow, the text and the tone class', () => {
    const el = badge(render({ text: '+2', direction: 'up', tone: 'good' }))!;

    expect(el.textContent).toContain('▲');
    expect(el.textContent).toContain('+2');
    expect(el.classList.contains('delta--good')).toBe(true);
  });

  it('shows a down arrow for a decrease and a dash when flat', () => {
    expect(badge(render({ text: '-3', direction: 'down', tone: 'bad' }))!.textContent).toContain('▼');

    TestBed.resetTestingModule();
    const flat = badge(render({ text: 'No change', direction: 'flat', tone: 'neutral' }))!;
    expect(flat.textContent).toContain('–');
    expect(flat.classList.contains('delta--neutral')).toBe(true);
  });

  it('exposes a readable label for assistive technology', () => {
    const el = badge(render({ text: '+2', direction: 'up', tone: 'bad' }))!;

    expect(el.getAttribute('aria-label')).toBe('Up +2 versus the previous period');
  });
});
