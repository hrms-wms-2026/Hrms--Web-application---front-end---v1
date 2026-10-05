import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectExplanationCardComponent } from './project-explanation-card.component';
import { Project } from '../../models/project.model';

describe('ProjectExplanationCardComponent', () => {
  let fixture: ComponentFixture<ProjectExplanationCardComponent>;

  const project: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1',
    description: 'Rebuild the marketing site.', leadId: 'lead-1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 10, isLead: true, isAchieved: false, achievedAt: null, updatedAt: null,
    logoFileId: null, labels: [],
    members: [{ userId: 'u2', displayName: 'Ada Lovelace', avatarFileId: null }], memberCount: 1
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProjectExplanationCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(ProjectExplanationCardComponent);
  });

  it('renders name, identifier, description, and member avatars', () => {
    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).toContain('WEB');
    expect(fixture.nativeElement.textContent).toContain('Rebuild the marketing site.');
  });

  it('shows View, Achieve, Settings, and Member for a lead on an active project', () => {
    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="member-button"]')).not.toBeNull();
  });

  it('hides Achieve, Settings, and Member when the caller is not the lead', () => {
    fixture.componentRef.setInput('project', { ...project, isLead: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="member-button"]')).toBeNull();
  });

  it('hides Achieve when the project is already achieved', () => {
    fixture.componentRef.setInput('project', { ...project, isAchieved: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).toBeNull();
  });

  it('emits viewed when View project is pressed', () => {
    fixture.componentRef.setInput('project', project);
    fixture.detectChanges();
    let viewed = false;
    fixture.componentInstance.viewed.subscribe(() => { viewed = true; });
    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    expect(viewed).toBe(true);
  });

  it('shows the project logo when one is set, from the same URL as the project cards', () => {
    fixture.componentRef.setInput('project', { ...project, logoFileId: 'logo-9' });
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('[data-testid="project-details-logo"]') as HTMLImageElement;
    expect(img.getAttribute('src')).toContain('/work/projects/' + project.id + '/logo?v=logo-9');
  });

  it('falls back to the initial when there is no logo or it fails to load', () => {
    fixture.componentRef.setInput('project', { ...project, logoFileId: 'logo-9' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="project-details-logo"]') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="project-details-logo"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(project.name.charAt(0).toUpperCase());
  });
});
