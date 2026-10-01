import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { ApprovalsExceptionsCardComponent } from '../approvals-exceptions-card/approvals-exceptions-card.component';
import { PriorityActionsCardComponent } from '../priority-actions-card/priority-actions-card.component';
import { TeamProgressCardComponent } from '../team-progress-card/team-progress-card.component';
import { TeamStatusCardComponent } from '../team-status-card/team-status-card.component';
import { MY_TEAM_WIDGET_LABEL, MyTeamWidgetKey } from '../../models/my-team-widget-key.model';
import { allowedWidgetKeys, resolveVisibleWidgets } from '../../utils/my-team-widget-visibility.util';
import { loadMyTeamWidgetPreference, saveMyTeamWidgetPreference } from '../../utils/my-team-widget-preference.util';

/** The "My Team" section appended below My Day on the one merged /dashboard page (My Team spec
 * §5) - not a route, not a tab. Renders nothing at all - no heading, no empty state - unless
 * capabilities.isAvailable is true (AC-1); each widget inside is independently capability-gated
 * via allowedWidgetKeys (§14 "widget-level, not page-level, visibility").</summary> */
@Component({
  selector: 'app-my-team-section',
  standalone: true,
  imports: [
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    TeamStatusCardComponent,
    ApprovalsExceptionsCardComponent,
    TeamProgressCardComponent,
    PriorityActionsCardComponent
  ],
  templateUrl: './my-team-section.component.html',
  styleUrl: './my-team-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTeamSectionComponent implements OnInit {
  protected readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);

  protected readonly widgetLabel = MY_TEAM_WIDGET_LABEL;
  protected readonly pickerOpen = signal(false);
  private readonly storedPreference = signal<MyTeamWidgetKey[]>(loadMyTeamWidgetPreference());

  protected readonly allowedKeys = computed(() => allowedWidgetKeys(this.capabilitiesStore.capabilities()));
  protected readonly visibleKeys = computed(() =>
    resolveVisibleWidgets(this.capabilitiesStore.capabilities(), this.storedPreference())
  );
  protected readonly hiddenAllowedKeys = computed(() => {
    const visible = new Set(this.visibleKeys());
    return this.allowedKeys().filter((key) => !visible.has(key));
  });

  ngOnInit(): void {
    void this.capabilitiesStore.ensureLoaded();
  }

  togglePicker(): void {
    this.pickerOpen.update((open) => !open);
  }

  toggleWidget(key: MyTeamWidgetKey): void {
    const current = this.visibleKeys();
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    this.storedPreference.set(next);
    saveMyTeamWidgetPreference(next);
  }

  onDrop(event: CdkDragDrop<MyTeamWidgetKey[]>): void {
    const next = [...this.visibleKeys()];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.storedPreference.set(next);
    saveMyTeamWidgetPreference(next);
  }
}
