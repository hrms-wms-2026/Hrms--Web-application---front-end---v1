import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TaskStatusChangeRequestsPanelComponent } from './task-status-change-requests-panel.component';
import { TaskStatusChangeRequestApiService } from '../../data-access/task-status-change-request-api.service';
import { TaskStatusChangeRequestDto } from '../../models/dto/task-status-change-request.dto';

describe('TaskStatusChangeRequestsPanelComponent', () => {
  const request = (id: string, canDecide = true): TaskStatusChangeRequestDto => ({
    id,
    projectId: 'project-1',
    status: 'pending',
    requestedByEmployeeId: 'emp-1',
    requesterDisplayName: 'Kim Rao',
    note: 'need a QA column',
    changes: {
      adds: [{ tempKey: 'new-1', name: 'QA', category: 'active', color: '#7C3AED', visibility: 'public' }],
      updates: [],
      deletes: [],
      baseOrder: ['a'],
      order: ['a', 'new-1'],
    },
    createdAt: '2026-09-25T10:00:00Z',
    decidedByEmployeeId: null,
    decisionComment: null,
    decidedAt: null,
    canDecide,
    canCancel: false,
  });

  function setup(requests: TaskStatusChangeRequestDto[]) {
    const api = {
      getForProject: vi.fn().mockReturnValue(of({ canEditDirectly: true, canRequest: false, requests })),
      approve: vi.fn().mockReturnValue(of([])),
      reject: vi.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      imports: [TaskStatusChangeRequestsPanelComponent],
      providers: [{ provide: TaskStatusChangeRequestApiService, useValue: api }],
    });
    const fixture = TestBed.createComponent(TaskStatusChangeRequestsPanelComponent);
    fixture.componentRef.setInput('projectId', 'project-1');
    const counts: number[] = [];
    fixture.componentInstance.countChange.subscribe((c) => counts.push(c));
    fixture.detectChanges();
    return { fixture, api, counts, component: fixture.componentInstance as any };
  }

  it('lists decidable requests with their described changes and reports the count', async () => {
    const { fixture, counts } = setup([request('r1'), request('r2', false)]);
    await fixture.whenStable();
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('article');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Kim Rao');
    expect(cards[0].textContent).toContain('Add "QA" (Active)');
    expect(cards[0].textContent).toContain('need a QA column');
    expect(counts.at(-1)).toBe(1);
  });

  it('approves and refetches so requests outdated by the approval disappear too', async () => {
    const { fixture, api, component } = setup([request('r1'), request('r2')]);
    await fixture.whenStable();
    api.getForProject.mockReturnValue(of({ canEditDirectly: true, canRequest: false, requests: [] }));

    await component.approve(request('r1'));
    fixture.detectChanges();

    expect(api.approve).toHaveBeenCalledWith('r1');
    expect(fixture.nativeElement.querySelectorAll('article')).toHaveLength(0);
  });

  it('shows the server error inline when approval conflicts', async () => {
    const { fixture, api, component } = setup([request('r1')]);
    await fixture.whenStable();
    api.approve.mockReturnValue(throwError(() => ({ status: 409, error: { detail: 'Move all tasks out of "QA" first.' } })));

    await component.approve(request('r1'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Move all tasks out');
  });

  it('rejects with an optional reason', async () => {
    const { fixture, api, component } = setup([request('r1')]);
    await fixture.whenStable();
    component.startReject(request('r1'));
    component.rejectComment.set('not needed');

    await component.reject(request('r1'));
    fixture.detectChanges();

    expect(api.reject).toHaveBeenCalledWith('r1', 'not needed');
    expect(fixture.nativeElement.querySelectorAll('article')).toHaveLength(0);
  });
});
