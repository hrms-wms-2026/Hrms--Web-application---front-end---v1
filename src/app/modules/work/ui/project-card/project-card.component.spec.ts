import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectCardComponent } from './project-card.component';
import { Project } from '../../models/project.model';
import { ProjectApiService } from '../../data-access/project-api.service';

describe('ProjectCardComponent', () => {
  let fixture: ComponentFixture<ProjectCardComponent>;

  const baseProject: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 10, isLead: false, isAchieved: false, achievedAt: null, updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectCardComponent],
      providers: [{
        provide: ProjectApiService,
        useValue: { getLogoUrl: (id: string, fileId: string) => `https://api.test/work/projects/${id}/logo?v=${fileId}` }
      }]
    });
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

  it('shows the real logo image when logoFileId is set', () => {
    fixture.componentRef.setInput('project', { ...baseProject, logoFileId: 'file-1' });
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('[data-testid="project-logo"]') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.src).toBe('https://api.test/work/projects/p1/logo?v=file-1');
    expect(fixture.nativeElement.querySelector('[data-testid="fallback-banner"]')).toBeNull();
  });

  it('shows the animated fallback banner when logoFileId is not set', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="project-logo"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="fallback-banner"]')).not.toBeNull();
  });

  it('seeds the fallback banner accent from the project color when set', () => {
    fixture.componentRef.setInput('project', { ...baseProject, color: '#EF4444' });
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="fallback-banner"]') as HTMLElement;
    expect(banner.style.getPropertyValue('--banner-color').trim()).toBe('#EF4444');
  });

  it('falls back to a default accent when the project has no color', () => {
    fixture.componentRef.setInput('project', { ...baseProject, color: null });
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[data-testid="fallback-banner"]') as HTMLElement;
    expect(banner.style.getPropertyValue('--banner-color').trim()).toBe('#3B82F6');
  });

  it('shows an Active status pill when the project is not achieved', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    const pill = fixture.nativeElement.querySelector('[data-testid="status-pill"]');
    expect(pill.textContent.trim()).toBe('Active');
  });

  it('shows an Achieved status pill when the project is achieved', () => {
    fixture.componentRef.setInput('project', { ...baseProject, isAchieved: true });
    fixture.detectChanges();
    const pill = fixture.nativeElement.querySelector('[data-testid="status-pill"]');
    expect(pill.textContent.trim()).toBe('Achieved');
  });

  it('shows relative updated-at text when updatedAt is set', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T12:00:00Z'));
    try {
      fixture.componentRef.setInput('project', { ...baseProject, updatedAt: '2026-08-08T12:00:00Z' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="updated-at"]').textContent.trim()).toBe('Updated 5 days ago');
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides updated-at text when updatedAt is null', () => {
    fixture.componentRef.setInput('project', { ...baseProject, updatedAt: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="updated-at"]')).toBeNull();
  });

  it('shows the description when set', () => {
    fixture.componentRef.setInput('project', { ...baseProject, description: 'Rebuild the marketing site' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="description"]').textContent.trim()).toBe('Rebuild the marketing site');
  });

  it('truncates the description with line-clamp when collapsed', () => {
    fixture.componentRef.setInput('project', { ...baseProject, description: 'Rebuild the marketing site' });
    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="description"]').className).toContain('line-clamp-2');
  });

  it('does not truncate the description when expanded', () => {
    fixture.componentRef.setInput('project', { ...baseProject, description: 'Rebuild the marketing site' });
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="description"]').className).not.toContain('line-clamp-2');
  });

  it('hides the description block when there is no description', () => {
    fixture.componentRef.setInput('project', { ...baseProject, description: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="description"]')).toBeNull();
  });

  it('renders a tag chip per label', () => {
    fixture.componentRef.setInput('project', {
      ...baseProject,
      labels: [{ id: 'l1', name: 'Marketing', color: '#F59E0B' }, { id: 'l2', name: 'Personal', color: '#8B5CF6' }]
    });
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('[data-testid="tag-chip"]');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent.trim()).toBe('Marketing');
    expect(chips[1].textContent.trim()).toBe('Personal');
  });

  it('renders no tag chips when there are no labels', () => {
    fixture.componentRef.setInput('project', { ...baseProject, labels: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="tag-chip"]').length).toBe(0);
  });

  it('renders the avatar stack when there are members', () => {
    fixture.componentRef.setInput('project', {
      ...baseProject, members: [{ userId: 'u2', displayName: 'Arun Kumar' }], memberCount: 1
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-avatar-stack')).not.toBeNull();
  });

  it('hides the avatar stack when there are no members', () => {
    fixture.componentRef.setInput('project', { ...baseProject, members: [], memberCount: 0 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-avatar-stack')).toBeNull();
  });

  it('shows the full member name list only when expanded', () => {
    const members = [{ userId: 'u2', displayName: 'Arun Kumar' }];
    fixture.componentRef.setInput('project', { ...baseProject, members, memberCount: 1 });

    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="member-list"]')).toBeNull();

    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    const list = fixture.nativeElement.querySelector('[data-testid="member-list"]');
    expect(list).not.toBeNull();
    expect(list.textContent).toContain('Arun Kumar');
  });

  it('emits toggleExpandRequested when the expand toggle is clicked', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    let toggled = 0;
    fixture.componentInstance.toggleExpandRequested.subscribe(() => toggled++);

    (fixture.nativeElement.querySelector('[data-testid="expand-toggle"]') as HTMLButtonElement).click();

    expect(toggled).toBe(1);
  });

  it('does not emit toggleExpandRequested when View or Settings is clicked', () => {
    fixture.componentRef.setInput('project', { ...baseProject, isLead: true });
    fixture.detectChanges();
    let toggled = 0;
    fixture.componentInstance.toggleExpandRequested.subscribe(() => toggled++);

    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="settings-button"] button') as HTMLButtonElement).click();

    expect(toggled).toBe(0);
  });
});
