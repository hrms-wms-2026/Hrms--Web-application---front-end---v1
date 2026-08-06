import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs/operators';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

/**
 * Minimal stand-in for nav targets that don't have a real screen yet (Part 2A app-shell
 * scope only). Reads its title from route data so one component covers every unbuilt
 * section - deliberately does not fake completed functionality.
 */
@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header [title]="title()" />
    <app-empty-state title="Not built yet" description="This section is part of the app shell; its screen hasn't been implemented yet." />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title = toSignal(this.route.data.pipe(map((data) => (data['title'] as string | undefined) ?? 'Coming soon')), {
    initialValue: (this.route.snapshot.data['title'] as string | undefined) ?? 'Coming soon'
  });
}
