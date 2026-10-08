import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { LedWorkProgressResponse } from '../../models/my-team-led-progress.model';
import { MyTeamWidgetKey } from '../../models/my-team-widget-key.model';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { TeamKpiStripComponent } from './team-kpi-strip.component';

const PROGRESS: LedWorkProgressResponse = {
  totals: { total: 10, completed: 4, inProgress: 3, notStarted: 3, overdue: 2 },
  projects: [], overdueTasks: [], overdueTotal: 2
};

describe('TeamKpiStripComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(visible: MyTeamWidgetKey[], ledProgress: LedWorkProgressResponse | null) {
    await TestBed.configureTestingModule({
      imports: [TeamKpiStripComponent],
      providers: [
        { provide: MyTeamTodayStore, useValue: { data: signal(null) } },
        { provide: MyTeamActionItemsStore, useValue: { data: signal(null) } },
        { provide: MyTeamLedProgressStore, useValue: { data: signal(ledProgress) } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TeamKpiStripComponent);
    fixture.componentRef.setInput('visibleWidgets', visible);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a tile for each widget that is visible and loaded', async () => {
    const fixture = await setup(['teamProgress'], PROGRESS);
    const tile: HTMLElement = fixture.nativeElement.querySelector('[data-testid="team-kpi-overdue"]');
    expect(tile.textContent).toContain('Overdue tasks');
    expect(tile.textContent).toContain('2');
    expect(fixture.nativeElement.querySelector('[data-testid="team-kpi-present"]')).toBeNull();
  });

  it('renders nothing when no source has loaded', async () => {
    const fixture = await setup(['teamStatus', 'actionCenter', 'teamProgress'], null);
    expect(fixture.nativeElement.querySelector('[data-testid="team-kpi-strip"]')).toBeNull();
  });

  it('scrolls to the widget a tile summarises', async () => {
    const fixture = await setup(['teamProgress'], PROGRESS);
    const target = document.createElement('div');
    target.id = 'my-team-widget-teamProgress';
    let scrolled = false;
    target.scrollIntoView = () => {
      scrolled = true;
    };
    document.body.appendChild(target);

    fixture.nativeElement.querySelector('[data-testid="team-kpi-overdue"]').click();
    expect(scrolled).toBe(true);
    target.remove();
  });
});
