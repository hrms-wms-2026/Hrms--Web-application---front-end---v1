import { Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-color-swatch-picker',
  standalone: true,
  template: `
    <span data-testid="color-field" class="flex items-center gap-2 flex-wrap">
      @for (preset of presets(); track preset.value) {
        <button
          type="button"
          class="proj-color-swatch"
          [class.proj-color-swatch--active]="
            selected().toLowerCase() === preset.value.toLowerCase() && !showCustom()
          "
          [style.background]="preset.value"
          [title]="preset.label"
          [attr.aria-label]="preset.label"
          [attr.aria-pressed]="selected().toLowerCase() === preset.value.toLowerCase()"
          (click)="selectPreset(preset.value)"
        ></button>
      }
      <div class="relative flex items-center">
        <button
          type="button"
          class="proj-color-swatch proj-color-swatch--custom"
          [class.proj-color-swatch--active]="showCustom()"
          title="Custom color"
          aria-label="Custom color"
          (click)="toggleCustom()"
        >
          <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </button>
        @if (showCustom()) {
          <input
            type="color"
            class="proj-color-native"
            [value]="selected() || '#2563eb'"
            (input)="emitColor($any($event.target).value)"
            title="Pick a custom color"
          />
        }
      </div>
      @if (selected()) {
        <div class="flex items-center gap-1 ml-1">
          <div
            class="h-4 w-4 rounded-full border border-[var(--color-border)] shrink-0"
            [style.background]="selected()"
          ></div>
          <span class="text-[10px] font-mono text-[var(--color-text-secondary)]">{{
            selected()
          }}</span>
        </div>
      }
    </span>
  `,
  styles: [
    `
      .proj-color-swatch {
        width: 1.625rem;
        height: 1.625rem;
        border-radius: 6px;
        border: 2px solid transparent;
        cursor: pointer;
        transition:
          border-color 120ms ease,
          transform 120ms ease,
          box-shadow 120ms ease;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .proj-color-swatch:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
      }
      .proj-color-swatch--active {
        border-color: var(--color-text-primary) !important;
        box-shadow:
          0 0 0 2px var(--color-surface),
          0 0 0 4px var(--color-text-primary);
      }
      .proj-color-swatch--custom {
        background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
        color: white;
      }
      .proj-color-native {
        position: absolute;
        left: calc(100% + 0.375rem);
        top: 50%;
        transform: translateY(-50%);
        width: 2rem;
        height: 2rem;
        border-radius: 6px;
        border: 1px solid var(--color-border);
        padding: 0;
        cursor: pointer;
        background: none;
        z-index: 10;
      }
      .proj-color-native::-webkit-color-swatch-wrapper {
        padding: 0;
        border-radius: 4px;
      }
      .proj-color-native::-webkit-color-swatch {
        border: none;
        border-radius: 4px;
      }
    `,
  ],
})
export class ColorSwatchPickerComponent {
  presets = input.required<{ value: string; label: string }[]>();
  selected = input<string>('');
  colorChange = output<string>();
  protected readonly showCustom = signal(false);
  selectPreset(value: string): void {
    this.showCustom.set(false);
    this.colorChange.emit(value);
  }
  toggleCustom(): void {
    this.showCustom.update((value) => !value);
  }
  emitColor(value: string): void {
    this.colorChange.emit(value);
  }
}
