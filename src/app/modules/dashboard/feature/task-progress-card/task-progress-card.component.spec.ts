import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TaskProgressApiService } from '../../data-access/task-progress-api.service';
import { TaskProgressResponse } from '../../models/task-progress.model';
import { TaskProgressCardComponent } from './task-progress-card.component';

function makeProgress(overrides: Partial<TaskProgressResponse> = {}): TaskProgressResponse {
  return { completed: 3, inProgress: 2, notStarted: 1, overdue: 1, total: 7, ...overrides };
}

describe('TaskProgressCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(response: TaskProgressResponse | 'error'): Promise<{
    fixture: ComponentFixture<TaskProgressCardComponent>;
    getMyTaskProgress: ReturnType<typeof vi.fn>;
  }> {
    const getMyTaskProgress = vi.fn(() =>
      response === 'error' ? throwError(() => new Error('network error')) : of(response)
    );

    await TestBed.configureTestingModule({
      imports: [TaskProgressCardComponent],
      providers: [{ provide: TaskProgressApiService, useValue: { getMyTaskProgress } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskProgressCardComponent);
    fixture.detectChanges();
    return { fixture, getMyTaskProgress };
  }

  it('loads task progress on init', async () => {
    const { getMyTaskProgress } = await setup(makeProgress());
    expect(getMyTaskProgress).toHaveBeenCalledOnce();
  });

  it('shows the empty state when there are no assigned tasks', async () => {
    const { fixture } = await setup(makeProgress({ completed: 0, inProgress: 0, notStarted: 0, overdue: 0, total: 0 }));
    expect(fixture.nativeElement.querySelector('[data-testid="task-progress-empty"]')).not.toBeNull();
  });

  it('computes the completion percentage from completed/total', async () => {
    const { fixture } = await setup(makeProgress({ completed: 3, total: 7 }));
    const percent = fixture.nativeElement.querySelector('[data-testid="task-progress-percent"]');
    expect(percent.textContent.trim()).toBe('43%'); // round(3/7 * 100)
  });

  it('renders one donut segment per non-zero bucket', async () => {
    const { fixture } = await setup(makeProgress({ completed: 3, inProgress: 2, overdue: 1, notStarted: 1, total: 7 }));
    const segments = fixture.nativeElement.querySelectorAll('[data-testid="task-progress-segment"]');
    expect(segments.length).toBe(4);
  });

  it('omits a donut segment for a zero-count bucket', async () => {
    const { fixture } = await setup(makeProgress({ completed: 5, inProgress: 0, overdue: 0, notStarted: 2, total: 7 }));
    const segments = fixture.nativeElement.querySelectorAll('[data-testid="task-progress-segment"]');
    const buckets = Array.from(segments).map((el) => (el as HTMLElement).getAttribute('data-bucket'));
    expect(buckets).toEqual(['completed', 'notStarted']);
  });

  it('falls back to the empty state when the request fails', async () => {
    const { fixture } = await setup('error');
    expect(fixture.nativeElement.querySelector('[data-testid="task-progress-empty"]')).not.toBeNull();
  });
});
