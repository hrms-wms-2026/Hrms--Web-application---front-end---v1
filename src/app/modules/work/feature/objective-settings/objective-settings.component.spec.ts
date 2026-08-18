import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { ObjectiveSettingsComponent } from './objective-settings.component';
import { TaskApiService } from '../../data-access/task-api.service';

describe('ObjectiveSettingsComponent', () => {
  let fixture: ComponentFixture<ObjectiveSettingsComponent>;
  let getStatuses: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getStatuses = vi.fn().mockReturnValue(of([
      { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
      { id: 's2', name: 'Done', displayOrder: 3, requiresApproval: false, approverId: null, marksTaskComplete: true, visibility: 'private' }
    ]));

    await TestBed.configureTestingModule({
      imports: [ObjectiveSettingsComponent],
      providers: [
        { provide: TaskApiService, useValue: { getStatuses, createStatus: vi.fn(), deleteStatus: vi.fn(), reorderTaskStatuses: vi.fn().mockReturnValue(of([])) } },
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: { get: () => 'obj-1' } } }, snapshot: { paramMap: { get: () => null } } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ObjectiveSettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the objective statuses on init, feeding them into the (closed) board-structure-editor', () => {
    expect(getStatuses).toHaveBeenCalledWith('obj-1');
    expect(fixture.componentInstance['statuses']().map((s: { name: string }) => s.name)).toEqual(['To Do', 'Done']);
  });

  it('opens the board-structure-editor modal via the Edit button, which then shows the loaded statuses', () => {
    expect(fixture.componentInstance['editOpen']()).toBe(false);
    expect(fixture.nativeElement.querySelector('.board-structure__row')).toBeNull();

    const editButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.trim() === 'Edit')!;
    editButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance['editOpen']()).toBe(true);
    const names = Array.from(fixture.nativeElement.querySelectorAll('.board-structure__name') as NodeListOf<HTMLElement>)
      .map((el) => el.textContent?.trim());
    expect(names).toEqual(['To Do', 'Done']);
  });
});
