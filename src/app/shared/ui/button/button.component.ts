import { Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="classes()"
      (click)="pressed.emit($event)"
    >
      @if (loading()) {
        <span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent-contrast)]/40 border-t-[var(--color-accent-contrast)]"></span>
      }
      <ng-content />
    </button>
  `
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  type = input<'button' | 'submit'>('button');
  disabled = input(false);
  loading = input(false);
  pressed = output<MouseEvent>();

  classes(): string {
    const base =
      'inline-flex w-full items-center justify-center rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]';
    const sizes: Record<ButtonSize, string> = {
      md: 'px-4 py-2 text-sm',
      sm: 'px-2.5 py-1.5 text-xs'
    };
    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-[var(--color-accent)] text-[var(--color-accent-contrast)] hover:bg-[var(--color-accent-hover)]',
      secondary:
        'bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)]',
      danger:
        'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
    };
    return `${base} ${sizes[this.size()]} ${variants[this.variant()]}`;
  }
}
