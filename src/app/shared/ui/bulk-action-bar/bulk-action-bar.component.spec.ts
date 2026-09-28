import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BulkAction, BulkActionBarComponent } from './bulk-action-bar.component';

@Component({
  standalone: true,
  imports: [BulkActionBarComponent],
  template: `
    <app-bulk-action-bar
      [count]="count"
      [actions]="actions"
      noun="employee"
      (action)="actionIds.push($event)"
      (cleared)="clearedCount = clearedCount + 1"
    />
  `
})
class HostComponent {
  count = 0;
  actionIds: string[] = [];
  clearedCount = 0;
  actions: BulkAction[] = [
    { id: 'change-position', label: 'Change Position', placement: 'primary' },
    { id: 'locked', label: 'Locked', placement: 'primary', disabled: true, disabledReason: 'Not allowed' },
    { id: 'export', label: 'Export Selected', placement: 'more' },
    { id: 'offboard', label: 'Bulk Offboard', placement: 'more', danger: true }
  ];
}

async function setup(count: number, actions?: BulkAction[]) {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.count = count;
  if (actions) fixture.componentInstance.actions = actions;
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  return { fixture, el, q };
}

describe('BulkActionBarComponent', () => {
  it('renders nothing when count is 0', async () => {
    const { q } = await setup(0);
    expect(q('bulk-action-bar')).toBeNull();
  });

  it('shows the pluralized count', async () => {
    const one = await setup(1);
    expect(one.q('bulk-action-bar')!.textContent).toContain('1 employee selected');
    TestBed.resetTestingModule();
    const many = await setup(4);
    expect(many.q('bulk-action-bar')!.textContent).toContain('4 employees selected');
  });

  it('exposes toolbar semantics', async () => {
    const { q } = await setup(2);
    const bar = q('bulk-action-bar')!;
    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-label')).toBe('Bulk actions');
    expect(bar.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('renders primary actions as buttons and emits their id', async () => {
    const { fixture, q } = await setup(2);
    q('bulk-action-change-position')!.click();
    expect(fixture.componentInstance.actionIds).toEqual(['change-position']);
    expect(q('bulk-action-export')).toBeNull();
  });

  it('disabled primary actions are disabled, carry their reason as title, and do not emit', async () => {
    const { fixture, q } = await setup(2);
    const locked = q('bulk-action-locked') as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    expect(locked.title).toBe('Not allowed');
    locked.click();
    expect(fixture.componentInstance.actionIds).toEqual([]);
  });

  it('puts "more" actions in the More menu and emits their id', async () => {
    const { fixture, el, q } = await setup(2);
    q('bulk-action-more')!.click();
    fixture.detectChanges();
    const offboard = el.querySelector('[data-testid="menu-item-offboard"]') as HTMLElement;
    expect(offboard.classList).toContain('dropdown-menu__item--danger');
    offboard.click();
    expect(fixture.componentInstance.actionIds).toEqual(['offboard']);
  });

  it('omits the More button when there are no "more" actions', async () => {
    const { q } = await setup(2, [{ id: 'move', label: 'Move to sprint', placement: 'primary' }]);
    expect(q('bulk-action-more')).toBeNull();
  });

  it('clear button emits cleared', async () => {
    const { fixture, q } = await setup(2);
    q('bulk-action-clear')!.click();
    expect(fixture.componentInstance.clearedCount).toBe(1);
  });

  it('Escape with focus inside the bar emits cleared', async () => {
    const { fixture, q } = await setup(2);
    q('bulk-action-change-position')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.clearedCount).toBe(1);
  });

  it('Escape elsewhere on the page does not clear (e.g. closing a modal)', async () => {
    const { fixture } = await setup(2);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.clearedCount).toBe(0);
  });

  it('Escape that closes the open More menu does not also clear', async () => {
    const { fixture, el, q } = await setup(2);
    q('bulk-action-more')!.click();
    fixture.detectChanges();
    (el.querySelector('.dropdown-menu__panel') as HTMLElement)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.clearedCount).toBe(0);
  });
});
