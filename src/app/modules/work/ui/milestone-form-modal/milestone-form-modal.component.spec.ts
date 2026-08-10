import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneFormModalComponent } from './milestone-form-modal.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneFormModalComponent', () => {
  let fixture: ComponentFixture<MilestoneFormModalComponent>;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    description: 'Scope the design work', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
    allocatedHours: 20, completedHours: 0, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MilestoneFormModalComponent] });
    fixture = TestBed.createComponent(MilestoneFormModalComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('prefills all fields including description from initialValue', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();

    const titleInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="title-field"] input');
    const descriptionInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="description-field"] input');
    expect(titleInput.value).toBe('Design Phase');
    expect(descriptionInput.value).toBe('Scope the design work');
  });

  it('blocks submit and shows a validation error when title is empty', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, title: '' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });

  it('emits submitted with the edited fields', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.submitted.subscribe((v: any) => (emitted = v));

    const titleInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="title-field"] input');
    titleInput.value = 'Design Phase v2';
    titleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.title).toBe('Design Phase v2');
    expect(emitted.description).toBe('Scope the design work');
    expect(emitted.allocatedHours).toBe(20);
  });

  it('emits closed when cancelled', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
