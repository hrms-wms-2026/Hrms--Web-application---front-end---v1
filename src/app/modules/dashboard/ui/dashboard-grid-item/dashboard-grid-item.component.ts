import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DashboardCardSize } from '../../utils/dashboard-layout.util';

/**
 * One cell of the dashboard's 4-column grid, in one of two sizes: `small` spans 1 column, `large`
 * spans 2 (2 Small = 1 Large). On the 2-column (md) grid Large still fills the row; on phones every
 * card is full width. It is also a size container, so the card inside lays itself out by its own
 * width (`@sm:` / `@md:` utilities) rather than by the viewport's. On wide screens the card is
 * stretched to its row's fixed height and scrolls inside.
 */
@Component({
  selector: 'app-dashboard-grid-item',
  standalone: true,
  template: `<ng-content />`,
  // Wide screens give every grid row a fixed height (dashboard-home .dashboard-grid). The card then
  // fills its cell and anything taller scrolls inside the card, so the row never grows past the screen.
  styles: `
    @media (min-width: 80rem) {
      :host { display: flex; flex-direction: column; min-height: 0; }
      :host ::ng-deep > app-dashboard-card > * { display: flex; flex: 1 1 0%; flex-direction: column; min-height: 0; }
      :host ::ng-deep > app-dashboard-card > * > section,
      :host ::ng-deep > app-dashboard-card > * > app-popout-panel { flex: 1 1 0%; min-height: 0; }
      :host ::ng-deep > app-dashboard-card > * > section,
      :host ::ng-deep > app-dashboard-card > * > app-popout-panel > .popout-panel:not(.popout-panel--open) > section {
        overflow-y: auto;
        scrollbar-width: thin;
      }
    }
  `,
  host: {
    class: '@container block min-w-0',
    '[class.md:col-span-2]': "size() === 'large'",
    '[attr.data-size]': 'size()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardGridItemComponent {
  readonly size = input.required<DashboardCardSize>();
}
