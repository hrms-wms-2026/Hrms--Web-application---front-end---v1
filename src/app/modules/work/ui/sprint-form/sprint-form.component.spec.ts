import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SprintFormComponent } from './sprint-form.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';

describe('SprintFormComponent', () => {
  let fixture: ComponentFixture<SprintFormComponent>;
  let storeStub: { error: ReturnType<typeof signal>; create: ReturnType<typeof vi.fn>; edit: ReturnType<typeof vi.fn> };

  const sprint: Sprint = {
    id: 'sp-1', projectId: 'p-1', name: 'Sprint One', goal: null,
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    endDate: new Date('2026-09-14T00:00:00.000Z'), status: 'active', completedAt: null, achievedAt: null, canManage: true
  };

  function setup(overrides: Record<string, unknown> = {}): void {
    storeStub = {
      error: signal(null),
      create: vi.fn().mockResolvedValue(true),
      edit: vi.fn().mockResolvedValue(true)
    };
    TestBed.configureTestingModule({
      imports: [SprintFormComponent],
      providers: [{ provide: SprintListStore, useValue: storeStub }]
    });
    fixture = TestBed.createComponent(SprintFormComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('projectId', 'p-1');
    for (const [key, value] of Object.entries(overrides)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  }

  it('renders create mode with module options and emits created after store create', async () => {
    setup({ modules: [
      { objectiveId: 'obj-1', title: 'Module One', isOwner: true },
      { objectiveId: 'obj-2', title: 'Module Two', isOwner: false }
    ] });
    const component = fixture.componentInstance as any;
    component.selectedObjectiveId.set('obj-1');
    component.name.set('Sprint X');
    component.goal.set('Ship it');
    const created = vi.fn();
    component.created.subscribe(created);

    await component.submit();

    expect(storeStub.create).toHaveBeenCalledWith('p-1', { name: 'Sprint X', goal: 'Ship it' });
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('requires a module in create mode when a module list is provided', async () => {
    setup({ modules: [{ objectiveId: 'obj-1', title: 'Module One', isOwner: true }] });
    const component = fixture.componentInstance as any;
    component.name.set('Sprint X');
    await component.submit();

    expect(storeStub.create).not.toHaveBeenCalled();
    expect(component.moduleError()).toContain('Select a module');
  });

  it('renders edit mode without a module picker and emits saved with the edit payload', async () => {
    setup({ mode: 'edit', sprint });
    const component = fixture.componentInstance as any;
    component.name.set('Sprint One Renamed');
    const saved = vi.fn();
    component.saved.subscribe(saved);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-select')).toBeNull();
    await component.submit();

    expect(storeStub.edit).toHaveBeenCalledWith('sp-1', { name: 'Sprint One Renamed', goal: null, startDate: '2026-09-01', endDate: '2026-09-14' }, 'p-1');
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('re-seeds edit fields when a different sprint arrives while open', () => {
    setup({ mode: 'edit', sprint });
    const other = { ...sprint, id: 'sp-2', name: 'Sprint Two' };
    fixture.componentRef.setInput('sprint', other);
    fixture.detectChanges();

    expect((fixture.componentInstance as any).name()).toBe('Sprint Two');
  });

  it('renders date range picker in edit mode for active sprint and updates dates on rangeChange', async () => {
    setup({ mode: 'edit', sprint });
    const component = fixture.componentInstance as any;
    expect(fixture.nativeElement.querySelector('app-date-range-picker')).not.toBeNull();

    component.onDateRangeChange({ from: '2026-09-05', to: '2026-09-20' });
    expect(component.startDate()).toBe('2026-09-05');
    expect(component.endDate()).toBe('2026-09-20');

    await component.submit();
    expect(storeStub.edit).toHaveBeenCalledWith('sp-1', { name: 'Sprint One', goal: null, startDate: '2026-09-05', endDate: '2026-09-20' }, 'p-1');
  });
});
