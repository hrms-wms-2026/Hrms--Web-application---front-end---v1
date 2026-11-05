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

  it('shows identifier, icon, logo, and banner fields and no colour swatches on the details step', () => {
    chooseCategoryAndGoToDetails();
    expect(fixture.nativeElement.querySelector('[data-testid="identifier-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="icon-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="logo-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="banner-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="color-field"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-color-swatch-picker')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).toBeNull();
  });

  describe('project picture', () => {
    const logo = new File(['fake'], 'logo.png', { type: 'image/png' });

    beforeEach(() => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logo');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    });

    afterEach(() => vi.restoreAllMocks());

    function uploadLogo(): void {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="logo-field"] input[type="file"]');
      Object.defineProperty(input, 'files', { value: [logo], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    it('replaces a picked icon when a logo is uploaded', () => {
      chooseCategoryAndGoToDetails();
      fixture.componentInstance.onIconChange('lucide:rocket');
      fixture.detectChanges();

      uploadLogo();

      expect(fixture.componentInstance.icon()).toBeNull();
      expect(fixture.componentInstance.logoFile()).toBe(logo);
      expect(fixture.nativeElement.querySelector('[data-testid="logo-preview"]').getAttribute('src')).toBe('blob:logo');
      expect(fixture.nativeElement.querySelector('[data-testid="icon-preview"]')).toBeNull();
    });

    it('replaces an uploaded logo when an icon or emoji is picked, and frees its preview', () => {
      chooseCategoryAndGoToDetails();
      uploadLogo();

      fixture.componentInstance.onIconChange('emoji:🚀');
      fixture.detectChanges();

      expect(fixture.componentInstance.logoFile()).toBeNull();
      expect(fixture.componentInstance.icon()).toBe('emoji:🚀');
      expect(fixture.nativeElement.querySelector('[data-testid="logo-preview"]')).toBeNull();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logo');
    });

    it('clears the picture with Remove', () => {
      chooseCategoryAndGoToDetails();
      expect(fixture.nativeElement.querySelector('[data-testid="remove-picture"]')).toBeNull();
      uploadLogo();

      (fixture.nativeElement.querySelector('[data-testid="remove-picture"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.componentInstance.logoFile()).toBeNull();
      expect(fixture.componentInstance.icon()).toBeNull();
    });

    it('clears the icon when the modal reopens', () => {
      chooseCategoryAndGoToDetails();
      fixture.componentInstance.onIconChange('lucide:rocket');

      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();

      expect(fixture.componentInstance.icon()).toBeNull();
    });
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

    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:banner');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const bannerFile = new File(['fake'], 'banner.png', { type: 'image/png' });
    const bannerInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="banner-field"] input[type="file"]');
    Object.defineProperty(bannerInput, 'files', { value: [bannerFile] });
    bannerInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="banner-preview"]').getAttribute('src')).toBe('blob:banner');

    (fixture.nativeElement.querySelector('[data-testid="next-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="next-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.name).toBe('Website Revamp');
    expect(emitted.releaseDate).toBeNull();
    expect(emitted.bannerFile).toBe(bannerFile);
    expect(emitted.memberEmployeeIds).toEqual([]);
    vi.restoreAllMocks();
  });

  it('clears a chosen banner with Remove', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:banner');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    chooseCategoryAndGoToDetails();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="banner-field"] input[type="file"]');
    Object.defineProperty(input, 'files', { value: [new File(['fake'], 'banner.png', { type: 'image/png' })], configurable: true });
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="remove-banner"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.bannerFile()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="banner-preview"]')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:banner');
    vi.restoreAllMocks();
  });

  it('emits closed when cancelled', () => {
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
