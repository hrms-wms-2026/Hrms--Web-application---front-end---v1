import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneSettingsModalComponent } from './milestone-settings-modal.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneSettingsModalComponent', () => {
  let fixture: ComponentFixture<MilestoneSettingsModalComponent>;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    description: 'Scope the design work', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
    allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MilestoneSettingsModalComponent] });
    fixture = TestBed.createComponent(MilestoneSettingsModalComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('prefills fields and the Achieved toggle from initialValue', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isAchieved: true });
    fixture.detectChanges();

    const titleInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="title-field"] input');
    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    expect(titleInput.value).toBe('Design Phase');
    expect(achievedToggle.checked).toBe(true);
  });

  it('disables the Achieved toggle for the Default Milestone', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isDefault: true });
    fixture.detectChanges();
    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    expect(achievedToggle.disabled).toBe(true);
  });

  it('emits saved with achievedChanged:false when the toggle is untouched', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(false);
    expect(emitted.fields.title).toBe('Design Phase');
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

  it('emits saved with achievedChanged:true, achieved:false when toggled off', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isAchieved: true });
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    achievedToggle.checked = false;
    achievedToggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(true);
    expect(emitted.achieved).toBe(false);
  });

  it('blocks submit and shows a validation error when title is empty', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, title: '' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });

  it('emits closed when cancelled', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });

  it('shows "Module settings" as the modal title', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Module settings');
  });

  it('shows the Default-Module explanation for the default objective', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isDefault: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('the Default Module follows');
  });
});
