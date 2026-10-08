import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { MyTeamWidgetKey } from '../../models/my-team-widget-key.model';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamWidgetPreferenceService } from '../../state/my-team-widget-preference.service';
import { ActionCenterCardComponent } from '../action-center-card/action-center-card.component';
import { TeamProgressCardComponent } from '../team-progress-card/team-progress-card.component';
import { TeamStatusCardComponent } from '../team-status-card/team-status-card.component';

/**
 * One My Team widget placed inside a My Day column: slot N shows the viewer's Nth visible widget
 * (their saved order), so the three cards fill the space under the three columns. Renders nothing
 * unless My Team is available to the viewer and a widget is assigned to this slot - capability
 * gating is unchanged (My Team spec §5, AC-1).
 */
@Component({
  selector: 'app-my-team-slot',
  standalone: true,
  imports: [TeamStatusCardComponent, ActionCenterCardComponent, TeamProgressCardComponent],
  template: `
    @if (widget(); as key) {
      @switch (key) {
        @case ('teamStatus') {
          <app-team-status-card id="my-team-widget-teamStatus" class="block scroll-mt-4" />
        }
        @case ('actionCenter') {
          <app-action-center-card id="my-team-widget-actionCenter" class="block scroll-mt-4" />
        }
        @case ('teamProgress') {
          <app-team-progress-card id="my-team-widget-teamProgress" class="block scroll-mt-4" />
        }
      }
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTeamSlotComponent implements OnInit {
  /** Which visible widget (0-based, in the viewer's order) this slot shows. */
  readonly slot = input.required<number>();

  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);
  private readonly preference = inject(MyTeamWidgetPreferenceService);

  protected readonly widget = computed<MyTeamWidgetKey | null>(() => {
    if (!this.capabilitiesStore.capabilities()?.isAvailable) return null;
    return this.preference.visibleKeys()[this.slot()] ?? null;
  });

  ngOnInit(): void {
    void this.capabilitiesStore.ensureLoaded();
  }
}
