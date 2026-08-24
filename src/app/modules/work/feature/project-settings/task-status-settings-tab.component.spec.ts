import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskStatusSettingsTabComponent } from './task-status-settings-tab.component';
import { TaskApiService } from '../../data-access/task-api.service';

describe('TaskStatusSettingsTabComponent', () => {
  it('loads statuses using the project id input', async () => {
    const getStatuses = vi.fn().mockReturnValue(of([
      { id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }
    ]));
    TestBed.configureTestingModule({
      imports: [TaskStatusSettingsTabComponent],
      providers: [{ provide: TaskApiService, useValue: { getStatuses, createStatus: vi.fn(), deleteStatus: vi.fn(), reorderTaskStatuses: vi.fn() } }]
    });
    const fixture = TestBed.createComponent(TaskStatusSettingsTabComponent);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getStatuses).toHaveBeenCalledWith('project-1');
    expect(fixture.nativeElement.textContent).toContain('Task statuses');
  });
});

