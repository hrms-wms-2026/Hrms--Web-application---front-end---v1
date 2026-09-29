import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DraftChip, DraftsStore } from '../../../shared/state/drafts.store';
import { DraftModalHostComponent } from './draft-modal-host.component';
import { TaskFormModalComponent } from '../../../modules/work/ui/task-form-modal/task-form-modal.component';
import { AddEmployeeWizardComponent } from '../../../modules/people/feature/add-employee-wizard/add-employee-wizard.component';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  template: '<div data-testid="stub-task-modal"></div>'
})
class StubTaskFormModalComponent {
  open = input(false);
  mode = input('create');
  projectId = input('');
  draftId = input('');
  created = output<void>();
  saved = output<void>();
  closed = output<void>();
}

@Component({
  selector: 'app-add-employee-wizard',
  standalone: true,
  template: '<div data-testid="stub-add-employee-wizard"></div>'
})
class StubAddEmployeeWizardComponent {
  isModal = input(true);
  initialDraftId = input<string | null>(null);
  closed = output<void>();
  saved = output<{ finalized: boolean; draftId?: string }>();
}

describe('DraftModalHostComponent', () => {
  let fixture: ComponentFixture<DraftModalHostComponent>;
  const activeDraft = signal<DraftChip | null>(null);
  const storeStub = {
    activeDraft,
    closeDraft: vi.fn(() => activeDraft.set(null)),
    load: vi.fn(async () => {})
  };

  beforeEach(() => {
    activeDraft.set(null);
    storeStub.closeDraft.mockClear();
    storeStub.load.mockClear();

    TestBed.configureTestingModule({
      imports: [DraftModalHostComponent],
      providers: [{ provide: DraftsStore, useValue: storeStub }]
    })
      .overrideComponent(DraftModalHostComponent, {
        remove: { imports: [TaskFormModalComponent, AddEmployeeWizardComponent] },
        add: { imports: [StubTaskFormModalComponent, StubAddEmployeeWizardComponent] }
      });

    fixture = TestBed.createComponent(DraftModalHostComponent);
    fixture.detectChanges();
  });

  it('renders nothing when activeDraft is null', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="stub-task-modal"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="stub-add-employee-wizard"]')).toBeNull();
  });

  it('renders task modal when activeDraft is a task draft', () => {
    activeDraft.set({ kind: 'task', id: 't-123', label: 'Task Draft', badge: null, projectId: 'proj-1' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="stub-task-modal"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="stub-add-employee-wizard"]')).toBeNull();
  });

  it('renders add-employee wizard when activeDraft is an employee draft', () => {
    activeDraft.set({ kind: 'employee', id: 'emp-123', label: 'Jane Doe', badge: null, projectId: null });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="stub-add-employee-wizard"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="stub-task-modal"]')).toBeNull();
  });

  it('calls closeDraft on close', () => {
    activeDraft.set({ kind: 'task', id: 't-123', label: 'Task Draft', badge: null, projectId: 'proj-1' });
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { onClose: () => void }).onClose();
    expect(storeStub.closeDraft).toHaveBeenCalled();
  });

  it('calls closeDraft and load on done', () => {
    activeDraft.set({ kind: 'task', id: 't-123', label: 'Task Draft', badge: null, projectId: 'proj-1' });
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { onDone: () => void }).onDone();
    expect(storeStub.closeDraft).toHaveBeenCalled();
    expect(storeStub.load).toHaveBeenCalled();
  });
});
