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

  it('loads and displays the objective statuses with their visibility', () => {
    expect(getStatuses).toHaveBeenCalledWith('obj-1');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('To Do');
    expect(text).toContain('Done');
  });

  it('defaults to the Task statuses tab and switches to Board structure on click', () => {
    expect(fixture.nativeElement.querySelector('.objective-settings__table')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-board-structure-editor')).toBeFalsy();

    const boardTab = fixture.nativeElement.querySelector('[data-testid="objective-settings-tab-board-structure"]') as HTMLButtonElement;
    boardTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-board-structure-editor')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.objective-settings__table')).toBeFalsy();

    const statusesTab = fixture.nativeElement.querySelector('[data-testid="objective-settings-tab-task-statuses"]') as HTMLButtonElement;
    statusesTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.objective-settings__table')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-board-structure-editor')).toBeFalsy();
  });
});
