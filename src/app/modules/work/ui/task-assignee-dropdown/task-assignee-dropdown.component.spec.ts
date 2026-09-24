import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskAssigneeDropdownComponent, TaskAssigneeOption } from './task-assignee-dropdown.component';

describe('TaskAssigneeDropdownComponent', () => {
  let fixture: ComponentFixture<TaskAssigneeDropdownComponent>;
  let component: TaskAssigneeDropdownComponent;

  const mockMembers: TaskAssigneeOption[] = [
    { employeeId: 'emp-1', name: 'Kavisna Rajapaksa', email: 'kavisna@test.com' },
    { employeeId: 'emp-2', name: 'Sutharshan Nadarajah', email: 'sutharshan@test.com' },
    { employeeId: 'emp-3', name: 'Sangavi Thavarajah', email: 'sangavi@test.com' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskAssigneeDropdownComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskAssigneeDropdownComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('members', mockMembers);
    fixture.detectChanges();
  });

  it('renders all members and unassigned option by default', () => {
    const unassignedBtn = fixture.nativeElement.querySelector('[data-testid="assignee-option-unassigned"]');
    expect(unassignedBtn).toBeTruthy();

    const options = fixture.nativeElement.querySelectorAll('.task-assignee-dropdown__option');
    // 1 unassigned + 3 members = 4
    expect(options.length).toBe(4);
  });

  it('filters members based on search query', () => {
    const searchInput = fixture.nativeElement.querySelector('[data-testid="assignee-dropdown-search"]') as HTMLInputElement;
    searchInput.value = 'Kavisna';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const memberOptions = fixture.nativeElement.querySelectorAll('[data-testid^="assignee-option-emp-"]');
    expect(memberOptions.length).toBe(1);
    expect(memberOptions[0].textContent).toContain('Kavisna Rajapaksa');
  });

  it('shows empty text when no members match search', () => {
    const searchInput = fixture.nativeElement.querySelector('[data-testid="assignee-dropdown-search"]') as HTMLInputElement;
    searchInput.value = 'NonExistentPerson';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const emptyMsg = fixture.nativeElement.querySelector('.task-assignee-dropdown__empty');
    expect(emptyMsg).toBeTruthy();
    expect(emptyMsg.textContent.trim()).toBe('No matching people');
  });

  it('emits selected with member employeeId when member clicked', () => {
    let emittedId: string | null | undefined;
    component.selected.subscribe((id) => (emittedId = id));

    const memberBtn = fixture.nativeElement.querySelector('[data-testid="assignee-option-emp-2"]') as HTMLButtonElement;
    memberBtn.click();

    expect(emittedId).toBe('emp-2');
  });

  it('emits selected with null when unassigned clicked', () => {
    let emittedId: string | null | undefined = 'initial';
    component.selected.subscribe((id) => (emittedId = id));

    const unassignedBtn = fixture.nativeElement.querySelector('[data-testid="assignee-option-unassigned"]') as HTMLButtonElement;
    unassignedBtn.click();

    expect(emittedId).toBeNull();
  });

  it('shows checkmark on the selected member', () => {
    fixture.componentRef.setInput('selectedId', 'emp-1');
    fixture.detectChanges();

    const emp1Btn = fixture.nativeElement.querySelector('[data-testid="assignee-option-emp-1"]');
    expect(emp1Btn.classList.contains('task-assignee-dropdown__option--selected')).toBe(true);
    expect(emp1Btn.querySelector('.task-assignee-dropdown__check')).toBeTruthy();

    const emp2Btn = fixture.nativeElement.querySelector('[data-testid="assignee-option-emp-2"]');
    expect(emp2Btn.classList.contains('task-assignee-dropdown__option--selected')).toBe(false);
  });
});
