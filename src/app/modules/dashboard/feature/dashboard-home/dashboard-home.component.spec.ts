import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../../core/services/notification.service';
import { DashboardLayoutApiService } from '../../data-access/dashboard-layout-api.service';
import { DashboardBootstrap } from '../../models/dashboard-layout.model';
import { DashboardHomeComponent } from './dashboard-home.component';

const BOOTSTRAP: DashboardBootstrap = {
  id: 'd1',
  key: 'my-work',
  title: 'My Work',
  layoutVersion: 1,
  grid: { breakpoint: 'desktop', columns: 12, rowHeight: 96, gap: 12 },
  widgets: [],
  hasAllowedGatedWidgets: true,
  capabilitiesUnavailable: false
};

describe('DashboardHomeComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('renders_my_work_shell', async () => {
    const api = {
      listMine: vi.fn(() => of([{ id: 'd1', key: 'my-work', title: 'My Work', layoutVersion: 1 }])),
      bootstrap: vi.fn(() => of(BOOTSTRAP)),
      available: vi.fn(() => of([])),
      widgetData: vi.fn(() => of())
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: DashboardLayoutApiService, useValue: api },
        { provide: NotificationService, useValue: { warning: vi.fn(), error: vi.fn(), success: vi.fn() } }
      ]
    });
    const fixture = TestBed.createComponent(DashboardHomeComponent);
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise(resolve => setTimeout(resolve));
    }
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-dashboard-shell')).not.toBeNull();
    expect(api.listMine).toHaveBeenCalled();
    expect(api.bootstrap).toHaveBeenCalledWith(expect.anything(), expect.anything());
  });
});
