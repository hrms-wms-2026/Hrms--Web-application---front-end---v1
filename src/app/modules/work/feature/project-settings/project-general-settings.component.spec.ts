import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProjectDetail } from '../../models/project.model';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { ProjectGeneralSettingsComponent } from './project-general-settings.component';

describe('ProjectGeneralSettingsComponent', () => {
  let fixture: ComponentFixture<ProjectGeneralSettingsComponent>;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectGeneralSettingsComponent],
      providers: [{
        provide: ProjectCategoryStore,
        useValue: { categories: () => [{ id: 'cat1', name: 'Engineering' }], loadCategories: vi.fn().mockResolvedValue(undefined) }
      }]
    });
    fixture = TestBed.createComponent(ProjectGeneralSettingsComponent);
    fixture.componentRef.setInput('project', project);
  });

  it('renders the project settings inline and emits an edit payload', () => {
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((value) => (emitted = value));

    const allocatedInput = fixture.nativeElement.querySelector('[data-testid="allocated-hours-field"] input') as HTMLInputElement;
    allocatedInput.value = '75';
    allocatedInput.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.fields.allocatedHours).toBe(75);
    expect(emitted.achievedChanged).toBe(false);
  });

  it('is read-only for a project member who is not the lead', () => {
    fixture.componentRef.setInput('project', { ...project, isLead: false });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Only the project lead can change these details.');
    expect(fixture.nativeElement.querySelector('[data-testid="submit-button"]')).toBeNull();
    expect((fixture.nativeElement.querySelector('[data-testid="name-field"] input') as HTMLInputElement).disabled).toBe(true);
  });
});
