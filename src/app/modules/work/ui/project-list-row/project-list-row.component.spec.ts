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

  it('shows the project logo when one is set, from the same URL as the project cards', () => {
    fixture.componentRef.setInput('project', { ...project, logoFileId: 'logo-9' });
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('[data-testid="project-row-logo"]') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('/work/projects/' + project.id + '/logo?v=logo-9');
  });

  it('falls back to the initial when there is no logo or it fails to load', () => {
    fixture.componentRef.setInput('project', { ...project, logoFileId: 'logo-9' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="project-row-logo"]') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="project-row-logo"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(project.name.charAt(0).toUpperCase());
  });

  it('turns the logo placeholder solid accent only on the selected row', () => {
    fixture.componentRef.setInput('project', { ...project, color: '#dc2626' });
    fixture.detectChanges();
    const placeholder = () => fixture.nativeElement.querySelector('[data-testid="project-row-placeholder"]') as HTMLElement;
    expect(placeholder().className).toContain('text-[var(--color-text-primary)]');
    expect(placeholder().className).not.toContain('bg-[var(--color-accent)]');

    fixture.componentRef.setInput('selected', true);
    fixture.detectChanges();
    expect(placeholder().className).toContain('bg-[var(--color-accent)]');
    expect(placeholder().style.background).toBe('');
  });

  it('shows the key with the category, and the target date while on time', () => {
    fixture.componentRef.setInput('project', { ...project, targetDate: '2099-12-31' });
    fixture.componentRef.setInput('categoryName', 'Operations');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="project-row-category"]')?.textContent?.trim()).toBe('Operations');
    expect(el.querySelector('[data-testid="project-row-date"]')?.textContent).toContain('2099-12-31');
    expect(el.querySelector('[data-testid="project-row-overdue"]')).toBeNull();
  });

  it('shows how overdue a project is once its target date has passed', () => {
    fixture.componentRef.setInput('project', { ...project, targetDate: '2020-01-01' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="project-row-overdue"]')?.textContent).toContain('days overdue');
  });

  it('offers only Open project to a non-lead, and lead actions to the lead', () => {
    fixture.componentRef.setInput('project', { ...project, isLead: false });
    fixture.detectChanges();
    expect(fixture.componentInstance.menuItems().map((i) => i.id)).toEqual(['open']);

    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    expect(fixture.componentInstance.menuItems().map((i) => i.id)).toEqual(['open', 'settings', 'archive', 'delete']);
  });
});
