import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

export type ModalSize = 'md' | 'lg' | 'xl' | '2xl';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[1200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="onBackdropClick()"></div>
        <div
          #dialog
          [class]="dialogClass()"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-labelledby]="title() ? titleId : null"
          (keydown.escape)="closed.emit()"
        >
          <div class="mb-4 flex items-start justify-between gap-4">
            @if (title()) {
              <h2 [id]="titleId" class="text-lg font-semibold text-[var(--color-text-primary)]">{{ title() }}</h2>
            }
            <button
              type="button"
              class="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              aria-label="Close"
              (click)="closed.emit()"
            >
              &#x2715;
            </button>
          </div>
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: `
    .modal-dialog--xl {
      max-height: 85vh;
      overflow: hidden;
    }
  `
})
export class ModalComponent {
  open = input(false);
  title = input<string>('');
  size = input<ModalSize>('md');
  closeOnBackdropClick = input(true);
  closed = output<void>();

  readonly dialogClass = computed(() => {
    const sizeMap: Record<ModalSize, string> = {
      md: 'relative z-10 w-full max-w-md rounded-xl bg-[var(--color-surface)] p-6 shadow-lg outline-none',
      lg: 'relative z-10 w-full max-w-xl rounded-xl bg-[var(--color-surface)] p-6 shadow-lg outline-none',
      xl: 'relative z-10 w-full max-w-5xl rounded-xl bg-[var(--color-surface)] p-8 shadow-lg outline-none modal-dialog--xl',
      '2xl': 'relative z-10 w-full max-w-6xl rounded-xl bg-[var(--color-surface)] p-8 shadow-lg outline-none modal-dialog--xl',
    };
    return sizeMap[this.size()];
  });

  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('dialog');
  readonly titleId = nextUniqueId('app-modal-title');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.dialogRef()?.nativeElement.focus();
      }
    });
  }

  onBackdropClick(): void {
    if (this.closeOnBackdropClick()) {
      this.closed.emit();
    }
  }
}
