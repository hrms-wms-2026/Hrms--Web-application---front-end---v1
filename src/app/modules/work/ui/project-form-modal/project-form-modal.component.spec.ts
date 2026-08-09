import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectFormModalComponent } from './project-form-modal.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { ProjectDetail } from '../../models/project.model';

describe('ProjectFormModalComponent', () => {
  let fixture: ComponentFixture<ProjectFormModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectFormModalComponent],
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: () => Promise.resolve() } }]
    });
    fixture = TestBed.createComponent(ProjectFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('mode', 'create');
  });

  function setField(testId: string, value: string): void {
    const el: HTMLInputElement | HTMLSelectElement = fixture.nativeElement.querySelector(`[data-testid="${testId}"] input, [data-testid="${testId}"] select`);
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  it('shows identifier and release date fields only in create mode', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="identifier-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).not.toBeNull();

    fixture.componentRef.setInput('mode', 'edit');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="identifier-field"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).toBeNull();
  });

  it('prefills fields from initialValue in edit mode', () => {
    const initialValue: ProjectDetail = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
      description: 'Rebuild', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
    };
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', initialValue);
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="name-field"] input');
    expect(nameInput.value).toBe('Website Revamp');
  });

  it('clears prefilled fields when initialValue goes back to null (Edit closed, then Create opened)', () => {
    const initialValue: ProjectDetail = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
      description: 'Rebuild', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
    };
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', initialValue);
    fixture.detectChanges();

    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('initialValue', null);
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="name-field"] input');
    const categorySelect: HTMLSelectElement = fixture.nativeElement.querySelector('[data-testid="category-field"] select');
    const hoursInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="allocated-hours-field"] input');
    expect(nameInput.value).toBe('');
    expect(categorySelect.value).toBe('');
    expect(hoursInput.value).toBe('0');
  });

  it('blocks submit and shows validation errors when required fields are missing', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Name is required.');
  });

  it('emits createSubmitted with a fully-filled valid form', () => {
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.createSubmitted.subscribe((v: any) => (emitted = v));

    setField('name-field', 'Website Revamp');
    setField('identifier-field', 'WEB');
    setField('category-field', 'cat1');
    setField('start-date-field', '2026-08-01');
    setField('target-date-field', '2026-12-01');
    setField('release-date-field', '2026-11-15');
    setField('allocated-hours-field', '40');

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.name).toBe('Website Revamp');
    expect(emitted.identifier).toBe('WEB');
    expect(emitted.categoryId).toBe('cat1');
    expect(emitted.defaultObjectiveAllocatedHours).toBe(40);
  });

  it('emits closed when cancelled', () => {
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
