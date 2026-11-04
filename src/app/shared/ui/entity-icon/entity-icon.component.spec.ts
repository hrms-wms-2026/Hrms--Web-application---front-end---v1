import { TestBed } from '@angular/core/testing';
import { EntityIconComponent } from './entity-icon.component';
import { parseEntityIcon } from './entity-icon.registry';

describe('EntityIconComponent', () => {
  function render(inputs: { icon?: string | null; color?: string | null; name?: string }): HTMLElement {
    const fixture = TestBed.createComponent(EntityIconComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws a Lucide icon as an SVG', () => {
    const el = render({ icon: 'lucide:rocket', color: '#6366F1', name: 'Apollo' });
    expect(el.querySelector('svg')).toBeTruthy();
    expect(el.querySelectorAll('svg path').length).toBeGreaterThan(0);
    expect((el.querySelector('.ei') as HTMLElement).style.getPropertyValue('--ei-color')).toBe('#6366F1');
  });

  it('shows an emoji as text', () => {
    const el = render({ icon: 'emoji:🚀', name: 'Apollo' });
    expect(el.querySelector('.ei__emoji')?.textContent).toBe('🚀');
    expect(el.querySelector('svg')).toBeNull();
  });

  it('falls back to initials with no icon, or an icon this build does not offer', () => {
    expect(render({ name: 'payroll team' }).querySelector('.ei__initials')?.textContent).toBe('PT');
    expect(render({ icon: 'lucide:not-a-real-icon', name: 'Ops' }).querySelector('.ei__initials')?.textContent).toBe('O');
  });
});

describe('parseEntityIcon', () => {
  it('reads both kinds and rejects anything else', () => {
    expect(parseEntityIcon('lucide:calendar-days')).toMatchObject({ kind: 'lucide', name: 'calendar-days' });
    expect(parseEntityIcon('emoji:🎉')).toEqual({ kind: 'emoji', emoji: '🎉' });
    expect(parseEntityIcon(null)).toBeNull();
    expect(parseEntityIcon('')).toBeNull();
    expect(parseEntityIcon('emoji:')).toBeNull();
    expect(parseEntityIcon('fa:rocket')).toBeNull();
  });
});
