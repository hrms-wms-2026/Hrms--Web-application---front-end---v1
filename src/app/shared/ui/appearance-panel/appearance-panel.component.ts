import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { THEME_PRESETS, ThemePresetId } from '../../../core/theme/models/theme-preset.model';

@Component({
  selector: 'app-appearance-panel',
  standalone: true,
  template: `
    <section class="preference-section" aria-labelledby="appearance-heading">
      <div class="section-header">
        <h3 id="appearance-heading" class="section-title">Appearance</h3>
        <p class="section-description">
          Customize the look and feel of your application workspace.
        </p>
      </div>

      <div class="theme-presets-container">
        <label class="preset-group-label">Theme Presets</label>
        <div class="theme-presets-grid" role="radiogroup" aria-label="Theme Presets">
          @for (preset of themePresets; track preset.id) {
            <button
              type="button"
              role="radio"
              class="preset-card"
              [class.preset-card--selected]="currentPreset() === preset.id"
              [attr.aria-checked]="currentPreset() === preset.id"
              (click)="onSelectTheme(preset.id)"
            >
              <div class="preset-swatch-wrapper">
                <span class="preset-swatch" [attr.data-preset]="preset.id"></span>
              </div>
              <div class="preset-info">
                <span class="preset-name">{{ preset.label }}</span>
              </div>
              @if (currentPreset() === preset.id) {
                <svg class="preset-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            </button>
          }
        </div>
      </div>
    </section>
  `,
  styleUrl: './appearance-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppearancePanelComponent {
  private readonly themeStore = inject(ThemeStore);

  readonly currentPreset = this.themeStore.preset;
  readonly themePresets = THEME_PRESETS;

  onSelectTheme(presetId: ThemePresetId): void {
    this.themeStore.setPreset(presetId);
  }
}
