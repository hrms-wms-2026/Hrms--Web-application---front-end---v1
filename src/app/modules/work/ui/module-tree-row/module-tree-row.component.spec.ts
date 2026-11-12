import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ModuleTreeRowComponent } from './module-tree-row.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('ModuleTreeRowComponent', () => {
  let fixture: ComponentFixture<ModuleTreeRowComponent>;
  const directoryStub = {
    get: vi.fn((employeeId: string) => employeeId === 'owner-1'
      ? { id: 'owner-1', name: 'Arun Cached', initials: 'AC', avatarUrl: '/cached/owner-1' }
      : undefined)
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModuleTreeRowComponent],
      providers: [{ provide: EmployeeDirectoryStore, useValue: directoryStub }]
    });
  });

  const child: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: null, startDate: '2026-01-20', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
    ownerName: 'Diya', isOwner: true, children: [], kind: 'objective'
  };

  const owned: MilestoneTreeNode = {
    id: 'o1', title: 'Root', description: null, startDate: '2026-01-15', endDate: '2026-03-01',
    progress: 0, allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false,
    ownerName: 'Arun', isOwner: true, children: [child], kind: 'objective'
  };

  function setup(node: MilestoneTreeNode): void {
    fixture = TestBed.createComponent(ModuleTreeRowComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
  }

  function testIds(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid]'))
      .map((el) => (el as HTMLElement).getAttribute('data-testid') ?? '')
      .filter((id) => id.endsWith('-button'));
  }

  it('shows a red alert mark listing the project monitor problems, and none without alerts', () => {
    setup(child);
    expect(fixture.nativeElement.querySelector('[data-testid="tree-row-alert"]')).toBeNull();

    fixture.componentRef.setInput('alerts', [{
      id: 'a1', targetType: 'module', targetId: 'o2', targetTitle: 'Child', ruleCode: 'module_capacity_shortfall',
      subjectEmployeeId: null, message: '200 h of work remain, but the team can produce only 120 h.', firstDetectedAt: '2026-10-05T09:00:00Z'
    }]);
    fixture.detectChanges();

    const mark = fixture.nativeElement.querySelector('[data-testid="tree-row-alert"]') as HTMLElement;
    expect(mark.getAttribute('title')).toContain('only 120 h');
  });

  it('shows the plus shortcut and an overflow button on an owned leaf', () => {
    setup({ ...child, isOwner: true });
    expect(testIds()).toEqual([
      'create-sub-button',
      'shortcut-menu-button'
    ]);
  });

  it('reveals every existing leaf action with its shortcut name from the overflow menu', () => {
    setup({ ...child, isOwner: true });
    (fixture.nativeElement.querySelector('[data-testid="shortcut-menu-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')?.textContent).toContain('Sub milestone');
    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')?.textContent).toContain('Edit');
    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')?.textContent).toContain('Members');
    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')?.textContent).toContain('Create sprint');
    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')?.textContent).toContain('Achieve milestone');
  });

  it('closes the shortcut menu on an outside document click', () => {
    // Regression test: without this, the popover stayed open indefinitely and its
    // absolutely-positioned menu visually overlapped rows beneath it in the tree,
    // so a click aimed at a lower row's own "Edit task" button landed on this
    // popover's stray "Edit" item instead - opening the wrong entity's edit form.
    setup({ ...child, isOwner: true });
    (fixture.nativeElement.querySelector('[data-testid="shortcut-menu-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')).not.toBeNull();

    document.body.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')).toBeNull();
  });

  it('clicking the trigger button to close an open menu does not reopen it', () => {
    // Regression test for a bug introduced while fixing the overlap issue above: the
    // capture-phase outside-click listener must not fight with the trigger button's
    // own toggle - clicking the trigger while the menu is open should close it, not
    // immediately reopen it.
    setup({ ...child, isOwner: true });
    const trigger = fixture.nativeElement.querySelector('[data-testid="shortcut-menu-button"]') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')).not.toBeNull();

    trigger.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="shortcut-menu"]')).toBeNull();
  });

  it('keeps the overflow shortcut on a non-leaf owned module', () => {
    setup(owned);
    expect(testIds()).toEqual([
      'create-sub-button',
      'shortcut-menu-button'
    ]);
  });

  it('hides every action icon when the caller is not the owner', () => {
    setup({ ...owned, isOwner: false });
    expect(fixture.nativeElement.querySelector('[data-testid="row-actions"]')?.querySelectorAll('button').length).toBe(0);
  });

  it('renders title-text with both truncate and min-w-0 classes for proper text truncation', () => {
    setup(owned);
    const titleEl = fixture.nativeElement.querySelector('[data-testid="title-text"]');
    expect(titleEl).not.toBeNull();
    expect(titleEl.classList.contains('truncate')).toBe(true);
    expect(titleEl.classList.contains('min-w-0')).toBe(true);
  });

  it('renders achieved badge with correct content when isAchieved is true', () => {
    setup({ ...owned, isAchieved: true });
    expect(fixture.nativeElement.querySelector('[data-testid="achieved-badge"]')?.textContent).toContain('Achieved');
  });

  it('renders the owner image and name from the preloaded employee directory cache', () => {
    setup({ ...owned, ownerId: 'owner-1' });

    const image = fixture.nativeElement.querySelector('[data-testid="owner-cell"] img') as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute('src')).toBe('/cached/owner-1');
    expect(image.getAttribute('alt')).toBe("Arun Cached's avatar");
  });
});
