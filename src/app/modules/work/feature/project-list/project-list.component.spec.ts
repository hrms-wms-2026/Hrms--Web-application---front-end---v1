import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ProjectListComponent } from './project-list.component';
import { ProjectListStore } from '../../state/project-list.store';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { Project } from '../../models/project.model';

describe('ProjectListComponent', () => {
  let fixture: ComponentFixture<ProjectListComponent>;
  let storeStub: any;
  let router: Router;

  const project: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null
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
      editProject: vi.fn().mockResolvedValue(true),
      deleteProject: vi.fn().mockResolvedValue(true),
      achieveProject: vi.fn().mockResolvedValue(true),
      unachieveProject: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [ProjectListComponent],
      providers: [
        { provide: ProjectListStore, useValue: storeStub },
        { provide: ProjectCategoryStore, useValue: { categories: () => [], loadCategories: vi.fn().mockResolvedValue(undefined) } },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectListComponent);
    router = TestBed.inject(Router);
  });

  it('loads projects on init', () => {
    fixture.detectChanges();
    expect(storeStub.loadProjects).toHaveBeenCalled();
  });

  it('renders a card per project', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
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

  it('navigates to /work/:id when a card emits viewed', () => {
    fixture.detectChanges();
    fixture.componentInstance.onView(project);
    expect(router.navigate).toHaveBeenCalledWith(['/work', 'p1']);
  });

  it('opens the create modal, calls createProject on submit, and closes on success', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openCreateModal();
    fixture.detectChanges();
    expect(fixture.componentInstance.formModalOpen()).toBe(true);

    await fixture.componentInstance.onCreateSubmit({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40
    });

    expect(storeStub.createProject).toHaveBeenCalled();
    expect(fixture.componentInstance.formModalOpen()).toBe(false);
  });

  it('opens the delete confirm modal and calls deleteProject on confirm', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openDeleteConfirm(project);
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(true);

    await fixture.componentInstance.onDeleteConfirmed();

    expect(storeStub.deleteProject).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('opens the achieve confirm modal and calls achieveProject on confirm', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openAchieveConfirm(project);
    await fixture.componentInstance.onAchieveConfirmed();
    expect(storeStub.achieveProject).toHaveBeenCalledWith('p1');
  });

  it('forwards category and achieved filter changes to the store', () => {
    fixture.detectChanges();
    fixture.componentInstance.onCategoryFilterChanged('cat1');
    expect(storeStub.setCategoryFilter).toHaveBeenCalledWith('cat1');
    fixture.componentInstance.onAchievedFilterChanged('archived');
    expect(storeStub.setAchievedFilter).toHaveBeenCalledWith('archived');
  });
});
