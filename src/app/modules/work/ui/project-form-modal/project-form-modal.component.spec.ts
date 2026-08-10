import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectFormModalComponent } from './project-form-modal.component';
import { ProjectCategoryStore } from '../../state/project-category.store';

describe('ProjectFormModalComponent', () => {
  let fixture: ComponentFixture<ProjectFormModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectFormModalComponent],
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: () => Promise.resolve() } }]
    });
    fixture = TestBed.createComponent(ProjectFormModalComponent);
    fixture.componentRef.setInput('open', true);
  });

  function setField(testId: string, value: string): void {
    const el: HTMLInputElement | HTMLSelectElement = fixture.nativeElement.querySelector(`[data-testid="${testId}"] input, [data-testid="${testId}"] select`);
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  it('shows identifier, release date, color, and logo fields', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="identifier-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="color-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="logo-field"]')).not.toBeNull();
  });

  it('resets fields every time the modal opens', () => {
    fixture.detectChanges();
    setField('name-field', 'Website Revamp');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="name-field"] input');
    expect(nameInput.value).toBe('');
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

  it('emits createSubmitted with the entered color and the selected logo file', () => {
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
    setField('color-field', '#2563EB');

    const logoFile = new File(['fake'], 'logo.png', { type: 'image/png' });
    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="logo-field"] input[type="file"]');
    Object.defineProperty(fileInput, 'files', { value: [logoFile] });
    fileInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.color).toBe('#2563EB');
    expect(emitted.logoFile).toBe(logoFile);
  });

  it('emits closed when cancelled', () => {
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
