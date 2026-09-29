import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MoveTasksToSprintDialogComponent, SprintMoveTarget } from './move-tasks-to-sprint-dialog.component';
import { Sprint } from '../../models/sprint.model';

describe('MoveTasksToSprintDialogComponent', () => {
  let fixture: ComponentFixture<MoveTasksToSprintDialogComponent>;

  const sprint: Sprint = {
    id: 'sp-1', objectiveId: 'obj-1', name: 'Sprint 6', goal: 'Hardware Integration',
    startDate: null, endDate: null, status: 'draft', completedAt: null, achievedAt: null
  };
  const target: SprintMoveTarget = { sprint, currentTaskCount: 5, currentHours: 31 };

  function setup(overrides: Record<string, unknown> = {}): void {
    TestBed.configureTestingModule({ imports: [MoveTasksToSprintDialogComponent] });
    fixture = TestBed.createComponent(MoveTasksToSprintDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('taskCount', 3);
    fixture.componentRef.setInput('totalEstimatedHours', 18);
    fixture.componentRef.setInput('targets', [target]);
    for (const [key, value] of Object.entries(overrides)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  }

  it('shows the selected task count and estimated hours', () => {
    setup();
    expect(fixture.nativeElement.textContent).toContain('3 tasks selected');
    expect(fixture.nativeElement.textContent).toContain('18h estimated');
  });

  it('lists each target sprint with its current task count and hours', () => {
    setup();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sprint 6');
    expect(text).toContain('DRAFT');
    expect(text).toContain('5 tasks');
    expect(text).toContain('31h planned');
  });

  it('does not emit moved until a sprint is selected', () => {
    setup();
    const movedSpy = vi.fn();
    fixture.componentInstance.moved.subscribe(movedSpy);

    expect((fixture.componentInstance as unknown as { selectedSprintId: () => string | null }).selectedSprintId()).toBeNull();

    (fixture.componentInstance as unknown as { confirm: () => void }).confirm();
    expect(movedSpy).not.toHaveBeenCalled();
  });

  it('emits moved with the chosen sprint id on confirm', () => {
    setup();
    const movedSpy = vi.fn();
    fixture.componentInstance.moved.subscribe(movedSpy);

    (fixture.nativeElement.querySelector('[data-testid="move-target-sp-1"]') as HTMLInputElement).click();
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { confirm: () => void }).confirm();

    expect(movedSpy).toHaveBeenCalledWith('sp-1');
  });

  it('shows a workload preview only for the selected sprint', () => {
    setup();
    expect(fixture.nativeElement.textContent).not.toContain('After');

    (fixture.nativeElement.querySelector('[data-testid="move-target-sp-1"]') as HTMLInputElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Current 31h');
    expect(fixture.nativeElement.textContent).toContain('Adding +18h');
    expect(fixture.nativeElement.textContent).toContain('After 49h');
  });

  it('shows the blocked reason instead of the sprint list when set', () => {
    setup({ blockedReason: 'Select tasks from a single module to move them together.' });
    expect(fixture.nativeElement.textContent).toContain('Select tasks from a single module');
    expect(fixture.nativeElement.querySelector('[data-testid="move-target-sp-1"]')).toBeNull();
  });

  it('shows an empty-state message when there are no eligible sprints', () => {
    setup({ targets: [] });
    expect(fixture.nativeElement.textContent).toContain('No draft sprints available');
  });

  it('resets the selection each time the dialog opens', () => {
    setup();
    (fixture.nativeElement.querySelector('[data-testid="move-target-sp-1"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect((fixture.componentInstance as unknown as { selectedSprintId: () => string | null }).selectedSprintId()).toBe('sp-1');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect((fixture.componentInstance as unknown as { selectedSprintId: () => string | null }).selectedSprintId()).toBeNull();
  });
});
