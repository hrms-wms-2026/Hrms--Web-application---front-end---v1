import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectSettingsComponent } from './project-settings.component';
import { TaskApiService } from '../../data-access/task-api.service';

describe('ProjectSettingsComponent', () => {
  it('resolves the project id and renders both the status and category sections on one page', async () => {
    const getStatuses = vi.fn().mockReturnValue(of([]));
    const getCategories = vi.fn().mockReturnValue(of([]));
    TestBed.configureTestingModule({
      imports: [ProjectSettingsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (key: string) => key === 'id' ? 'project-1' : null } } } },
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
    expect(fixture.nativeElement.querySelector('[data-testid="project-settings-tab-task-statuses"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="project-settings-tab-task-categories"]')).not.toBeNull();
  });
});

