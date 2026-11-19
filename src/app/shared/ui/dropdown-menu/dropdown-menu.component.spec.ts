import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DropdownMenuComponent, MenuItem } from './dropdown-menu.component';

@Component({
  standalone: true,
  imports: [DropdownMenuComponent],
  template: `
    <div role="presentation" class="row" (click)="rowClicks = rowClicks + 1">
      <app-dropdown-menu [items]="items" ariaLabel="Row actions" (selected)="picked.push($event)">
        <button menu-trigger type="button" class="trigger-a">⋯</button>
      </app-dropdown-menu>
    </div>
    <app-dropdown-menu [items]="items" (selected)="picked.push($event)">
      <button menu-trigger type="button" class="trigger-b">B</button>
    </app-dropdown-menu>
    <button type="button" class="outside">Outside</button>
  `
})
class HostComponent {
  rowClicks = 0;
  picked: string[] = [];
  items: MenuItem[] = [
    { id: 'promote', label: 'Promote' },
    { id: 'archived', label: 'Archived', disabled: true },
    { id: 'transfer', label: 'Transfer' },
    { id: 'offboard', label: 'Offboard', danger: true, dividerBefore: true }
  ];
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };
  const menus = () => el.querySelectorAll('[role="menu"]');
  return { fixture, el, click, menus };
}

describe('DropdownMenuComponent', () => {
  it('is closed initially and opens on trigger click', async () => {
    const { click, menus } = await setup();
    expect(menus().length).toBe(0);
    click('.trigger-a');
    expect(menus().length).toBe(1);
  });

  it('opens upwards when the panel would be cut off at the bottom of the window', async () => {
    const { fixture, el, click } = await setup();
    const rect = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON: () => ({}) });
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('app-popover__panel') || this.classList.contains('dropdown-menu__panel') ? rect(580, 700) : rect(550, 570);
    });
    click('.trigger-a');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('app-dropdown-menu')!.classList).toContain('dropdown-menu--up');
    vi.restoreAllMocks();
  });

  it('trigger click does not reach a clickable ancestor row', async () => {
    const { fixture, click } = await setup();
    click('.trigger-a');
    expect(fixture.componentInstance.rowClicks).toBe(0);
  });

  it('emits the item id, closes, and does not reach the row on selection', async () => {
    const { fixture, click, menus } = await setup();
    click('.trigger-a');
    click('[data-testid="menu-item-transfer"]');
    expect(fixture.componentInstance.picked).toEqual(['transfer']);
    expect(fixture.componentInstance.rowClicks).toBe(0);
    expect(menus().length).toBe(0);
  });

  it('disabled items are rendered disabled and do not emit', async () => {
    const { fixture, el, click } = await setup();
    click('.trigger-a');
    const disabled = el.querySelector('[data-testid="menu-item-archived"]') as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    disabled.click();
    expect(fixture.componentInstance.picked).toEqual([]);
  });

  it('renders danger styling and a divider before flagged items', async () => {
    const { el, click } = await setup();
    click('.trigger-a');
    const offboard = el.querySelector('[data-testid="menu-item-offboard"]') as HTMLElement;
    expect(offboard.classList).toContain('dropdown-menu__item--danger');
    expect(offboard.previousElementSibling?.classList).toContain('dropdown-menu__divider');
  });

  it('closes on an outside click', async () => {
    const { click, menus } = await setup();
    click('.trigger-a');
    click('.outside');
    expect(menus().length).toBe(0);
  });

  it('opening one menu closes any other open menu', async () => {
    const { el, click, menus } = await setup();
    click('.trigger-a');
    click('.trigger-b');
    expect(menus().length).toBe(1);
    expect(el.querySelector('.trigger-b')!.closest('app-dropdown-menu')!.querySelector('[role="menu"]')).toBeTruthy();
  });

  it('clicking the trigger again closes the menu', async () => {
    const { click, menus } = await setup();
    click('.trigger-a');
    click('.trigger-a');
    expect(menus().length).toBe(0);
  });

  it('ArrowDown/ArrowUp move focus across enabled items only, wrapping', async () => {
    const { fixture, el, click } = await setup();
    click('.trigger-a');
    await fixture.whenStable();
    const panel = el.querySelector('.dropdown-menu__panel') as HTMLElement;
    const key = (k: string) => panel.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-promote');
    key('ArrowDown');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-transfer');
    key('ArrowDown');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-offboard');
    key('ArrowDown');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-promote');
    key('ArrowUp');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-offboard');
  });

  it('Escape inside the panel closes, refocuses the trigger, and does not propagate', async () => {
    const { fixture, el, click, menus } = await setup();
    const outerListener = vi.fn();
    el.addEventListener('keydown', outerListener);
    click('.trigger-a');
    await fixture.whenStable();
    const panel = el.querySelector('.dropdown-menu__panel') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(menus().length).toBe(0);
    expect(document.activeElement).toBe(el.querySelector('.trigger-a'));
    expect(outerListener).not.toHaveBeenCalled();
  });
});
