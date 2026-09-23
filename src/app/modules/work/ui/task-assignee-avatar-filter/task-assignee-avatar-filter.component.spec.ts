import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  TaskAssigneeAvatarFilterComponent,
  TaskAssigneeAvatarMember
} from './task-assignee-avatar-filter.component';

describe('TaskAssigneeAvatarFilterComponent', () => {
  let fixture: ComponentFixture<TaskAssigneeAvatarFilterComponent>;
  let component: TaskAssigneeAvatarFilterComponent;

  const mockMembers: TaskAssigneeAvatarMember[] = [
    { employeeId: 'emp-1', name: 'Nevi Peiris', avatarUrl: 'https://files.example.test/nevi.jpg' },
    { employeeId: 'emp-2', name: 'Sam Perera', avatarUrl: null },
    { employeeId: 'emp-3', name: 'Danial Ortiz', avatarUrl: 'https://files.example.test/danial.jpg' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TaskAssigneeAvatarFilterComponent]
    });
    fixture = TestBed.createComponent(TaskAssigneeAvatarFilterComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('members', mockMembers);
    fixture.componentRef.setInput('currentEmployeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('renders img element for members with avatarUrl', () => {
    const avatarButtons = fixture.debugElement.queryAll(By.css('.taaf__avatar:not(.taaf__avatar--overflow)'));
    expect(avatarButtons.length).toBe(3);

    // emp-1 has avatarUrl -> should have img
    const emp1Img = avatarButtons[0].query(By.css('img.taaf__img'));
    expect(emp1Img).not.toBeNull();
    expect(emp1Img.nativeElement.getAttribute('src')).toBe('https://files.example.test/nevi.jpg');

    // emp-2 has no avatarUrl -> should render initials
    const emp2Img = avatarButtons[1].query(By.css('img.taaf__img'));
    expect(emp2Img).toBeNull();
    expect(avatarButtons[1].nativeElement.textContent?.trim()).toBe('SP');

    // emp-3 has avatarUrl -> should have img
    const emp3Img = avatarButtons[2].query(By.css('img.taaf__img'));
    expect(emp3Img).not.toBeNull();
    expect(emp3Img.nativeElement.getAttribute('src')).toBe('https://files.example.test/danial.jpg');
  });

  it('falls back to initials when avatar image fails to load', () => {
    const avatarButtons = fixture.debugElement.queryAll(By.css('.taaf__avatar:not(.taaf__avatar--overflow)'));
    const emp1Img = avatarButtons[0].query(By.css('img.taaf__img'));
    expect(emp1Img).not.toBeNull();

    // Trigger image error
    emp1Img.triggerEventHandler('error', {});
    fixture.detectChanges();

    // After error, img should be replaced by initials
    const emp1ImgAfter = avatarButtons[0].query(By.css('img.taaf__img'));
    expect(emp1ImgAfter).toBeNull();
    expect(avatarButtons[0].nativeElement.textContent?.trim()).toBe('NP');
  });

  it('renders avatar img inside dropdown panel option when opened', () => {
    // Open panel
    component.toggleOpen();
    fixture.detectChanges();

    const panel = fixture.debugElement.query(By.css('.taaf__panel'));
    expect(panel).not.toBeNull();

    const options = fixture.debugElement.queryAll(By.css('.taaf__option'));
    expect(options.length).toBe(3);

    // emp-1 option avatar has img
    const opt1Img = options[0].query(By.css('.taaf__option-avatar img.taaf__img'));
    expect(opt1Img).not.toBeNull();
    expect(opt1Img.nativeElement.getAttribute('src')).toBe('https://files.example.test/nevi.jpg');

    // emp-2 option avatar has initials
    const opt2Img = options[1].query(By.css('.taaf__option-avatar img.taaf__img'));
    expect(opt2Img).toBeNull();
    expect(options[1].query(By.css('.taaf__option-avatar')).nativeElement.textContent?.trim()).toBe('SP');
  });

  it('emits selectionChanged with toggled employeeId on avatar click', () => {
    const emitted: string[][] = [];
    component.selectionChanged.subscribe((val) => emitted.push(val));

    const avatarButtons = fixture.debugElement.queryAll(By.css('.taaf__avatar:not(.taaf__avatar--overflow)'));
    avatarButtons[0].nativeElement.click();
    expect(emitted).toEqual([['emp-1']]);

    // Click again to untoggle
    fixture.componentRef.setInput('selected', ['emp-1']);
    fixture.detectChanges();
    avatarButtons[0].nativeElement.click();
    expect(emitted[1]).toEqual([]);
  });

  it('emits empty array on clear', () => {
    const emitted: string[][] = [];
    component.selectionChanged.subscribe((val) => emitted.push(val));

    fixture.componentRef.setInput('selected', ['emp-1']);
    component.toggleOpen();
    fixture.detectChanges();

    const clearBtn = fixture.debugElement.query(By.css('.taaf__clear'));
    expect(clearBtn).not.toBeNull();
    clearBtn.nativeElement.click();

    expect(emitted).toEqual([[]]);
  });
});
