import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SprintListComponent } from './sprint-list.component';
import { SprintListStore } from '../../state/sprint-list.store';

describe('SprintListComponent', () => {
  let fixture: ComponentFixture<SprintListComponent>;

  function setup(isOwner: boolean): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [SprintListComponent],
      providers: [
        {
          provide: SprintListStore,
          useValue: {
            sprints: signal([]),
            error: signal(null),
            loading: signal(false),
            load: vi.fn().mockResolvedValue(undefined),
            create: vi.fn(),
            edit: vi.fn(),
            complete: vi.fn(),
            achieve: vi.fn()
          }
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
});
