import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SprintEditFormComponent } from './sprint-edit-form.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';

describe('SprintEditFormComponent', () => {
  let fixture: ComponentFixture<SprintEditFormComponent>;
  let storeStub: { error: ReturnType<typeof signal>; edit: ReturnType<typeof vi.fn> };

  const sprint: Sprint = {
    id: 'sp-1',
    objectiveId: 'obj-1',
    name: 'Sprint One',
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-09-14T00:00:00.000Z'),
    status: 'active',
    completedAt: null,
    achievedAt: null
  };

  function setup(edit: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(true)): void {
    storeStub = { error: signal(null), edit };
    TestBed.configureTestingModule({
      imports: [SprintEditFormComponent],
      providers: [{ provide: SprintListStore, useValue: storeStub }]
    });
    fixture = TestBed.createComponent(SprintEditFormComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('sprint', sprint);
    fixture.detectChanges();
  }

  it('prefills name/start/end from the sprint input when opened', () => {
    setup();

    expect((fixture.componentInstance as any).name()).toBe('Sprint One');
    expect((fixture.componentInstance as any).startDate()).toBe('2026-09-01');
    expect((fixture.componentInstance as any).endDate()).toBe('2026-09-14');
  });

  it('submits the edited name/start/end to the store and emits saved on success', async () => {
    const edit = vi.fn().mockResolvedValue(true);
    setup(edit);
    (fixture.componentInstance as any).name.set('Sprint One Renamed');
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    await fixture.componentInstance.submit();

    expect(edit).toHaveBeenCalledWith('sp-1', { name: 'Sprint One Renamed', startDate: '2026-09-01', endDate: '2026-09-14' }, 'obj-1', false);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('does not emit saved when the edit fails', async () => {
    const edit = vi.fn().mockResolvedValue(false);
    setup(edit);
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    await fixture.componentInstance.submit();

    expect(saved).not.toHaveBeenCalled();
  });

  it('emits cancelled when Cancel is pressed', () => {
    setup();
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    fixture.componentInstance.cancelled.emit();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('re-seeds the fields when a different sprint is passed in while still open', () => {
    setup();

    const otherSprint: Sprint = { ...sprint, id: 'sp-2', name: 'Sprint Two', startDate: new Date('2026-10-01T00:00:00.000Z'), endDate: new Date('2026-10-14T00:00:00.000Z') };
    fixture.componentRef.setInput('sprint', otherSprint);
    fixture.detectChanges();

    expect((fixture.componentInstance as any).name()).toBe('Sprint Two');
    expect((fixture.componentInstance as any).startDate()).toBe('2026-10-01');
  });
});
