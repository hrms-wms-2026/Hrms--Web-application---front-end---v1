/** Quiet Operations Desk: /time-off/team folds into the combined Balances page. */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-team-balances',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamBalancesComponent {
  constructor() {
    void inject(Router).navigate(['/time-off'], { queryParams: { view: 'team' }, replaceUrl: true });
  }
}
