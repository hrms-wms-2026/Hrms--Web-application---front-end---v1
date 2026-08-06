import { Component, ElementRef, HostListener, inject, input, output } from '@angular/core';

/**
 * Generic anchored panel: host wraps both the [popover-trigger] and [popover-panel]
 * projected content so outside-click detection (and the click that opens it) both work
 * correctly. Open/close state is owned by the caller (ProfileMenuComponent today);
 * this component only renders the panel and reports when it should close.
 */
@Component({
  selector: 'app-popover',
  standalone: true,
  host: { class: 'app-popover' },
  template: `
    <ng-content select="[popover-trigger]" />
    @if (open()) {
      <div
        class="app-popover__panel"
        [class.app-popover__panel--align-left]="align() === 'left'"
        role="menu"
        [attr.aria-label]="ariaLabel() || null"
      >
        <ng-content select="[popover-panel]" />
      </div>
    }
  `,
  styleUrl: './popover.component.css'
})
export class PopoverComponent {
  open = input(false);
  ariaLabel = input<string>('');
  align = input<'left' | 'right'>('right');
  closed = output<void>();

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) {
      return;
    }
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closed.emit();
    }
  }
}
