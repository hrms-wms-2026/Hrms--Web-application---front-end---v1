import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { THEME_PRESETS, ThemePresetId } from '../../../core/theme/models/theme-preset.model';

export interface PreferenceTab {
  id: string;
  label: string;
  icon: 'palette' | 'bell' | 'user' | 'cog';
}

@Component({
  selector: 'app-preferences-modal',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open()" title="Preferences" (closed)="closed.emit()">
      <div class="preferences-container">
        <!-- Sidebar Navigation Tabs -->
        <nav class="preferences-sidebar" aria-label="Preferences categories">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              class="preferences-tab-btn"
              [class.preferences-tab-btn--active]="activeTabId() === tab.id"
              [attr.aria-selected]="activeTabId() === tab.id"
              (click)="selectTab(tab.id)"
            >
              @if (tab.icon === 'palette') {
                <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.2-1.5 4-3.5 4-1 0-1.5-.5-2-1-.4-.4-.8-.9-1.5-.9H12a2 2 0 0 0-2 2c0 2.5 2 3.9 2 5.9Z"/>
                  <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/>
                  <circle cx="12" cy="7.5" r="1.5" fill="currentColor"/>
                  <circle cx="16.5" cy="10.5" r="1.5" fill="currentColor"/>
                </svg>
              }
              <span>{{ tab.label }}</span>
            </button>
          }
        </nav>

        <!-- Right Content Panel -->
        <div class="preferences-content">
          @if (activeTabId() === 'appearance') {
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
          }
        </div>
      </div>
    </app-modal>
  `,
  styleUrl: './preferences-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly themeStore = inject(ThemeStore);

  readonly currentPreset = this.themeStore.preset;
  readonly themePresets = THEME_PRESETS;

  readonly activeTabId = signal<string>('appearance');

  readonly tabs: readonly PreferenceTab[] = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' }
  ];

  selectTab(id: string): void {
    this.activeTabId.set(id);
  }

  onSelectTheme(presetId: ThemePresetId): void {
    this.themeStore.setPreset(presetId);
  }
}
