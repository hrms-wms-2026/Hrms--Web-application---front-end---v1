import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabsComponent, TabOption } from './tabs.component';

@Component({
  standalone: true,
  imports: [TabsComponent],
  template: `<app-tabs [tabs]="tabs" [value]="active" (valueChange)="selected = $event" />`
})
class HostComponent {
  tabs: readonly TabOption[] = [
    { value: 'appearance', label: 'Appearance' },
    { value: 'notifications', label: 'Notifications' }
  ];
  active = 'appearance';
  selected = '';
}

describe('TabsComponent', () => {
  it('renders labels in order and marks the active tab', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const tabs = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')) as HTMLButtonElement[];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Appearance', 'Notifications']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(tabs[0].classList.contains('app-tabs__tab--active')).toBe(true);
  });

  it('emits the selected value when another tab is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]') as NodeListOf<HTMLButtonElement>;
    tabs[1].click();

    expect(fixture.componentInstance.selected).toBe('notifications');
  });
});
