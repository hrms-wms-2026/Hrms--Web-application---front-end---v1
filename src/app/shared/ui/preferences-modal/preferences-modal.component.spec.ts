import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { PreferencesModalComponent, PreferenceTab } from './preferences-modal.component';

@Component({
  standalone: true,
  imports: [PreferencesModalComponent],
  template: `
    <app-preferences-modal
      [open]="open()"
      [tabs]="tabs"
      [activeTabId]="activeTabId()"
      (activeTabIdChange)="activeTabId.set($event)"
      (closed)="closedCount = closedCount + 1"
    >
      <p>Panel for {{ activeTabId() }}</p>
    </app-preferences-modal>
  `
})
class HostComponent {
  open = signal(true);
  activeTabId = signal('tab-a');
  closedCount = 0;
  tabs: readonly PreferenceTab[] = [
    { id: 'tab-a', label: 'Tab A', icon: 'palette' },
    { id: 'tab-b', label: 'Tab B', icon: 'user' }
  ];
}

describe('PreferencesModalComponent', () => {
  it('does not render when open is false', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('renders one sidebar button per tab and projects the active panel content', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.preferences-tab-btn');
    expect(buttons.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Panel for tab-a');
  });

  it('emits activeTabIdChange when a different tab is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('.preferences-tab-btn'));
    buttons[1].nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTabId()).toBe('tab-b');
    expect(fixture.nativeElement.textContent).toContain('Panel for tab-b');
  });

  it('shows profile sub-tabs only for the configured parent tab', async () => {
    @Component({
      standalone: true,
      imports: [PreferencesModalComponent],
      template: `
        <app-preferences-modal
          [open]="true"
          [tabs]="tabs"
          [activeTabId]="activeTabId()"
          [subTabs]="subTabs"
          [activeSubTabId]="activeSubTabId()"
          subTabsForTabId="profile"
        >
          <p>Panel</p>
        </app-preferences-modal>
      `
    })
    class SubTabHostComponent {
      activeTabId = signal('profile');
      activeSubTabId = signal('personal');
      tabs: readonly PreferenceTab[] = [
        { id: 'appearance', label: 'Appearance', icon: 'palette' },
        { id: 'profile', label: 'Profile', icon: 'user' }
      ];
      subTabs = [
        { id: 'personal', label: 'Personal Information' },
        { id: 'job', label: 'Job Information' }
      ];
    }

    await TestBed.configureTestingModule({ imports: [SubTabHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SubTabHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.preferences-subtabs [role="tab"]').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.preferences-subtabs [role="tablist"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.preferences-subtabs [role="tab"][aria-selected="true"]')?.textContent).toContain('Personal Information');
    expect(fixture.nativeElement.querySelector('.preferences-sub-sidebar')).toBeFalsy();
  });

  it('applies the requested modal size', async () => {
    @Component({
      standalone: true,
      imports: [PreferencesModalComponent],
      template: `<app-preferences-modal [open]="true" [tabs]="tabs" [activeTabId]="'tab-a'" size="2xl"><p>x</p></app-preferences-modal>`
    })
    class XlHostComponent {
      tabs: readonly PreferenceTab[] = [{ id: 'tab-a', label: 'Tab A', icon: 'user' }];
    }

    await TestBed.configureTestingModule({ imports: [XlHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(XlHostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.classList.contains('max-w-6xl')).toBe(true);
  });
});
