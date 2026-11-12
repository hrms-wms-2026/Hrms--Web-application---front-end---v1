import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KpiTile, KpiTilesComponent } from './kpi-tiles.component';

@Component({
  standalone: true,
  imports: [KpiTilesComponent],
  template: `<app-kpi-tiles ariaLabel="Totals" [tiles]="tiles()" [palette]="palette()" />`
})
class TestHostComponent {
  readonly tiles = signal<readonly KpiTile[]>([]);
  readonly palette = signal<'default' | 'widget'>('default');
}

describe('KpiTilesComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
  });

  function render(tiles: readonly KpiTile[]): HTMLElement {
    fixture.componentInstance.tiles.set(tiles);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders label, value, hint and value test id', () => {
    const el = render([{ label: 'Remaining', value: '17.00', hint: 'across 2 leave types', testId: 'summary-remaining' }]);
    expect(el.textContent).toContain('Remaining');
    expect(el.textContent).toContain('across 2 leave types');
    expect(el.querySelector('[data-testid="summary-remaining"]')?.textContent).toContain('17.00');
  });

  it('uses one column per tile so the row is always full, capped at 4', () => {
    const grid = () => (fixture.nativeElement as HTMLElement).querySelector('.kpi-tiles') as HTMLElement;
    render([{ label: 'A', value: 1 }, { label: 'B', value: 2 }]);
    expect(grid().style.getPropertyValue('--kpi-cols')).toBe('2');
    render([1, 2, 3, 4, 5].map((n) => ({ label: `T${n}`, value: n })));
    expect(grid().style.getPropertyValue('--kpi-cols')).toBe('4');
  });

  it('colours the value of danger tiles and renders the icon badge only when an icon is given', () => {
    const el = render([{ label: 'Over-utilized', value: 3, icon: 'alert-triangle', tone: 'danger' }, { label: 'Lines', value: 9 }]);
    expect(el.querySelectorAll('.kpi-tile--danger').length).toBe(1);
    expect(el.querySelectorAll('.kpi-tile__icon').length).toBe(1);
  });

  it('keeps the default tone colours when the widget palette is off (Leave, People pages)', () => {
    const el = render([{ label: 'Done', value: 4, icon: 'alert-triangle', tone: 'success' }]);
    const icon = el.querySelector('.kpi-tile__icon') as HTMLElement;
    expect(icon.style.color).toBe('var(--color-success)');
    expect((el.querySelector('.kpi-tile') as HTMLElement).style.background).toBe('');
  });

  it('palette="widget" draws every tile as the mild theme card, with maroon values for danger', () => {
    fixture.componentInstance.palette.set('widget');
    const el = render([
      { label: 'Done', value: 4, icon: 'alert-triangle', tone: 'success' },
      { label: 'Absent', value: 2, icon: 'alert-triangle', tone: 'danger' }
    ]);
    const [done, absent] = Array.from(el.querySelectorAll('.kpi-tile')) as HTMLElement[];
    expect(done.style.background).toBe('var(--color-widget-mild)');
    expect(done.style.borderColor).toBe('var(--color-widget-mild-line)');
    expect((done.querySelector('.kpi-tile__icon') as HTMLElement).style.color).toBe('var(--color-widget-shade-1)');
    expect((done.querySelector('.kpi-tile__value') as HTMLElement).style.color).toBe('var(--color-widget-shade-1)');
    expect((absent.querySelector('.kpi-tile__value') as HTMLElement).style.color).toBe('var(--color-widget-maroon)');
  });
});
