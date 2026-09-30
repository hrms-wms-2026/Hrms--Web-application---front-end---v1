import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BarChartComponent } from './bar-chart.component';
import { DetailCardComponent } from './detail-card.component';
import { DetailIconComponent } from './detail-icon.component';
import { EmptyNoteComponent } from './empty-note.component';
import { KvRowComponent } from './kv-row.component';
import { LineChartComponent } from './line-chart.component';
import { SegmentedBarComponent } from './segmented-bar.component';
import { StatTileComponent } from './stat-tile.component';
import { StatusBadgeComponent } from './status-badge.component';
import { TimelineComponent } from './timeline.component';

@Component({
  standalone: true,
  imports: [DetailCardComponent, KvRowComponent, StatusBadgeComponent],
  template: `
    <app-detail-card icon="calendar" title="Attendance" subtitle="This month" linkLabel="View attendance" linkUrl="/attendance">
      <button card-actions type="button">Action</button>
      <app-kv-row label="Position" [divided]="true">Engineer</app-kv-row>
      <app-status-badge tone="success">Approved</app-status-badge>
    </app-detail-card>
  `
})
class CardHostComponent {}

describe('detail kit', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('detail card renders heading, subtitle, projected actions, link and body', () => {
    const fixture = TestBed.createComponent(CardHostComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.card__title')?.textContent).toBe('Attendance');
    expect(root.querySelector('.card__subtitle')?.textContent).toBe('This month');
    expect(root.querySelector('.card__actions button')?.textContent).toBe('Action');
    expect(root.querySelector('.card__link')?.getAttribute('href')).toBe('/attendance');
    expect(root.querySelector('app-kv-row')?.getAttribute('aria-label')).toBe('Position');
    expect(root.querySelector('app-status-badge .badge')?.getAttribute('data-tone')).toBe('success');
  });

  it('detail icon renders the named path', () => {
    const fixture = TestBed.createComponent(DetailIconComponent);
    fixture.componentRef.setInput('name', 'check');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('path').getAttribute('d')).toBe('M5 12.5l4 4L19 7');
  });

  it('stat tile shows value, label and danger tone', () => {
    const fixture = TestBed.createComponent(StatTileComponent);
    fixture.componentRef.setInput('value', 2);
    fixture.componentRef.setInput('label', 'Late');
    fixture.componentRef.setInput('valueTone', 'danger');
    fixture.detectChanges();
    const value = fixture.nativeElement.querySelector('.tile__value');
    expect(value.textContent).toBe('2');
    expect(value.getAttribute('data-tone')).toBe('danger');
    expect(fixture.nativeElement.textContent).toContain('Late');
  });

  it('segmented bar sizes segments against the total and labels them', () => {
    const fixture = TestBed.createComponent(SegmentedBarComponent);
    fixture.componentRef.setInput('segments', [
      { value: 6, tone: 'info', label: 'Done' },
      { value: 2, tone: 'danger', label: 'Late' }
    ]);
    fixture.componentRef.setInput('total', 16);
    fixture.detectChanges();
    const widths = Array.from(fixture.nativeElement.querySelectorAll('.segment')).map((s) => (s as HTMLElement).style.width);
    expect(widths).toEqual(['37.5%', '12.5%']);
    expect(fixture.nativeElement.querySelector('.track').getAttribute('aria-label')).toBe('Done: 6, Late: 2');
  });

  it('bar chart scales bars to the top tick and renders axis labels', () => {
    const fixture = TestBed.createComponent(BarChartComponent);
    fixture.componentRef.setInput('bars', [{ value: 15, label: 'Apr' }, { value: 30, label: 'May', tone: 'danger' }]);
    fixture.componentRef.setInput('yTicks', [0, 10, 20, 30]);
    fixture.componentRef.setInput('axisLabels', ['Apr', 'May']);
    fixture.detectChanges();
    const bars = Array.from(fixture.nativeElement.querySelectorAll('.chart__bar')) as HTMLElement[];
    expect(bars.map((b) => b.style.height)).toEqual(['50%', '100%']);
    expect(bars[1].getAttribute('data-tone')).toBe('danger');
    expect(fixture.nativeElement.querySelector('.chart__labels').textContent).toContain('May');
  });

  it('line chart draws one marker and label per point', () => {
    const fixture = TestBed.createComponent(LineChartComponent);
    fixture.componentRef.setInput('points', [{ label: 'Apr', value: 50 }, { label: 'May', value: 75 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.line__dot').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.line__labels').textContent).toContain('May');
  });

  it('timeline renders items with optional rail', () => {
    const fixture = TestBed.createComponent(TimelineComponent);
    fixture.componentRef.setInput('items', [{ date: '01 Feb 2024', title: 'Joined company', description: 'Joined as Engineer.' }]);
    fixture.componentRef.setInput('rail', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.timeline__dot')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Joined company');
  });

  it('empty note shows title and description', () => {
    const fixture = TestBed.createComponent(EmptyNoteComponent);
    fixture.componentRef.setInput('title', 'No data yet');
    fixture.componentRef.setInput('description', 'Later.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No data yet');
    expect(fixture.nativeElement.textContent).toContain('Later.');
  });
});
