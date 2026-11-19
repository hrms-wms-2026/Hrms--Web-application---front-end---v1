import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { THEME_PRESETS, ThemePresetId } from '../../../core/theme/models/theme-preset.model';
import { THEME_MODES, ThemeMode } from '../../../core/theme/models/theme-mode.model';

@Component({
  selector: 'app-appearance-panel',
  standalone: true,
  template: `
    <section class="preference-section" aria-labelledby="appearance-heading">
      <div class="section-header">
        <p class="section-description">
          Customize the look and feel of your application workspace.
        </p>
      </div>

      <div class="theme-presets-container">
        <span class="preset-group-label">Mode</span>
        <div class="mode-segmented" role="radiogroup" aria-label="Colour mode">
          @for (option of themeModes; track option.id) {
            <button
              type="button"
              role="radio"
              class="mode-option"
              [class.mode-option--selected]="currentMode() === option.id"
              [attr.aria-checked]="currentMode() === option.id"
              [attr.data-mode-option]="option.id"
              (click)="onSelectMode(option.id)"
            >
              <svg class="mode-option__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                @switch (option.id) {
                  @case ('light') {
                    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                  }
                  @case ('dark') {
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  }
                  @default {
                    <rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>
                  }
                }
              </svg>
              <span>{{ option.label }}</span>
            </button>
          }
        </div>
        @if (currentMode() === 'system') {
          <p class="mode-hint">Follows your device setting. Currently {{ resolvedMode() === 'dark' ? 'dark' : 'light' }}.</p>
        }
      </div>

      <div class="theme-presets-container">
        <span class="preset-group-label">Theme Presets</span>
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
  readonly currentMode = this.themeStore.mode;
  readonly resolvedMode = this.themeStore.resolvedMode;
  readonly themePresets = THEME_PRESETS;
  readonly themeModes = THEME_MODES;

  onSelectTheme(presetId: ThemePresetId): void {
    this.themeStore.setPreset(presetId);
  }

  onSelectMode(mode: ThemeMode): void {
    this.themeStore.setMode(mode);
  }
}
