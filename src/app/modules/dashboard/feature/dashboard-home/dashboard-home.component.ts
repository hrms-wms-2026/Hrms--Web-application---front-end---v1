import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { DashboardLayoutService } from '../../state/dashboard-layout.service';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { DASHBOARD_CARD_META, DashboardCardKey, DashboardZoneId } from '../../utils/dashboard-layout.util';
import { DashboardCardComponent } from '../dashboard-card/dashboard-card.component';
import { DashboardCustomizePanelComponent } from '../dashboard-customize-panel/dashboard-customize-panel.component';

/**
 * Employee dashboard content area for the authenticated dashboard route - a customizable layout.
 *
 * Default (DEFAULT_DASHBOARD_LAYOUT): Good morning + Today's Schedule, Action Center + My Tasks,
 * Quick Actions + Team Progress, then Work Pattern full-width; Team Status, Notifications and
 * Wellbeing start unticked. The My Team cards exist only for viewers with My Team capabilities
 * (My Team spec §5, AC-1).
 *
 * "Customize" (top right) switches to edit mode: every card becomes a small tile that can be
 * dragged anywhere - any column, or the full-width rows at the top and bottom - and the side list
 * ticks cards on or off. Done saves the layout per employee in this browser; Cancel / Esc drops it.
 * Attendance Trend and Task Progress live on the My Insights page; Activity Timeline has its own.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  host: { class: 'block', '(document:keydown.escape)': 'onEscape()' },
  imports: [NgTemplateOutlet, CdkDropListGroup, CdkDropList, CdkDrag, DashboardCardComponent, DashboardCustomizePanelComponent],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent implements OnInit, OnDestroy {
  protected readonly layout = inject(DashboardLayoutService);
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);

  protected readonly columnZones: readonly DashboardZoneId[] = ['col0', 'col1', 'col2'];

  ngOnInit(): void {
    void this.capabilitiesStore.ensureLoaded();
  }

  /** Leaving the page mid-edit drops the draft. */
  ngOnDestroy(): void {
    this.layout.cancel();
  }

  label(key: DashboardCardKey): string {
    return DASHBOARD_CARD_META[key].label;
  }

  isTeam(key: DashboardCardKey): boolean {
    return DASHBOARD_CARD_META[key].group === 'team';
  }

  columnKeys(zone: DashboardZoneId): DashboardCardKey[] {
    return this.layout.resolved().columns[Number(zone.slice(3))];
  }

  onDrop(event: CdkDragDrop<DashboardZoneId, DashboardZoneId, DashboardCardKey>): void {
    this.layout.drop(event.item.data, event.container.data, event.currentIndex);
  }

  onEscape(): void {
    if (this.layout.editing()) this.layout.cancel();
  }
}
