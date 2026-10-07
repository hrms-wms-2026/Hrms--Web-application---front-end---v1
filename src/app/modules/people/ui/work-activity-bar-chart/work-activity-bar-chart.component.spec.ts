import { TestBed } from '@angular/core/testing';
import { WorkActivityBarChartComponent } from './work-activity-bar-chart.component';

describe('WorkActivityBarChartComponent', () => {
  function render(bars: readonly { label: string; value: number }[]) {
    TestBed.configureTestingModule({ imports: [WorkActivityBarChartComponent] });
    const fixture = TestBed.createComponent(WorkActivityBarChartComponent);
    fixture.componentRef.setInput('bars', bars);
    fixture.componentRef.setInput('ariaLabel', 'Tasks completed per month');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws one bar per value, scaled to the largest', () => {
    const el = render([
      { label: 'Aug', value: 5 },
      { label: 'Sep', value: 10 }
    ]);
    const bars = el.querySelectorAll<HTMLElement>('[data-testid="bar"]');

    expect(bars.length).toBe(2);
    expect(bars[0].style.height).toBe('50%');
    expect(bars[1].style.height).toBe('100%');
    expect(el.textContent).toContain('Aug');
  });

  it('rounds an odd max up so the axis never repeats a label', () => {
    const el = render([{ label: 'Sep', value: 1 }]);
    const labels = Array.from(el.querySelectorAll('span.absolute')).map((s) => s.textContent!.trim());

    expect(labels).toEqual(['2', '1', '0']);
    expect(el.querySelector<HTMLElement>('[data-testid="bar"]')!.style.height).toBe('50%');
  });

  it('draws flat bars when every value is zero', () => {
    const el = render([{ label: 'Aug', value: 0 }]);
    expect(el.querySelector<HTMLElement>('[data-testid="bar"]')!.style.height).toBe('0%');
  });

  it('exposes the values to assistive tech', () => {
    const el = render([{ label: 'Sep', value: 10 }]);
    expect(el.querySelector('[role="img"]')!.getAttribute('aria-label')).toContain('Sep: 10');
  });
});
