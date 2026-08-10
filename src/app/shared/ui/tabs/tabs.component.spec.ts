import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabsComponent, TabItem } from './tabs.component';

describe('TabsComponent', () => {
  let fixture: ComponentFixture<TabsComponent>;

  const tabs: TabItem[] = [
    { id: 'tree', label: 'Tree' },
    { id: 'list', label: 'List', disabled: true }
  ];

  function setup(activeId: string | null = 'tree'): void {
    TestBed.configureTestingModule({ imports: [TabsComponent] });
    fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('tabs', tabs);
    fixture.componentRef.setInput('activeId', activeId);
    fixture.detectChanges();
  }

  it('renders a button per tab', () => {
    setup();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Tree');
    expect(buttons[1].textContent).toContain('List');
  });

  it('emits tabChange with the clicked tab id', () => {
    setup();
    let emitted: string | null = null;
    fixture.componentInstance.tabChange.subscribe((id: string) => (emitted = id));
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    (buttons[0] as HTMLButtonElement).click();
    expect(emitted).toBe('tree');
  });

  it('does not emit tabChange when a disabled tab is clicked', () => {
    setup();
    let emitted = false;
    fixture.componentInstance.tabChange.subscribe(() => (emitted = true));
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    (buttons[1] as HTMLButtonElement).click();
    expect(emitted).toBe(false);
  });

  it('marks the active tab as selected', () => {
    setup('tree');
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    expect(buttons[0].getAttribute('aria-selected')).toBe('true');
    expect(buttons[1].getAttribute('aria-selected')).toBe('false');
  });

  it('disables the button element for a disabled tab', () => {
    setup();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
