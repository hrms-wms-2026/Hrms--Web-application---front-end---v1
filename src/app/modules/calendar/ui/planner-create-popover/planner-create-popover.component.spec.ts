import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CreateSlot, CreateTab } from './planner-create-draft';
import { PlannerCreatePopoverComponent } from './planner-create-popover.component';

@Component({
  standalone: true,
  imports: [PlannerCreatePopoverComponent],
  template: `
    <app-planner-create-popover #pop [slot]="slot" [tabs]="tabs()" (closed)="closed()">
      <input data-testid="probe-title" [value]="pop.shared.title()" (input)="pop.shared.title.set($any($event.target).value)" />
      <span data-testid="probe-tab">{{ pop.active() }}</span>
    </app-planner-create-popover>
    <button data-testid="outside">outside</button>
  `,
})
class HostComponent {
  slot: CreateSlot = { date: '2026-11-10', startMinutes: 540, endMinutes: 660, startIso: '2026-11-10T09:00:00.000Z', endIso: '2026-11-10T11:00:00.000Z' };
  tabs = signal<readonly CreateTab[]>(['event', 'meeting', 'workItem', 'timeOff']);
  closed = vi.fn();
}

describe('PlannerCreatePopoverComponent', () => {
  function setup(tabs?: readonly CreateTab[]) {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    if (tabs) fixture.componentInstance.tabs.set(tabs);
    fixture.detectChanges();
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    return { fixture, q };
  }

  it('shows the tabs in order Event, Meeting, Work item, Time off', () => {
    const { fixture } = setup();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLElement>)
      .map((t) => t.textContent!.trim());
    expect(labels).toEqual(['Event', 'Meeting', 'Work item', 'Time off']);
  });

  it('hides a tab that is not in tabs', () => {
    const { q } = setup(['event', 'workItem']);
    expect(q('create-tab-meeting')).toBeNull();
    expect(q('create-tab-timeOff')).toBeNull();
    expect(q('create-tab-workItem')).not.toBeNull();
  });

  it('starts on Event and switches tab on click', () => {
    const { fixture, q } = setup();
    expect(q('probe-tab')!.textContent).toBe('event');
    q('create-tab-workItem')!.click();
    fixture.detectChanges();
    expect(q('probe-tab')!.textContent).toBe('workItem');
    expect(q('create-tab-workItem')!.getAttribute('aria-selected')).toBe('true');
  });

  it('keeps the title when switching tabs', () => {
    const { fixture, q } = setup();
    const title = q('probe-title') as HTMLInputElement;
    title.value = 'Design review';
    title.dispatchEvent(new Event('input'));
    q('create-tab-meeting')!.click();
    fixture.detectChanges();
    expect((q('probe-title') as HTMLInputElement).value).toBe('Design review');
  });

  it('closes on Escape, on ✕ and on an outside click', () => {
    const { fixture, q } = setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    q('create-popover-close')!.click();
    q('create-popover-backdrop')!.click();
    expect(fixture.componentInstance.closed).toHaveBeenCalledTimes(3);
  });

  it('a click inside the panel does not close it', () => {
    const { fixture, q } = setup();
    q('create-popover-panel')!.click();
    expect(fixture.componentInstance.closed).not.toHaveBeenCalled();
  });
});
