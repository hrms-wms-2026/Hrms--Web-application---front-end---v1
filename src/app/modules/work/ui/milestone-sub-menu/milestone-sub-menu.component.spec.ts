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

    it('renders all five base tabs in order for non-owners', () => {

    const labels = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el) => (el as HTMLElement).textContent?.trim() ?? '');
        expect(labels).toEqual(['Tree', 'Board', 'Backlog', 'Approvals', 'Calendar']);

  });

  it('includes Settings tab for owners', () => {
    fixture.componentRef.setInput('isOwner', true);
    fixture.detectChanges();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el) => (el as HTMLElement).textContent?.trim() ?? '');
        expect(labels).toEqual(['Tree', 'Board', 'Backlog', 'Approvals', 'Calendar', 'Settings']);

  });

  it('renders an icon inside every tab link', () => {
    const icons = fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"] svg');
        expect(icons.length).toBe(5);

  });

  it('builds the correct link target for each tab', () => {
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el: any) => el.getAttribute('href'));
    expect(hrefs).toEqual([
      '/milestones/o1/tree',
      '/board',
      '/backlog',
      '/approvals',
      '/calendar'
    ]);
  });

  it('links Settings to the project-level route, not nested under the milestone', () => {
    fixture.componentRef.setInput('isOwner', true);
    fixture.detectChanges();
    const links = fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]');
    const settingsHref = (links[links.length - 1] as HTMLAnchorElement).getAttribute('href');
    expect(settingsHref).toBe('/settings');
  });

  it('shows a red indicator on Approvals only when received approvals are pending', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="approvals-pending-indicator"]')).toBeNull();

    fixture.componentRef.setInput('pendingApprovalCount', 2);
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector('[data-testid="approvals-pending-indicator"]');
    const approvalsLink = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .find((element: any) => element.textContent.includes('Approvals')) as HTMLAnchorElement;
    expect(indicator).not.toBeNull();
    expect(approvalsLink.getAttribute('aria-label')).toBe('Approvals, 2 pending');
  });
});
