import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectSettingsComponent } from './project-settings.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectListStore } from '../../state/project-list.store';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { ProjectDetail } from '../../models/project.model';

describe('ProjectSettingsComponent', () => {
  const project: ProjectDetail = {
    id: 'project-1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  it('renders project details, statuses, and categories together on one page', async () => {
    const getStatuses = vi.fn().mockReturnValue(of([]));
    const getCategories = vi.fn().mockReturnValue(of([]));
    const editProject = vi.fn().mockResolvedValue(true);
    const loadProject = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [ProjectSettingsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (key: string) => key === 'id' ? 'project-1' : null } } } },
        { provide: ProjectDetailStore, useValue: { project: () => project, loadProject } },
        { provide: ProjectListStore, useValue: {
          error: () => null, editProject, achieveProject: vi.fn().mockResolvedValue(true),
          unachieveProject: vi.fn().mockResolvedValue(true)
        } },
        { provide: ProjectCategoryStore, useValue: {
          categories: () => [{ id: 'cat1', name: 'Engineering' }], loadCategories: vi.fn().mockResolvedValue(undefined)
        } },
        { provide: NotificationService, useValue: { success: vi.fn() } },
        { provide: TaskApiService, useValue: {
          getStatuses, getCategories, createStatus: vi.fn(), deleteStatus: vi.fn(), reorderTaskStatuses: vi.fn(),
          createCategory: vi.fn(), editCategory: vi.fn(), deleteCategory: vi.fn(), reorderTaskCategories: vi.fn()
        } }
      ]
    });
    const fixture = TestBed.createComponent(ProjectSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    // Settings moved from a tab-switcher to a single scrolling page (see the
    // 20260825 settings-redesign commits) - both sections load and render at once now,
    // there's no click needed to reveal the second one.
    expect(getStatuses).toHaveBeenCalledWith('project-1');
    expect(getCategories).toHaveBeenCalledWith('project-1');
    expect(fixture.nativeElement.querySelector('[data-testid="project-general-settings"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="project-settings-tab-task-statuses"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="project-settings-tab-task-categories"]')).not.toBeNull();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(editProject).toHaveBeenCalledWith('project-1', expect.objectContaining({ name: 'Website Revamp' }));
    expect(loadProject).toHaveBeenCalledWith('project-1');
  });
});

