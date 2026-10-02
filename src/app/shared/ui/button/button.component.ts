import { Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md';

@Component({
  selector: 'app-button',
  standalone: true,
  host: {
    class: 'inline-block align-middle',
    '[class.w-full]': 'fullWidth()'
  },
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="classes()"
      (click)="pressed.emit($event)"
    >
      @if (loading()) {
        <span class="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/40 border-t-current"></span>
      }
      <ng-content />
    </button>
  `
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  type = input<'button' | 'submit'>('button');
  fullWidth = input(false);
  disabled = input(false);
  loading = input(false);
  pressed = output<MouseEvent>();

  classes(): string {
    const base =
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';
    const width = this.fullWidth() ? 'w-full' : 'w-auto';
    const sizes: Record<ButtonSize, string> = {
      md: 'h-[30px] px-3 text-[13px] leading-none',
      sm: 'h-[26px] px-2.5 text-xs leading-none'
    };
    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)] hover:bg-[var(--color-accent-hover)]',
      secondary:
        'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]',
      danger:
        'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
    };
    return `${base} ${width} ${sizes[this.size()]} ${variants[this.variant()]}`;
  }
}
