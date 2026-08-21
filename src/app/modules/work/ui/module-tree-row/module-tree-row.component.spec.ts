import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModuleTreeRowComponent } from './module-tree-row.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('ModuleTreeRowComponent', () => {
  let fixture: ComponentFixture<ModuleTreeRowComponent>;

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

  it('shows all six icons on an owned leaf, including Add Sprint', () => {
    setup({ ...child, isOwner: true });
    expect(testIds()).toEqual([
      'create-sub-button',
      'edit-button',
      'members-button',
      'create-task-button',
      'create-sprint-button',
      'achieve-button'
    ]);
  });

  it('hides Add Sprint on a non-leaf owned module but keeps the other five icons', () => {
    setup(owned);
    expect(testIds()).toEqual([
      'create-sub-button',
      'edit-button',
      'members-button',
      'create-task-button',
      'achieve-button'
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
});
