/**
 * Spec helpers for app-select. Its open list renders in the CDK overlay container (outside the
 * fixture), so options are looked up on the document. Pass the fixture's detectChanges so the
 * overlay renders between steps.
 */

/** The trigger button of the app-select at or inside `host`. */
export function selectTrigger(host: Element): HTMLButtonElement {
  const trigger = host.querySelector<HTMLButtonElement>('[data-testid="select-trigger"]');
  if (!trigger) throw new Error('app-select trigger not found');
  return trigger;
}

/** Text currently shown on the trigger (the selected label, or the placeholder). */
export function selectDisplayText(host: Element): string {
  return selectTrigger(host).textContent?.trim() ?? '';
}

/** Option buttons of the currently open list. */
export function openSelectOptions(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="select-option"]'));
}

/** Opens the list of the app-select at or inside `host`. */
export function openSelect(host: Element, detectChanges: () => void): HTMLButtonElement[] {
  selectTrigger(host).click();
  detectChanges();
  return openSelectOptions();
}

/** Opens the app-select at or inside `host` and clicks the option whose label matches. */
export function pickSelectOption(host: Element, label: string, detectChanges: () => void): void {
  const option = openSelect(host, detectChanges).find((o) => o.textContent?.trim() === label);
  if (!option) throw new Error(`app-select option "${label}" not found`);
  option.click();
  detectChanges();
}
