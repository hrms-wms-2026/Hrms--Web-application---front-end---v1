import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectTableViewComponent } from './project-table-view.component';
import { Project } from '../../models/project.model';

describe('ProjectTableViewComponent', () => {
  let fixture: ComponentFixture<ProjectTableViewComponent>;
  let component: ProjectTableViewComponent;

  const testProjects: Project[] = [
    {
      id: 'p1',
      name: 'Beta Project',
      identifier: 'BETA',
      categoryId: 'cat1',
      description: 'Beta description',
      leadId: 'u1',
      startDate: '2026-01-01',
      targetDate: '2026-10-01',
      color: '#3b82f6',
      isActive: true,
      allocatedHours: 100,
      completedHours: 50,
      isLead: true,
      isAchieved: false,
      achievedAt: null,
      updatedAt: null,
      logoFileId: null,
      labels: [],
      members: [],
      memberCount: 0
    },
    {
      id: 'p2',
      name: 'Alpha Project',
      identifier: 'ALPHA',
      categoryId: 'cat2',
      description: 'Alpha description',
      leadId: 'u2',
      startDate: '2026-02-01',
      targetDate: '2026-05-01',
      color: '#10b981',
      isActive: true,
      allocatedHours: 200,
      completedHours: 20,
      isLead: false,
      isAchieved: false,
      achievedAt: null,
      updatedAt: null,
      logoFileId: null,
      labels: [],
      members: [],
      memberCount: 0
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectTableViewComponent]
    });
    fixture = TestBed.createComponent(ProjectTableViewComponent);
    component = fixture.componentInstance;
  });

  it('renders all projects in table rows', () => {
    fixture.componentRef.setInput('projects', testProjects);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="project-table-row"]');
    expect(rows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Beta Project');
    expect(fixture.nativeElement.textContent).toContain('Alpha Project');
  });

  it('sorts projects by name ascending and descending', () => {
    fixture.componentRef.setInput('projects', testProjects);
    fixture.detectChanges();

    // Default sort is name ascending: Alpha should be first
    expect(component.sortedProjects()[0].name).toBe('Alpha Project');
    expect(component.sortedProjects()[1].name).toBe('Beta Project');

    // Toggle sort to descending
    component.toggleSort('name');
    expect(component.sortedProjects()[0].name).toBe('Beta Project');
    expect(component.sortedProjects()[1].name).toBe('Alpha Project');
  });

  it('emits rowSelected when a row is clicked', () => {
    fixture.componentRef.setInput('projects', testProjects);
    fixture.detectChanges();

    let selected: Project | null = null;
    component.rowSelected.subscribe((p) => (selected = p));

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="project-table-row"]');
    (rows[0] as HTMLElement).click();

    expect(selected).not.toBeNull();
  });
});
