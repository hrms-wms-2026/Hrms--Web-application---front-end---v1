import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectFormModalComponent } from './project-form-modal.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

describe('ProjectFormModalComponent', () => {
  let fixture: ComponentFixture<ProjectFormModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectFormModalComponent],
      providers: [
        { provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: () => Promise.resolve() } },
        { provide: EmployeeDirectoryStore, useValue: { get: () => undefined, ensureLoaded: vi.fn().mockResolvedValue(undefined) } },
        { provide: PeopleApiService, useValue: { listEmployees: () => of({ items: [], totalCount: 0, page: 1, pageSize: 20 }) } }
      ]
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

  function chooseCategoryAndGoToDetails(): void {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="category-pill"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="next-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function fillDetails(): void {
    setField('name-field', 'Website Revamp');
    setField('identifier-field', 'WEB');
    setField('start-date-field', '2026-08-01');
    setField('target-date-field', '2026-12-01');
    setField('allocated-hours-field', '40');
  }

  it('shows category pills and no release date field', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="category-pill"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).toBeNull();
  });

  it('blocks Next on step 1 without a category', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="next-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Category is required.');
    expect(fixture.componentInstance.step()).toBe(1);
  });

  it('shows identifier, color, logo, and banner fields on the details step', () => {
    chooseCategoryAndGoToDetails();
    expect(fixture.nativeElement.querySelector('[data-testid="identifier-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="color-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="logo-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="banner-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).toBeNull();
  });

  it('resets fields and step every time the modal opens', () => {
    chooseCategoryAndGoToDetails();
    setField('name-field', 'Website Revamp');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.step()).toBe(1);
    expect(fixture.componentInstance.name()).toBe('');
  });

  it('blocks Next on details when required fields are missing', () => {
    chooseCategoryAndGoToDetails();
    (fixture.nativeElement.querySelector('[data-testid="next-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Name is required.');
    expect(fixture.componentInstance.step()).toBe(2);
  });

  it('emits createSubmitted from preview with null releaseDate and the selected banner', () => {
    let emitted: any;
    fixture.componentInstance.createSubmitted.subscribe((v: any) => (emitted = v));
    chooseCategoryAndGoToDetails();
    fillDetails();
    setField('color-field', '#2563EB');

    const bannerFile = new File(['fake'], 'banner.png', { type: 'image/png' });
    const bannerInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="banner-field"] input[type="file"]');
    Object.defineProperty(bannerInput, 'files', { value: [bannerFile] });
    bannerInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="next-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="next-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.name).toBe('Website Revamp');
    expect(emitted.releaseDate).toBeNull();
    expect(emitted.bannerFile).toBe(bannerFile);
    expect(emitted.memberEmployeeIds).toEqual([]);
  });

  it('emits closed when cancelled', () => {
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
