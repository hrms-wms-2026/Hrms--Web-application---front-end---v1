import { Component, computed, input, output } from '@angular/core';
import { DropdownMenuComponent, MenuItem } from '../dropdown-menu/dropdown-menu.component';

export interface BulkAction {
  id: string;
  label: string;
  /** SVG path data for a 24x24 stroke icon. */
  iconPath?: string;
  placement: 'primary' | 'more';
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Floating bottom-center toolbar shown while rows are selected. Has no permission
 * logic: the host passes only the actions the user may perform.
 */
@Component({
  selector: 'app-bulk-action-bar',
  standalone: true,
  imports: [DropdownMenuComponent],
  template: `
    @if (count() > 0) {
      <div class="bulk-bar" role="toolbar" aria-label="Bulk actions" data-testid="bulk-action-bar" (keydown.escape)="cleared.emit()">
        <span class="bulk-bar__count" aria-live="polite">
          <svg class="bulk-bar__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
          {{ label() }}
        </span>
        <span class="bulk-bar__sep" aria-hidden="true"></span>
        <div class="bulk-bar__projected-controls">
          <ng-content select="[bulk-action-controls]" />
        </div>
        @for (item of primaryActions(); track item.id) {
          <button
            type="button"
            class="bulk-bar__action"
            [class.bulk-bar__action--danger]="item.danger"
            [disabled]="item.disabled"
            [attr.title]="item.disabled ? (item.disabledReason ?? null) : null"
            [attr.data-testid]="'bulk-action-' + item.id"
            (click)="action.emit(item.id)"
          >
            @if (item.iconPath) {
              <svg class="bulk-bar__icon" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.iconPath" /></svg>
            }
            {{ item.label }}
          </button>
        }
        @if (moreItems().length > 0) {
          <app-dropdown-menu [items]="moreItems()" align="left" direction="up" ariaLabel="More bulk actions" (selected)="action.emit($event)">
            <button menu-trigger type="button" class="bulk-bar__action" data-testid="bulk-action-more">
              More
              <svg class="bulk-bar__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </app-dropdown-menu>
        }
        <button type="button" class="bulk-bar__clear" aria-label="Clear selection" title="Clear selection" data-testid="bulk-action-clear" (click)="cleared.emit()">
          <svg class="bulk-bar__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    }
  `,
  styleUrl: './bulk-action-bar.component.css'
})
export class BulkActionBarComponent {
  count = input.required<number>();
  actions = input.required<BulkAction[]>();
  noun = input<string>('item');
  action = output<string>();
  cleared = output<void>();

  protected readonly label = computed(() => {
    const n = this.count();
    return `${n} ${this.noun()}${n === 1 ? '' : 's'} selected`;
  });

  protected readonly primaryActions = computed(() => this.actions().filter((a) => a.placement === 'primary'));

  protected readonly moreItems = computed<MenuItem[]>(() =>
    this.actions()
      .filter((a) => a.placement === 'more')
      .map((a) => ({ id: a.id, label: a.label, iconPath: a.iconPath, danger: a.danger, disabled: a.disabled }))
  );
}
