import { TestBed } from '@angular/core/testing';
import { DashboardSkeletonComponent } from './dashboard-skeleton.component';

describe('DashboardSkeletonComponent', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(DashboardSkeletonComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('announces loading to screen readers once, with the cards hidden from them', () => {
    const el = render();
    const status = el.querySelector('[data-testid="dashboard-skeleton"]');
    expect(status?.getAttribute('role')).toBe('status');
    expect(status?.textContent?.trim()).toBe('Loading your dashboard');
    const cards = Array.from(el.querySelectorAll('[data-testid="dashboard-skeleton-card"]'));
    expect(cards.every((c) => c.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('lays out five placeholder cards on the 12-column grid', () => {
    const cards = Array.from(render().querySelectorAll<HTMLElement>('[data-testid="dashboard-skeleton-card"]'));
    expect(cards).toHaveLength(5);
    const spans = cards.map((c) => [c.style.getPropertyValue('--dsk-w'), c.style.getPropertyValue('--dsk-h')]);
    expect(spans).toEqual([
      ['4', '3'],
      ['5', '3'],
      ['3', '3'],
      ['6', '4'],
      ['6', '4']
    ]);
  });

  it('draws each kind of placeholder body', () => {
    const el = render();
    expect(el.querySelectorAll('.dsk-donut')).toHaveLength(1);
    expect(el.querySelectorAll('.dsk-bars')).toHaveLength(2);
    expect(el.querySelectorAll('.dsk-tile')).toHaveLength(4);
    expect(el.querySelectorAll('.dsk-row')).toHaveLength(5);
  });
});
