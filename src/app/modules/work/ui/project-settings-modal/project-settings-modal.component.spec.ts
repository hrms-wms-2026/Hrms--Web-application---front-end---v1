import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectSettingsModalComponent } from './project-settings-modal.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { ProjectDetail } from '../../models/project.model';

describe('ProjectSettingsModalComponent', () => {
  let fixture: ComponentFixture<ProjectSettingsModalComponent>;

  const detail: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectSettingsModalComponent],
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: () => Promise.resolve() } }]
    });
    fixture = TestBed.createComponent(ProjectSettingsModalComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('prefills fields and the Achieved toggle from initialValue', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isAchieved: true });
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="name-field"] input');
    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    expect(nameInput.value).toBe('Website Revamp');
    expect(achievedToggle.checked).toBe(true);
  });

  it('emits saved with achievedChanged:false when the toggle is untouched', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(false);
    expect(emitted.fields.name).toBe('Website Revamp');
  });

  it('emits saved with achievedChanged:true, achieved:true when toggled on', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    achievedToggle.checked = true;
    achievedToggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(true);
    expect(emitted.achieved).toBe(true);
  });

  it('blocks submit and shows a validation error when name is empty', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, name: '' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Name is required.');
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
