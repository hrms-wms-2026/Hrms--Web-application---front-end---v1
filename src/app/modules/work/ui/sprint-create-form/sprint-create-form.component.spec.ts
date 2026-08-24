import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SprintCreateFormComponent } from './sprint-create-form.component';
import { SprintListStore } from '../../state/sprint-list.store';

describe('SprintCreateFormComponent', () => {
  let fixture: ComponentFixture<SprintCreateFormComponent>;
  let storeStub: { error: ReturnType<typeof signal>; create: ReturnType<typeof vi.fn> };

  function setup(isOwner: boolean, create: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(true)): void {
    storeStub = { error: signal(null), create };
    TestBed.configureTestingModule({
      imports: [SprintCreateFormComponent],
      providers: [{ provide: SprintListStore, useValue: storeStub }]
    });
    fixture = TestBed.createComponent(SprintCreateFormComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('isObjectiveOwner', isOwner);
    fixture.detectChanges();
  }

  it('submits the entered name/start/end to the store and emits created on success', async () => {
    const create = vi.fn().mockResolvedValue(true);
    setup(true, create);

    (fixture.componentInstance as any).newName.set('Sprint X');
    (fixture.componentInstance as any).newStart.set('2026-09-01');
    (fixture.componentInstance as any).newEnd.set('2026-09-14');
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);

    await fixture.componentInstance.submit();

    expect(create).toHaveBeenCalledWith('obj-1', { name: 'Sprint X', startDate: '2026-09-01', endDate: '2026-09-14' }, false);
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('passes activeOnly=true (member request-only mode) when not the objective owner', async () => {
    const create = vi.fn().mockResolvedValue(true);
    setup(false, create);

    await fixture.componentInstance.submit();

    expect(create).toHaveBeenCalledWith('obj-1', expect.anything(), true);
  });

  it('does not emit created and keeps the form values when create fails', async () => {
    const create = vi.fn().mockResolvedValue(false);
    setup(true, create);
    (fixture.componentInstance as any).newName.set('Sprint X');
    const created = vi.fn();
    fixture.componentInstance.created.subscribe(created);

    await fixture.componentInstance.submit();

    expect(created).not.toHaveBeenCalled();
    expect((fixture.componentInstance as any).newName()).toBe('Sprint X');
  });

  it('emits cancelled when Cancel is pressed', () => {
    setup(true);
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);

    fixture.componentInstance.cancelled.emit();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  describe('with a modules list (Backlog\'s project-wide context)', () => {
    function setupWithModules(create: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(true)): void {
      storeStub = { error: signal(null), create };
      TestBed.configureTestingModule({
        imports: [SprintCreateFormComponent],
        providers: [{ provide: SprintListStore, useValue: storeStub }]
      });
      fixture = TestBed.createComponent(SprintCreateFormComponent);
      fixture.componentRef.setInput('open', true);
      fixture.componentRef.setInput('modules', [
        { objectiveId: 'obj-1', title: 'Module One', isOwner: true },
        { objectiveId: 'obj-2', title: 'Module Two', isOwner: false }
      ]);
      fixture.detectChanges();
    }

    it('renders a Module dropdown with the given options', () => {
      setupWithModules();
      const options = Array.from(fixture.nativeElement.querySelectorAll('.sprint-create-form__select option') as NodeListOf<HTMLOptionElement>)
        .map((o) => o.textContent?.trim());
      expect(options).toEqual(['Select a module', 'Module One', 'Module Two']);
    });

    it('blocks submit with a field error until a module is selected', async () => {
      const create = vi.fn().mockResolvedValue(true);
      setupWithModules(create);

      await fixture.componentInstance.submit();

      expect(create).not.toHaveBeenCalled();
      expect((fixture.componentInstance as any).moduleError()).toBeTruthy();
    });

    it('creates the sprint under the selected module', async () => {
      const create = vi.fn().mockResolvedValue(true);
      setupWithModules(create);
      (fixture.componentInstance as any).selectedObjectiveId.set('obj-1');
      (fixture.componentInstance as any).newName.set('Sprint X');
      (fixture.componentInstance as any).newStart.set('2026-09-01');
      (fixture.componentInstance as any).newEnd.set('2026-09-14');

      await fixture.componentInstance.submit();

      expect(create).toHaveBeenCalledWith('obj-1', { name: 'Sprint X', startDate: '2026-09-01', endDate: '2026-09-14' }, false);
    });
  });
});
