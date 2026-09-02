import { Component, input, output } from '@angular/core';

export interface TabOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div role="tablist" class="flex gap-1" [attr.aria-label]="ariaLabel()">
      @for (tab of tabs(); track tab.value) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab.value === value()"
          [class.app-tabs__tab--active]="tab.value === value()"
          (click)="valueChange.emit(tab.value)"
        >{{ tab.label }}</button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    [role='tablist'] { border-bottom: 1px solid var(--color-border); }
    [role='tab'] {
      border: 0;
      border-bottom: 2px solid transparent;
      border-radius: 6px 6px 0 0;
      padding: 7px 10px;
      background: transparent;
      color: var(--color-text-secondary);
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    [role='tab']:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    [role='tab']:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    [role='tab'].app-tabs__tab--active {
      border-bottom-color: var(--color-accent);
      color: var(--color-accent);
      font-weight: 600;
    }
  `]
})
export class TabsComponent {
  tabs = input<readonly TabOption[]>([]);
  value = input('');
  ariaLabel = input('Tabs');
  valueChange = output<string>();
}
