import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Dotted background for pannable canvases (Work Network, position hierarchy). Fills its nearest
 * positioned ancestor behind the content; a CSS gradient, so it costs nothing while panning.
 * Give the canvas `position: relative; isolation: isolate` so the grid paints above the canvas
 * background but below everything else in it.
 */
@Component({
  selector: 'app-canvas-grid',
  standalone: true,
  template: '',
  styles: [`
    :host {
      position: absolute; inset: 0; z-index: -1; pointer-events: none;
      background-image: radial-gradient(
        color-mix(in srgb, var(--color-text-secondary) 22%, transparent) 1.2px,
        transparent 1.2px
      );
    }
  `],
  host: {
    'aria-hidden': 'true',
    '[style.background-size]': 'spacing() + "px " + spacing() + "px"'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanvasGridComponent {
  /** Distance between dots, in CSS pixels. */
  readonly spacing = input(24);
}
