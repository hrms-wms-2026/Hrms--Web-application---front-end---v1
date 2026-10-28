import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Makes a clickable non-button element (card, row, tab) activate with Enter or Space, the way a native
 * <button> does, by firing the host's own click handler. Pair it with role="button" and tabindex="0".
 *
 * Only keys pressed on the host itself count: Enter in an input or a nested button inside a card
 * must not also open the card.
 */
@Directive({
  selector: '[appKeyboardClick]',
  host: { '(keydown)': 'onKeydown($event)' }
})
export class KeyboardClickDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected onKeydown(event: KeyboardEvent): void {
    if (event.target !== this.host.nativeElement || event.repeat) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.host.nativeElement.click();
  }
}
