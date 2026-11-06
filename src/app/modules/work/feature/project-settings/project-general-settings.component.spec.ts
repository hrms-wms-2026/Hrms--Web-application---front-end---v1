import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProjectApiService } from '../../data-access/project-api.service';
import { ProjectDetail } from '../../models/project.model';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { ProjectGeneralSettingsComponent } from './project-general-settings.component';

describe('ProjectGeneralSettingsComponent', () => {
  let fixture: ComponentFixture<ProjectGeneralSettingsComponent>;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectGeneralSettingsComponent],
      providers: [{
        provide: ProjectCategoryStore,
        useValue: { categories: () => [{ id: 'cat1', name: 'Engineering' }], loadCategories: vi.fn().mockResolvedValue(undefined) }
      }, {
        provide: ProjectApiService,
        useValue: { getLogoUrl: (id: string, fileId: string) => `/logo/${id}/${fileId}` }
      }]
    });
    fixture = TestBed.createComponent(ProjectGeneralSettingsComponent);
    fixture.componentRef.setInput('project', project);
  });

  it('renders the project settings inline and emits an edit payload', () => {
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((value) => (emitted = value));

    const allocatedInput = fixture.nativeElement.querySelector('[data-testid="allocated-hours-field"] input') as HTMLInputElement;
    allocatedInput.value = '75';
    allocatedInput.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.fields.allocatedHours).toBe(75);
    expect(emitted.achievedChanged).toBe(false);
  });

  it('is read-only for a project member who is not the lead', () => {
    fixture.componentRef.setInput('project', { ...project, isLead: false });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Only the project lead can change these details.');
    expect(fixture.nativeElement.querySelector('[data-testid="submit-button"]')).toBeNull();
    expect((fixture.nativeElement.querySelector('[data-testid="name-field"] input') as HTMLInputElement).disabled).toBe(true);
  });

  describe('project picture', () => {
    const logo = new File(['fake'], 'logo.png', { type: 'image/png' });
    const withLogo = { ...project, logoFileId: 'f1' };
    let emitted: any;

    beforeEach(() => {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:logo');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
      emitted = undefined;
      fixture.componentInstance.saved.subscribe((value) => (emitted = value));
    });

    afterEach(() => vi.restoreAllMocks());

    const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

    function save(): void {
      (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    }

    function uploadLogo(): void {
      const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="logo-field"] input[type="file"]');
      Object.defineProperty(input, 'files', { value: [logo], configurable: true });
      input.dispatchEvent(new Event('change'));
      fixture.detectChanges();
    }

    it('has no colour controls and keeps the saved colour', () => {
      fixture.detectChanges();
      expect(el('color-field')).toBeNull();

      save();
      expect(emitted.fields.color).toBe('#2563EB');
    });

    it('shows the saved logo instead of the icon, and keeps it when nothing changes', () => {
      fixture.componentRef.setInput('project', { ...withLogo, icon: 'lucide:rocket' });
      fixture.detectChanges();
      expect(el('logo-preview').getAttribute('src')).toBe('/logo/p1/f1');
      expect(el('icon-preview')).toBeNull();

      save();
      expect(emitted.logoFile).toBeNull();
      expect(emitted.removeLogo).toBe(false);
      expect(emitted.fields.icon).toBe('');
    });

    it('replaces the icon when a logo is uploaded', () => {
      fixture.componentRef.setInput('project', { ...project, icon: 'lucide:rocket' });
      fixture.detectChanges();

      uploadLogo();
      expect(el('logo-preview').getAttribute('src')).toBe('blob:logo');

      save();
      expect(emitted.logoFile).toBe(logo);
      expect(emitted.fields.icon).toBe('');
    });

    it('replaces the saved logo when an icon is picked, leaving the delete to the server', () => {
      fixture.componentRef.setInput('project', withLogo);
      fixture.detectChanges();

      (fixture.componentInstance as unknown as { onIconChange(icon: string): void }).onIconChange('emoji:🚀');
      fixture.detectChanges();
      expect(el('logo-preview')).toBeNull();

      save();
      expect(emitted.fields.icon).toBe('emoji:🚀');
      expect(emitted.logoFile).toBeNull();
      expect(emitted.removeLogo).toBe(false);
    });

    it('deletes the saved logo with Remove', () => {
      fixture.componentRef.setInput('project', withLogo);
      fixture.detectChanges();

      (el('remove-picture') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el('logo-preview')).toBeNull();

      save();
      expect(emitted.removeLogo).toBe(true);
    });

    it('hides the picture controls from a member who is not the lead', () => {
      fixture.componentRef.setInput('project', { ...withLogo, isLead: false });
      fixture.detectChanges();

      expect(el('logo-preview')).not.toBeNull();
      expect(el('logo-field')).toBeNull();
      expect(el('remove-picture')).toBeNull();
    });
  });
});
