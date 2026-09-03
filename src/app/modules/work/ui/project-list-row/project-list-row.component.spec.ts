import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProjectListRowComponent } from './project-list-row.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { Project } from '../../models/project.model';

describe('ProjectListRowComponent', () => {
  let fixture: ComponentFixture<ProjectListRowComponent>;

  const project: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'lead-1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 10, isLead: true, isAchieved: false, achievedAt: null, updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectListRowComponent],
      providers: [{
        provide: EmployeeDirectoryStore,
        useValue: { get: () => undefined, ensureLoaded: vi.fn().mockResolvedValue(undefined) }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectListRowComponent);
  });

  it('renders the project name', () => {
    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
  });

  it('sets progress to 25% when 10 of 40 hours are complete', () => {
    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    const fill = fixture.nativeElement.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('25%');
  });

  it('sets progress to 0% when allocated hours are 0', () => {
    fixture.componentRef.setInput('project', { ...project, allocatedHours: 0, completedHours: 0 });
    fixture.detectChanges();
    const fill = fixture.nativeElement.querySelector('[data-testid="progress-fill"]') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('emits selectedChange when the row is clicked', () => {
    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    let emitted = false;
    fixture.componentInstance.selectedChange.subscribe(() => { emitted = true; });
    (fixture.nativeElement.querySelector('[data-testid="project-list-row"]') as HTMLButtonElement).click();
    expect(emitted).toBe(true);
  });
});
