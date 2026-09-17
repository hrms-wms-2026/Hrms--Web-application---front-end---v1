import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { ProjectListComponent } from './project-list.component';
import { ProjectListStore } from '../../state/project-list.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { of } from 'rxjs';
import { Project } from '../../models/project.model';

describe('ProjectListComponent', () => {
  let fixture: ComponentFixture<ProjectListComponent>;
  let storeStub: any;
  let detailStoreStub: any;
  let router: Router;

  const project: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null, updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };

  beforeEach(async () => {
    storeStub = {
      filteredProjects: () => [project],
      loading: () => false,
      error: () => null,
      loadProjects: vi.fn().mockResolvedValue(undefined),
      setCategoryFilter: vi.fn(),
      setAchievedFilter: vi.fn(),
      createProject: vi.fn().mockResolvedValue(true),
      addProjectMember: vi.fn().mockResolvedValue(true),
      editProject: vi.fn().mockResolvedValue(true),
      deleteProject: vi.fn().mockResolvedValue(true),
      achieveProject: vi.fn().mockResolvedValue(true),
      unachieveProject: vi.fn().mockResolvedValue(true),
      getProjectDetail: vi.fn().mockResolvedValue(null)
    };

    detailStoreStub = {
      myInvitations: () => [],
      loadMyInvitations: vi.fn().mockResolvedValue(undefined),
      acceptInvitation: vi.fn().mockResolvedValue({ success: true }),
      rejectInvitation: vi.fn().mockResolvedValue({ success: true })
    };

    await TestBed.configureTestingModule({
      imports: [ProjectListComponent],
      providers: [
        { provide: ProjectListStore, useValue: storeStub },
        { provide: ProjectDetailStore, useValue: detailStoreStub },
        { provide: ProjectCategoryStore, useValue: { categories: () => [], loadCategories: vi.fn().mockResolvedValue(undefined) } },
        { provide: EmployeeDirectoryStore, useValue: { get: () => undefined, ensureLoaded: vi.fn().mockResolvedValue(undefined) } },
        { provide: PeopleApiService, useValue: { listEmployees: () => of({ items: [{ id: 'e2', fullName: 'Grace Hopper', email: 'g@x.com', departmentName: 'Eng' }], totalCount: 1, page: 1, pageSize: 20 }) } },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectListComponent);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('loads projects on init', () => {
    fixture.detectChanges();
    expect(storeStub.loadProjects).toHaveBeenCalled();
  });

  it('renders list view by default as the base view', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('list');
    expect(fixture.nativeElement.querySelector('[data-testid="project-list"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
  });

  it('cycles viewMode sequentially (list -> card -> table -> list) on button click and persists to localStorage', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('list');

    const cycleBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('[data-testid="work-view-cycle-btn"]');
    expect(cycleBtn).toBeTruthy();

    // 1st click: list -> card
    cycleBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('card');
    expect(localStorage.getItem('projects_view_mode')).toBe('card');

    // 2nd click: card -> table
    cycleBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('table');
    expect(localStorage.getItem('projects_view_mode')).toBe('table');

    // 3rd click: table -> list
    cycleBtn!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.viewMode()).toBe('list');
    expect(localStorage.getItem('projects_view_mode')).toBe('list');

    localStorage.removeItem('projects_view_mode');
  });

  it('renders a list row per project and auto-selects the first into the explanation card in list view', () => {
    fixture.componentInstance.setViewMode('list');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-project-card')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="project-list-row"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-testid="project-explanation-card"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
  });

  it('renders project cards in card view', () => {
    fixture.componentInstance.setViewMode('card');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-project-card')).not.toBeNull();
  });

  it('renders the Work / Projects breadcrumb header', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-breadcrumb-header')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Projects');
  });

  it('shows the loading state', () => {
    storeStub.loading = () => true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loader')).not.toBeNull();
  });

  it('shows the error state with retry wired to loadProjects', () => {
    storeStub.error = () => 'Failed to load projects.';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load projects.');
  });

  it('shows the empty state when there are no projects', () => {
    storeStub.filteredProjects = () => [];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No projects yet');
  });

  it('navigates to /work/:id when View project is requested', () => {
    fixture.detectChanges();
    fixture.componentInstance.onView(project);
    expect(router.navigate).toHaveBeenCalledWith(['/work', 'p1']);
  });

  it('selects a clicked row in the explanation card', () => {
    const other: Project = { ...project, id: 'p2', name: 'Mobile App' };
    storeStub.filteredProjects = () => [project, other];
    fixture.detectChanges();

    fixture.componentInstance.onSelectProject(other);
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedProject()?.id).toBe('p2');
    expect(fixture.nativeElement.textContent).toContain('Mobile App');
  });

  it('navigates into the project detail screen when an already selected project is clicked again', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedProject()?.id).toBe('p1');

    fixture.componentInstance.onSelectProject(project);

    expect(router.navigate).toHaveBeenCalledWith(['/work', 'p1']);
  });

  it('opens the members popup for a lead and invites the picked employee', async () => {
    fixture.componentInstance.setViewMode('list');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="member-button"]')).not.toBeNull();

    (fixture.nativeElement.querySelector('[data-testid="member-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.membersModalOpen()).toBe(true);

    (fixture.nativeElement.querySelector('[data-testid="add-member-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="employee-picker-row"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(storeStub.addProjectMember).toHaveBeenCalledWith('p1', 'e2');
  });

  it('opens the create modal, calls createProject on submit, and closes on success', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openCreateModal();
    fixture.detectChanges();
    expect(fixture.componentInstance.createModalOpen()).toBe(true);

    await fixture.componentInstance.onCreateSubmit({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40, logoFile: null, bannerFile: null, memberEmployeeIds: []
    });

    expect(storeStub.createProject).toHaveBeenCalled();
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
  });

  it('opens the settings modal and patches in the full detail once fetched', async () => {
    const detail = { ...project, description: 'Rebuild the marketing site.', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null };
    storeStub.getProjectDetail = vi.fn().mockResolvedValue(detail);
    fixture.detectChanges();

    fixture.componentInstance.onProjectSettingsRequested(project);

    expect(fixture.componentInstance.settingsModalOpen()).toBe(true);
    expect(storeStub.getProjectDetail).toHaveBeenCalledWith('p1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.settingsModalInitialValue() as any)?.description).toBe('Rebuild the marketing site.');
  });

  it('saves fields only when the Achieved toggle is untouched', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested(project);

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp v2', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0, allocatedHours: 40 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.editProject).toHaveBeenCalledWith('p1', {
      name: 'Website Revamp v2', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0, allocatedHours: 40
    });
    expect(storeStub.achieveProject).not.toHaveBeenCalled();
    expect(storeStub.unachieveProject).not.toHaveBeenCalled();
    expect(fixture.componentInstance.settingsModalOpen()).toBe(false);
  });

  it('edits then achieves when the toggle is turned on', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested(project);

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0, allocatedHours: 40 },
      achievedChanged: true, achieved: true
    });

    expect(storeStub.editProject).toHaveBeenCalled();
    expect(storeStub.achieveProject).toHaveBeenCalledWith('p1');
    expect(storeStub.unachieveProject).not.toHaveBeenCalled();
  });

  it('edits then unachieves when the toggle is turned off', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested({ ...project, isAchieved: true });

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0, allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(storeStub.unachieveProject).toHaveBeenCalledWith('p1');
  });

  it('stops and keeps the modal open if editProject fails', async () => {
    storeStub.editProject = vi.fn().mockResolvedValue(false);
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested(project);

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0, allocatedHours: 40 },
      achievedChanged: true, achieved: true
    });

    expect(storeStub.achieveProject).not.toHaveBeenCalled();
    expect(fixture.componentInstance.settingsModalOpen()).toBe(true);
  });

  it('opens the delete confirm modal and calls deleteProject on confirm', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openDeleteConfirm(project);
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(true);

    await fixture.componentInstance.onDeleteConfirmed();

    expect(storeStub.deleteProject).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('forwards category and achieved filter changes to the store', () => {
    fixture.detectChanges();
    fixture.componentInstance.onCategoryFilterChanged(['cat1', 'cat2']);
    expect(storeStub.setCategoryFilter).toHaveBeenCalledWith(['cat1', 'cat2']);
    fixture.componentInstance.onAchievedFilterChanged('archived');
    expect(storeStub.setAchievedFilter).toHaveBeenCalledWith('archived');
  });

  it('loads my invitations on init', () => {
    fixture.detectChanges();
    expect(detailStoreStub.loadMyInvitations).toHaveBeenCalled();
  });

  it('accepts an invitation then reloads invitations and the project list', async () => {
    fixture.detectChanges();
    await fixture.componentInstance.onAcceptInvitation('i1');

    expect(detailStoreStub.acceptInvitation).toHaveBeenCalledWith('i1');
    expect(detailStoreStub.loadMyInvitations).toHaveBeenCalledTimes(2);
    expect(storeStub.loadProjects).toHaveBeenCalledTimes(2);
  });

  it('rejects an invitation then reloads the invitation list', async () => {
    fixture.detectChanges();
    await fixture.componentInstance.onRejectInvitation('i1');

    expect(detailStoreStub.rejectInvitation).toHaveBeenCalledWith('i1');
    expect(detailStoreStub.loadMyInvitations).toHaveBeenCalledTimes(2);
  });
});
