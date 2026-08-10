import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectCardComponent } from './project-card.component';
import { Project } from '../../models/project.model';

describe('ProjectCardComponent', () => {
  let fixture: ComponentFixture<ProjectCardComponent>;

  const baseProject: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 10, isLead: false, isAchieved: false, achievedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProjectCardComponent] });
    fixture = TestBed.createComponent(ProjectCardComponent);
  });

  it('renders the project name and identifier', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).toContain('WEB');
  });

  it('shows View but not Settings when the caller is not the lead', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
  });

  it('shows the Settings button when the caller is the lead', () => {
    fixture.componentRef.setInput('project', { ...baseProject, isLead: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).not.toBeNull();
  });

  it('emits viewed when View is pressed', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    let viewed = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    expect(viewed).toBe(true);
  });

  it('emits viewed/settingsRequested on button press', () => {
    fixture.componentRef.setInput('project', { ...baseProject, isLead: true });
    fixture.detectChanges();
    let viewed = false, settings = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    fixture.componentInstance.settingsRequested.subscribe(() => (settings = true));

    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="settings-button"] button') as HTMLButtonElement).click();

    expect(viewed).toBe(true);
    expect(settings).toBe(true);
  });

  it('shows an Achieved badge when the project is achieved', () => {
    fixture.componentRef.setInput('project', { ...baseProject, isAchieved: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Achieved');
  });
});
