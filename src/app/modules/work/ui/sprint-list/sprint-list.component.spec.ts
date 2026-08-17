import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SprintListComponent } from './sprint-list.component';
import { SprintListStore } from '../../state/sprint-list.store';

describe('SprintListComponent', () => {
  let fixture: ComponentFixture<SprintListComponent>;
  let storeStub: {
    sprints: ReturnType<typeof signal>;
    error: ReturnType<typeof signal>;
    loading: ReturnType<typeof signal>;
    load: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    edit: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    achieve: ReturnType<typeof vi.fn>;
  };

  function setup(isOwner: boolean, overrides: Partial<typeof storeStub> = {}): void {
    TestBed.resetTestingModule();
    storeStub = {
      sprints: signal([]),
      error: signal(null),
      loading: signal(false),
      load: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(false),
      edit: vi.fn(),
      complete: vi.fn().mockResolvedValue(undefined),
      achieve: vi.fn().mockResolvedValue(undefined),
      ...overrides
    };
    TestBed.configureTestingModule({
      imports: [SprintListComponent],
      providers: [
        {
          provide: SprintListStore,
          useValue: storeStub
        }
      ]
    });
    fixture = TestBed.createComponent(SprintListComponent);
    fixture.componentRef.setInput('objectiveId', 'o1');
    fixture.componentRef.setInput('isObjectiveOwner', isOwner);
    fixture.detectChanges();
  }

  it('owner sees a Create Sprint button', () => {
    setup(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Create sprint');
  });

  it('non-owner does not see a Create Sprint button', () => {
    setup(false);
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Create sprint');
  });

  it('emits sprintsChanged after a successful create', async () => {
    setup(true, { create: vi.fn().mockResolvedValue(true) });
    const emitted: unknown[] = [];
    fixture.componentInstance.sprintsChanged.subscribe(() => emitted.push(true));

    await fixture.componentInstance.submitCreate();

    expect(emitted).toHaveLength(1);
  });

  it('does not emit sprintsChanged when create fails', async () => {
    setup(true, { create: vi.fn().mockResolvedValue(false) });
    const emitted: unknown[] = [];
    fixture.componentInstance.sprintsChanged.subscribe(() => emitted.push(true));

    await fixture.componentInstance.submitCreate();

    expect(emitted).toHaveLength(0);
  });

  it('emits sprintsChanged after complete and achieve', async () => {
    setup(true, {
      complete: vi.fn().mockResolvedValue(true),
      achieve: vi.fn().mockResolvedValue(true)
    });
    const emitted: unknown[] = [];
    fixture.componentInstance.sprintsChanged.subscribe(() => emitted.push(true));

    await fixture.componentInstance.complete('sp-1');
    await fixture.componentInstance.achieve('sp-1');

    expect(emitted).toHaveLength(2);
  });
});
