import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { MY_TEAM_WIDGET_LABEL, MyTeamWidgetKey } from '../../models/my-team-widget-key.model';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamWidgetPreferenceService } from '../../state/my-team-widget-preference.service';
import { TeamKpiStripComponent } from '../team-kpi-strip/team-kpi-strip.component';

/** The "My Team" header of the merged /dashboard page (My Team spec §5) - not a route, not a tab:
 * the section heading, the Customize picker and the KPI strip. The widgets themselves render in
 * the My Day columns (app-my-team-slot), filling the space under each column in the viewer's
 * order. Renders nothing at all - no heading, no empty state - unless capabilities.isAvailable is
 * true (AC-1); each widget is independently capability-gated via allowedWidgetKeys (§14). */
@Component({
  selector: 'app-my-team-section',
  standalone: true,
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    TeamKpiStripComponent
  ],
  templateUrl: './my-team-section.component.html',
  styleUrl: './my-team-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTeamSectionComponent implements OnInit {
  protected readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);
  private readonly preference = inject(MyTeamWidgetPreferenceService);

  protected readonly widgetLabel = MY_TEAM_WIDGET_LABEL;
  protected readonly pickerOpen = signal(false);

  protected readonly allowedKeys = this.preference.allowedKeys;
  protected readonly visibleKeys = this.preference.visibleKeys;
  protected readonly hiddenAllowedKeys = this.preference.hiddenAllowedKeys;

  ngOnInit(): void {
    void this.capabilitiesStore.ensureLoaded();
  }

  togglePicker(): void {
    this.pickerOpen.update((open) => !open);
  }

  toggleWidget(key: MyTeamWidgetKey): void {
    this.preference.toggle(key);
  }

  onDrop(event: CdkDragDrop<MyTeamWidgetKey[]>): void {
    this.preference.move(event.previousIndex, event.currentIndex);
  }
}
