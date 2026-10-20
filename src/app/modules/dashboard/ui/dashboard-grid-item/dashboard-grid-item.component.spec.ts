import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DashboardCardSize } from '../../utils/dashboard-layout.util';
import { DashboardGridItemComponent } from './dashboard-grid-item.component';

@Component({
  standalone: true,
  imports: [DashboardGridItemComponent],
  template: `<app-dashboard-grid-item [size]="size()"><p>card</p></app-dashboard-grid-item>`
})
class HostComponent {
  readonly size = signal<DashboardCardSize>('small');
}

describe('DashboardGridItemComponent', () => {
  it('spans one column when small and two when large, and is a size container', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const item: HTMLElement = fixture.nativeElement.querySelector('app-dashboard-grid-item');
    expect(item.classList).toContain('@container');
    expect(item.classList).not.toContain('md:col-span-2');
    expect(item.dataset['size']).toBe('small');
    expect(item.textContent).toContain('card');

    fixture.componentInstance.size.set('large');
    fixture.detectChanges();
    expect(item.classList).toContain('md:col-span-2');
    expect(item.dataset['size']).toBe('large');
  });
});
