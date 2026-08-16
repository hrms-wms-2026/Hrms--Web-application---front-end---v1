import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MilestoneSubMenuComponent } from './milestone-sub-menu.component';

describe('MilestoneSubMenuComponent', () => {
  let fixture: ComponentFixture<MilestoneSubMenuComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MilestoneSubMenuComponent],
      providers: [provideRouter([])]
    });
    fixture = TestBed.createComponent(MilestoneSubMenuComponent);
    fixture.componentRef.setInput('milestoneId', 'o1');
    fixture.componentRef.setInput('milestoneTitle', 'Milestone 1');
    fixture.detectChanges();
  });

  it('shows the selected milestone title above the tabs', () => {
    const title = fixture.nativeElement.querySelector('[data-testid="sub-menu-milestone-title"]');
    expect(title.textContent).toContain('Milestone 1');
  });

  it('renders all six tabs in order', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el: any) => el.textContent.trim());
    expect(labels).toEqual(['Tree', 'Board', 'Backlog', 'My Task', 'List', 'Approvals']);
  });

  it('renders an icon inside every tab link', () => {
    const icons = fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"] svg');
    expect(icons.length).toBe(6);
  });

  it('builds the correct link target for each tab', () => {
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el: any) => el.getAttribute('href'));
    expect(hrefs).toEqual([
      '/milestones/o1/tree',
      '/milestones/o1/board',
      '/milestones/o1/backlog',
      '/milestones/o1/my-task',
      '/milestones/o1/list',
      '/milestones/o1/approvals'
    ]);
  });
});
