import { Component, input, output } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div class="flex gap-1" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          data-testid="tab"
          class="border-b-2 px-3 py-2 text-sm transition-colors"
          [attr.aria-selected]="tab.id === activeId()"
          [disabled]="tab.disabled ?? false"
          [class.border-[var(--color-accent)]]="tab.id === activeId()"
          [class.text-[var(--color-accent)]]="tab.id === activeId()"
          [class.font-semibold]="tab.id === activeId()"
          [class.border-transparent]="tab.id !== activeId()"
          [class.text-[var(--color-text-secondary)]]="tab.id !== activeId()"
          [class.opacity-40]="tab.disabled"
          [class.cursor-not-allowed]="tab.disabled"
          (click)="onTabClick(tab)"
        >{{ tab.label }}</button>
      }
    </div>
  `
})
export class TabsComponent {
  tabs = input.required<TabItem[]>();
  activeId = input<string | null>(null);
  tabChange = output<string>();

  onTabClick(tab: TabItem): void {
    if (tab.disabled) return;
    this.tabChange.emit(tab.id);
  }
}
