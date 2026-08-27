import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectMembersPopupComponent } from './project-members-popup.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

describe('ProjectMembersPopupComponent', () => {
  let fixture: ComponentFixture<ProjectMembersPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectMembersPopupComponent],
      providers: [{ provide: PeopleApiService, useValue: { listEmployees: () => of({ items: [{ id: 'e2', fullName: 'Grace Hopper', email: 'g@x.com', departmentName: 'Eng' }], totalCount: 1, page: 1, pageSize: 20 }) } }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectMembersPopupComponent);
  });

  it('lists member display names', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('members', [{ userId: 'u2', displayName: 'Ada Lovelace' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('hides Add member when canManage is false', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="add-member-button"]')).toBeNull();
  });

  it('emits addRequested when an employee is picked', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    let added: string | null = null;
    fixture.componentInstance.addRequested.subscribe((id) => { added = id; });

    (fixture.nativeElement.querySelector('[data-testid="add-member-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="employee-picker-row"]') as HTMLButtonElement).click();

    expect(added).toBe('e2');
  });
});
