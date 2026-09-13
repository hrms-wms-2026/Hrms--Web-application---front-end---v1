import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';

export interface WorkDropdownOption {
  value: string;
  label: string;
}

export type WorkDropdownIcon = 'module' | 'status' | 'category' | 'sprint' | 'people' | 'filter';

export type WorkDropdownSize = 'md' | 'sm';

@Component({
  selector: 'app-work-dropdown',
  standalone: true,
  template: `
    <div class="work-dropdown" [class.work-dropdown--full]="fullWidth()">
      @if (fieldLabel()) {
        <label class="work-dropdown__label" [attr.for]="controlId">{{ fieldLabel() }}</label>
      }
      <div class="work-dropdown__control">
        <button
          [id]="controlId"
          type="button"
          class="work-dropdown__trigger"
          [class.work-dropdown__trigger--sm]="size() === 'sm'"
          [class.work-dropdown__trigger--active]="multiple() && values().length > 0"
          [attr.aria-expanded]="open()"
          aria-haspopup="listbox"
          [attr.aria-label]="accessibleLabel() || fieldLabel() || triggerLabel()"
          [attr.aria-invalid]="error() ? 'true' : null"
          (click)="toggle($event)"
          (keydown)="onTriggerKeydown($event)"
        >
          @switch (leadingIcon()) {
            @case ('module') { <svg class="work-dropdown__leading-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></svg> }
            @case ('status') { <svg class="work-dropdown__leading-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg> }
            @case ('category') { <svg class="work-dropdown__leading-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg> }
            @case ('sprint') { <svg class="work-dropdown__leading-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></svg> }
            @case ('people') { <svg class="work-dropdown__leading-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M4 20c0-3 2.5-5 5-5s5 2 5 5" /><path d="M15 7a3 3 0 0 1 0 6M20 20c0-2.5-1.7-4.3-4-4.8" /></svg> }
            @default { <svg class="work-dropdown__leading-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18M6 7v10M18 7v10M9 17h6" /></svg> }
          }
          <span class="work-dropdown__value">{{ triggerLabel() }}</span>
          <svg class="work-dropdown__chevron" [class.work-dropdown__chevron--open]="open()" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        @if (error()) { <span class="work-dropdown__error" role="alert">{{ error() }}</span> }
        @if (open()) {
          <div class="work-dropdown__menu" role="listbox" [attr.aria-multiselectable]="multiple() ? 'true' : null" [attr.aria-label]="accessibleLabel() || fieldLabel() || 'Options'">
            @if (multiple() && values().length > 0) {
              <button type="button" class="work-dropdown__clear" (click)="clearValues($event)">Clear</button>
            }
            @for (option of options(); track option.value; let index = $index) {
              <button
                type="button"
                class="work-dropdown__option"
                [class.work-dropdown__option--selected]="isSelected(option.value)"
                [class.work-dropdown__option--active]="index === activeIndex()"
                role="option"
                [attr.aria-selected]="isSelected(option.value)"
                (mouseenter)="activeIndex.set(index)"
                (click)="onOptionClick(option.value, $event)"
              >
                @if (multiple()) {
                  <span class="work-dropdown__checkbox" [class.work-dropdown__checkbox--on]="isSelected(option.value)" aria-hidden="true">@if (isSelected(option.value)) { <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg> }</span>
                } @else {
                  <span class="work-dropdown__option-marker" aria-hidden="true">@if (isSelected(option.value)) { <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg> }</span>
                }
                <span class="work-dropdown__option-label">{{ option.label }}</span>
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; min-width: 0; }
    .work-dropdown { display: flex; min-width: 180px; flex-direction: column; gap: 5px; }
    .work-dropdown--full { width: 100%; }
    .work-dropdown__label { color: var(--color-text-secondary); font-size: 12px; font-weight: 500; line-height: 1.2; }
    .work-dropdown__control { position: relative; min-width: 0; }
    .work-dropdown__error { display: block; margin-top: 3px; color: var(--color-danger-text, var(--color-danger)); font-size: 11px; line-height: 1.3; }
    .work-dropdown__trigger { display: inline-flex; width: 100%; height: 44px; align-items: center; gap: 9px; border: 1px solid var(--color-border); border-radius: 9px; padding: 0 12px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 14px; font-weight: 500; text-align: left; cursor: pointer; box-shadow: 0 1px 2px rgb(15 23 42 / .04); transition: border-color 160ms ease, box-shadow 160ms ease; }
    .work-dropdown__trigger--sm { height: 30px; gap: 7px; border-radius: 8px; padding: 0 10px; font-size: 13px; }
    .work-dropdown__trigger--sm .work-dropdown__leading-icon, .work-dropdown__trigger--sm .work-dropdown__chevron { width: 15px; height: 15px; }
    .work-dropdown__trigger:hover, .work-dropdown__trigger[aria-expanded="true"] { border-color: var(--color-accent); }
    .work-dropdown__trigger--active { border-color: var(--color-accent); color: var(--color-accent); }
    .work-dropdown__trigger--active .work-dropdown__chevron { stroke: var(--color-accent); }
    .work-dropdown__trigger[aria-invalid="true"] { border-color: var(--color-danger); }
    .work-dropdown__trigger:focus-visible, .work-dropdown__option:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .work-dropdown__leading-icon { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: var(--color-accent); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .work-dropdown__value { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .work-dropdown__chevron { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform 160ms ease; }
    .work-dropdown__chevron--open { transform: rotate(180deg); }
    .work-dropdown__menu { position: absolute; left: 0; right: 0; top: calc(100% + 7px); z-index: 60; max-height: 16rem; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 10px; padding: 6px; background: var(--color-surface); box-shadow: 0 14px 30px rgb(15 23 42 / .14); animation: work-dropdown-menu-in 140ms ease-out; }
    .work-dropdown__clear { display: block; width: 100%; margin-bottom: 2px; border: 0; border-radius: 6px; padding: 5px 9px; background: transparent; color: var(--color-accent); font: inherit; font-size: 11px; font-weight: 600; text-align: left; cursor: pointer; }
    .work-dropdown__clear:hover { background: var(--color-surface-secondary); }
    .work-dropdown__option { display: flex; width: 100%; min-height: 36px; align-items: center; gap: 8px; border: 0; border-radius: 7px; padding: 7px 9px; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; }
    .work-dropdown__option:hover, .work-dropdown__option--active { background: var(--color-surface-secondary); }
    .work-dropdown__option--selected { background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); font-weight: 600; }
    .work-dropdown__option-marker { display: inline-flex; width: 15px; height: 15px; flex: 0 0 auto; align-items: center; justify-content: center; color: var(--color-accent); }
    .work-dropdown__option-marker svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .work-dropdown__checkbox { display: inline-flex; width: 15px; height: 15px; flex: 0 0 auto; box-sizing: border-box; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); }
    .work-dropdown__checkbox--on { border-color: var(--color-accent); background: var(--color-accent); }
    .work-dropdown__checkbox svg { width: 11px; height: 11px; fill: none; stroke: var(--color-accent-contrast); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .work-dropdown__option-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @keyframes work-dropdown-menu-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .work-dropdown__menu, .work-dropdown__chevron { animation: none; transition: none; } }
  `]
})
export class WorkDropdownComponent {
  options = input.required<readonly WorkDropdownOption[]>();
  selected = input<string>('');
  fieldLabel = input<string>('');
  accessibleLabel = input<string>('');
  placeholder = input<string>('Select');
  error = input<string>('');
  leadingIcon = input<WorkDropdownIcon>('filter');
  fullWidth = input(false);
  size = input<WorkDropdownSize>('md');

  multiple = input(false);
  values = input<readonly string[]>([]);
  allLabel = input<string>('');

  selectionChanged = output<string>();
  valuesChanged = output<string[]>();
  open = signal(false);
  activeIndex = signal(0);
  readonly controlId = `work-dropdown-${Math.random().toString(36).slice(2, 9)}`;
  readonly selectedLabel = computed(() => {
    const selectedLabel = this.options().find((option) => option.value === this.selected())?.label;
    return selectedLabel ?? (this.placeholder() || this.options()[0]?.label || 'Select');
  });
  readonly triggerLabel = computed(() => {
    if (!this.multiple()) return this.selectedLabel();
    const count = this.values().length;
    if (count === 0) return this.allLabel() || this.placeholder() || this.options()[0]?.label || 'All';
    return `${count} selected`;
  });
  private readonly host = inject(ElementRef<HTMLElement>);

  isSelected(value: string): boolean {
    return this.multiple() ? this.values().includes(value) : value === this.selected();
  }

  toggle(event: Event): void { event.stopPropagation(); this.open.update((value) => !value); if (this.open()) this.syncActiveIndex(); }

  onOptionClick(value: string, event: Event): void {
    if (this.multiple()) { this.toggleValue(value); return; }
    this.select(value, event);
  }

  select(value: string, event: Event): void { event.stopPropagation(); this.open.set(false); this.selectionChanged.emit(value); }

  toggleValue(value: string): void {
    const current = this.values();
    const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    this.valuesChanged.emit(next);
  }

  clearValues(event?: Event): void { event?.stopPropagation(); this.valuesChanged.emit([]); }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { this.open.set(false); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.open.update((value) => !value); if (this.open()) this.syncActiveIndex(); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!this.open()) this.open.set(true);
    const count = this.options().length;
    if (count === 0) return;
    const next = this.activeIndex() + (event.key === 'ArrowDown' ? 1 : -1);
    this.activeIndex.set((next + count) % count);
  }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void { if (!this.host.nativeElement.contains(event.target as Node)) this.open.set(false); }
  private syncActiveIndex(): void {
    const reference = this.multiple() ? this.values()[0] : this.selected();
    const index = this.options().findIndex((option) => option.value === reference);
    this.activeIndex.set(index >= 0 ? index : 0);
  }
}
