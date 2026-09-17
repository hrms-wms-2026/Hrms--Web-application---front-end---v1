import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-color-swatch-popover',
  standalone: true,
  template: `
    <div class="csp-popover" role="dialog" (click)="$event.stopPropagation()">
      <button type="button" class="csp-remove" (mousedown)="$event.preventDefault()" (click)="colorSelected.emit(null)">{{ label() }}</button>
      <div class="csp-grid">
        @for (swatch of swatches(); track swatch.hex) {
          <button
            type="button"
            class="csp-swatch"
            [style.background]="swatch.hex"
            [title]="swatch.name"
            (mousedown)="$event.preventDefault()"
            (click)="colorSelected.emit(swatch.hex)"
          ></button>
        }
      </div>
    </div>
  `,
  styles: [`
    .csp-popover { position: absolute; z-index: 20; margin-top: 4px; padding: 8px; border-radius: 8px; background: var(--color-surface); box-shadow: 0 8px 24px rgb(15 23 42 / .18); border: 1px solid var(--color-border); }
    .csp-remove { display: block; width: 100%; text-align: left; padding: 4px 6px; margin-bottom: 6px; border: none; background: none; cursor: pointer; font-size: 12px; color: var(--color-text-muted, #64748b); }
    .csp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .csp-swatch { width: 20px; height: 20px; border-radius: 4px; border: 1px solid rgb(0 0 0 / .1); cursor: pointer; padding: 0; }
  `]
})
export class ColorSwatchPopoverComponent {
  label = input.required<string>();
  swatches = input.required<{ name: string; hex: string }[]>();
  colorSelected = output<string | null>();
}
