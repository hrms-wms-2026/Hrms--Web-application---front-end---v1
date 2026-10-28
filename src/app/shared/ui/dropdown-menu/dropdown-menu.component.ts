import { Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { PopoverComponent } from '../popover/popover.component';
import { StopClickPropagationDirective } from '../../directives/stop-click-propagation.directive';
import { KeyboardClickDirective } from '../../directives/keyboard-click.directive';

export interface MenuItem {
  id: string;
  label: string;
  /** SVG path data for a 24x24 stroke icon. */
  iconPath?: string;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
}

// Only one menu may be open app-wide: trigger clicks stop propagation (so a "⋯" inside a
// clickable row doesn't open the row), which also stops app-popover's document-click close
// from reaching other open menus - so opening one menu closes the rest here instead.
const openMenu = signal<DropdownMenuComponent | null>(null);

/**
 * Action menu anchored to a projected [menu-trigger] element. Owns its open state,
 * unlike app-popover. Used for bulk-bar "More" and per-row "⋯" menus.
 */
@Component({
  selector: 'app-dropdown-menu',
  standalone: true,
  imports: [KeyboardClickDirective, StopClickPropagationDirective, PopoverComponent],
  host: {
    class: 'dropdown-menu',
    '[class.dropdown-menu--up]': "direction() === 'up' || flipped()"
  },
  template: `
    <app-popover [open]="isOpen()" [align]="align()" [ariaLabel]="ariaLabel()" (closed)="close()">
      <span role="button" tabindex="0" appKeyboardClick popover-trigger #trigger class="dropdown-menu__trigger" (click)="onTriggerClick($event)">
        <ng-content select="[menu-trigger]" />
      </span>
      <div tabindex="-1" popover-panel #panel class="dropdown-menu__panel" (keydown)="onKeydown($event)" appStopClickPropagation>
        @for (item of items(); track item.id) {
          @if (item.dividerBefore) {
            <div class="dropdown-menu__divider" role="separator"></div>
          }
          <button
            type="button"
            role="menuitem"
            class="dropdown-menu__item"
            [class.dropdown-menu__item--danger]="item.danger"
            [disabled]="item.disabled"
            [attr.data-testid]="'menu-item-' + item.id"
            (click)="choose(item)"
          >
            @if (item.iconPath) {
              <svg class="dropdown-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.iconPath" /></svg>
            }
            <span>{{ item.label }}</span>
          </button>
        }
      </div>
    </app-popover>
  `,
  styleUrl: './dropdown-menu.component.css'
})
export class DropdownMenuComponent implements OnDestroy {
  items = input.required<MenuItem[]>();
  align = input<'left' | 'right'>('right');
  direction = input<'down' | 'up'>('down');
  ariaLabel = input<string>('Menu');
  selected = output<string>();

  protected readonly isOpen = computed(() => openMenu() === this);
  /** A "down" menu that would be cut off at the bottom of its scroll area (or the window) opens upwards instead. */
  protected readonly flipped = signal(false);

  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly injector = inject(Injector);

  protected onTriggerClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.close();
      return;
    }
    this.flipped.set(false);
    openMenu.set(this);
    afterNextRender(() => {
      if (this.direction() === 'down') this.flipped.set(this.cutOffBelow());
      this.enabledItems()[0]?.focus({ preventScroll: true });
    }, { injector: this.injector });
  }

  /** The open panel runs past the bottom of the nearest scrolling ancestor (or the window) and there is more room above. */
  private cutOffBelow(): boolean {
    const trigger = this.trigger().nativeElement.getBoundingClientRect();
    const panel = this.panel().nativeElement.getBoundingClientRect();
    let top = 0;
    let bottom = window.innerHeight;
    for (let el = this.trigger().nativeElement.parentElement; el; el = el.parentElement) {
      if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(el).overflowY)) {
        const box = el.getBoundingClientRect();
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
        break;
      }
    }
    return panel.bottom > bottom && trigger.top - top > bottom - trigger.bottom;
  }

  protected choose(item: MenuItem): void {
    if (item.disabled) return;
    this.close();
    this.selected.emit(item.id);
  }

  close(): void {
    if (openMenu() === this) openMenu.set(null);
  }

  ngOnDestroy(): void {
    // Don't leave a destroyed instance in the module-level slot (e.g. row removed while its menu is open).
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.enabledItems();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.trigger().nativeElement.querySelector<HTMLElement>('button, [tabindex]')?.focus();
        break;
    }
  }

  private enabledItems(): HTMLButtonElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll<HTMLButtonElement>('button.dropdown-menu__item:not([disabled])'));
  }
}
