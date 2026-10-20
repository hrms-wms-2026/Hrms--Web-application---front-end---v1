import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, afterNextRender, effect, inject } from '@angular/core';
import { PageToolbarService } from '../../../../shared/state/page-toolbar.service';
import { DashboardLayoutService } from '../../state/dashboard-layout.service';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { DashboardGridItemComponent } from '../../ui/dashboard-grid-item/dashboard-grid-item.component';
import { DASHBOARD_CARD_META, DashboardCardKey, DashboardCardSize, DashboardZoneId } from '../../utils/dashboard-layout.util';
import { DashboardCardComponent } from '../dashboard-card/dashboard-card.component';
import { DashboardCustomizePanelComponent } from '../dashboard-customize-panel/dashboard-customize-panel.component';

/**
 * Employee dashboard content area for the authenticated dashboard route - a customizable layout.
 *
 * Cards sit on a 4-column grid in one of two sizes - Small (1 column) or Large (2 columns) - between
 * optional full-width bands at the top and bottom. Default (DEFAULT_DASHBOARD_LAYOUT): Good morning (S),
 * Action Center (L), Quick Actions (S); Today's Schedule (L), Total time today (S), Active projects (S);
 * My Tasks (L); then Work Pattern full-width; Notifications and Wellbeing start unticked. Action
 * Center shows only to viewers whose My Team capabilities allow it (My Team spec §5, AC-1); Team
 * Status and Team Progress live on the separate My Team dashboard (Quick Actions -> My Team).
 *
 * "Customize" (top right) switches to edit mode: every card becomes a small tile that can be
 * dragged anywhere - within the grid, or into the full-width rows at the top and bottom - S / L on a
 * grid tile sets its size, and the side list ticks cards on or off. Done saves the layout per employee in this browser; Cancel / Esc drops it.
 * Attendance Trend and Task Progress live on the My Insights page; Activity Timeline has its own.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  host: { class: 'block', '(document:keydown.escape)': 'onEscape()' },
  imports: [NgTemplateOutlet, CdkDropListGroup, CdkDropList, CdkDrag, DashboardCardComponent, DashboardGridItemComponent, DashboardCustomizePanelComponent],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent implements OnInit, OnDestroy {
  protected readonly layout = inject(DashboardLayoutService);
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);
  private readonly pageToolbar = inject(PageToolbarService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly gridZone: DashboardZoneId = 'grid';
  protected readonly sizes: readonly { id: DashboardCardSize; short: string; label: string; hint: string }[] = [
    { id: 'small', short: 'S', label: 'Small', hint: '1 column' },
    { id: 'large', short: 'L', label: 'Large', hint: '2 columns' }
  ];

  constructor() {
    afterNextRender(() => this.trackViewportHeight());

    // "Customize" lives in the top navbar while this page is open - hidden again once editing starts,
    // since the edit bar's own Done/Cancel/Reset take over at that point.
    effect(() => {
      if (this.layout.editing()) {
        this.pageToolbar.clear();
      } else {
        this.pageToolbar.set({ label: 'Customize', disabled: () => !this.layout.ready(), onClick: () => this.layout.startEditing() });
      }
    });
  }

  ngOnInit(): void {
    void this.capabilitiesStore.ensureLoaded();
  }

  /** Leaving the page mid-edit drops the draft; either way, the navbar button goes with it. */
  ngOnDestroy(): void {
    this.layout.cancel();
    this.pageToolbar.clear();
  }

  /**
   * Publishes the visible height of the page's scroll area (without its padding) as
   * --dashboard-viewport-h, which the grid uses to make two rows exactly fill the screen on wide
   * screens (dashboard-home.component.css). Measured rather than derived from 100vh so the app's
   * navbar, margins and browser chrome are all accounted for, and kept current on resize.
   */
  private trackViewportHeight(): void {
    const host = this.host.nativeElement;
    const viewport = host.closest<HTMLElement>('.main-content__viewport');
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const update = (): void => {
      const style = getComputedStyle(viewport);
      const height = viewport.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0');
      if (height > 0) host.style.setProperty('--dashboard-viewport-h', `${height}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    update();
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  label(key: DashboardCardKey): string {
    return DASHBOARD_CARD_META[key].label;
  }

  isTeam(key: DashboardCardKey): boolean {
    return DASHBOARD_CARD_META[key].group === 'team';
  }

  onDrop(event: CdkDragDrop<DashboardZoneId, DashboardZoneId, DashboardCardKey>): void {
    this.layout.drop(event.item.data, event.container.data, event.currentIndex);
  }

  onEscape(): void {
    if (this.layout.editing()) this.layout.cancel();
  }
}
