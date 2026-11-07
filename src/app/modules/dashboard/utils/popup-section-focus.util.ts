import { DestroyRef, Signal, effect, inject } from '@angular/core';

/**
 * A dashboard popup opened from a summary card scrolls to the section that card summarises: the element marked
 * `data-section="<id>"`. Call from the dialog's constructor with its open and focusSection inputs. The scroll waits a
 * tick so the opened popup's content is rendered first.
 */
export function injectPopupSectionFocus(open: Signal<boolean>, section: Signal<string | null>): void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  effect(() => {
    const id = section();
    cancel();
    if (!open() || !id) return;
    timer = setTimeout(() => {
      timer = null;
      const target = [...document.querySelectorAll('[data-section]')].find((el) => el.getAttribute('data-section') === id);
      target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  });
  inject(DestroyRef).onDestroy(cancel);
}
