import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';

/**
 * Minimal placeholder shell for Positions management route (/organization/positions).
 * Position CRUD and hierarchy features will be built in Part 2G.
 */
@Component({
  selector: 'app-positions-placeholder',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Positions" subtitle="Manage organizational positions and headcount limits." />
    <app-empty-state
      title="Position Management"
      description="Position management and occupancy features will be connected in subsequent implementation phases."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PositionsPlaceholderComponent {}
