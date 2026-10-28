import { Directive } from '@angular/core';

/**
 * Stops clicks inside the host from reaching ancestors, e.g. so clicking inside a popover or menu
 * does not trigger the parent's "click outside closes it" handler.
 *
 * Use this instead of `(click)="$event.stopPropagation()"`: that binding makes the template look like
 * an interactive element to the accessibility lint rules, when it only shields its children.
 */
@Directive({
  selector: '[appStopClickPropagation]',
  host: { '(click)': '$event.stopPropagation()' }
})
export class StopClickPropagationDirective {}
