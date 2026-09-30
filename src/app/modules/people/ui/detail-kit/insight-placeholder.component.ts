import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmptyNoteComponent } from './empty-note.component';

/** Body of a period-insight card while its data is loading or unavailable. */
@Component({
  selector: 'app-insight-placeholder',
  standalone: true,
  imports: [EmptyNoteComponent],
  template: `
    @if (loading()) {
      <p class="loading" role="status">Loading…</p>
    } @else {
      <app-empty-note icon="info" title="No data yet" [description]="description()" />
    }
  `,
  styles: [`.loading { margin: 0; font-size: 0.875rem; color: var(--color-text-secondary); }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InsightPlaceholderComponent {
  readonly loading = input(false);
  readonly description = input('This summary will appear once the data is available for this employee.');
}
