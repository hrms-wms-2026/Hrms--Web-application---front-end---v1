import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';

/**
 * Carries Leaflet's stylesheet for the one screen that renders a map (office location picker).
 * It used to be imported in src/styles.css, which put ~15 kB into every page's initial bundle.
 * ViewEncapsulation.None is required: Leaflet builds its map DOM itself, so scoped
 * (emulated) selectors would never match it. The styles load with this lazy route only.
 */
@Component({
  selector: 'app-leaflet-styles',
  standalone: true,
  template: '',
  styleUrl: './leaflet-styles.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeafletStylesComponent {}
