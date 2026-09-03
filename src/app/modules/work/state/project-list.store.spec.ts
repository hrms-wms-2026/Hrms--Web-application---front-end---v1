import { HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ProjectListStore } from './project-list.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectListItemDto, PagedResultDto } from '../models/dto/project.dto';
import { AddObjectiveMemberOutcomeDto } from '../models/dto/milestone.dto';

function memberAccepted(body: AddObjectiveMemberOutcomeDto = { alreadyMember: false, invitation: null }) {
  return of(new HttpResponse({ status: 202, body }));
}

describe('ProjectListStore', () => {
  const dto: ProjectListItemDto = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null, updatedAt: null,
    logoFileId: null, labels: [], members: [], memberCount: 0
  };
  const page: PagedResultDto<ProjectListItemDto> = {
    items: [dto], pageNumber: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNext: false, hasPrevious: false
  };

  function setup(apiOverrides: Partial<ProjectApiService> = {}) {
    TestBed.configureTestingModule({ providers: [{ provide: ProjectApiService, useValue: apiOverrides }] });
    return TestBed.inject(ProjectListStore);
  }

  it('loads projects successfully', async () => {
    const store = setup({ listMine: () => of(page) } as Partial<ProjectApiService>);
    await store.loadProjects();
    expect(store.projects()).toEqual([{
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null, leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null, updatedAt: null,
      logoFileId: null, labels: [], members: [], memberCount: 0
    }]);
    expect(store.totalCount()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('sets an error message on load failure', async () => {
    const store = setup({ listMine: () => throwError(() => ({ error: { detail: 'Server down' } })) } as Partial<ProjectApiService>);
    await store.loadProjects();
    expect(store.error()).toBe('Server down');
    expect(store.loading()).toBe(false);
  });

  it('filters projects client-side by selected category', async () => {
    const otherDto = { ...dto, id: 'p2', categoryId: 'cat2' };
    const twoItemPage = { ...page, items: [dto, otherDto], totalCount: 2 };
    const store = setup({ listMine: () => of(twoItemPage) } as Partial<ProjectApiService>);
    await store.loadProjects();

    expect(store.filteredProjects()).toHaveLength(2);
    store.setCategoryFilter('cat1');
    expect(store.filteredProjects()).toEqual([expect.objectContaining({ id: 'p1' })]);
    store.setCategoryFilter(null);
    expect(store.filteredProjects()).toHaveLength(2);
  });

  it('filters projects client-side by achieved status', async () => {
    const achievedDto = { ...dto, id: 'p2', isAchieved: true };
    const twoItemPage = { ...page, items: [dto, achievedDto], totalCount: 2 };
    const store = setup({ listMine: () => of(twoItemPage) } as Partial<ProjectApiService>);
    await store.loadProjects();

    expect(store.filteredProjects()).toHaveLength(2);
    store.setAchievedFilter('active');
    expect(store.filteredProjects().map((p) => p.id)).toEqual(['p1']);
    store.setAchievedFilter('archived');
    expect(store.filteredProjects().map((p) => p.id)).toEqual(['p2']);
    store.setAchievedFilter('all');
    expect(store.filteredProjects()).toHaveLength(2);
  });

  it('createProject returns true and the caller can reload on success', async () => {
    const store = setup({
      create: () => of({ project: { id: 'p1', name: 'Website Revamp' } }),
      listMine: () => of(page)
    } as Partial<ProjectApiService>);

    const result = await store.createProject({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40, logoFile: null, bannerFile: null, memberEmployeeIds: []
    });

    expect(result).toBe(true);
    expect(store.projects()).toHaveLength(1);
  });

  it('createProject invites staged members after the project is created', async () => {
    const addMember = vi.fn().mockReturnValue(memberAccepted());
    const store = setup({
      create: () => of({ project: { id: 'p1', name: 'Website Revamp' } }),
      addMember,
      listMine: () => of(page)
    } as Partial<ProjectApiService>);

    const result = await store.createProject({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: null, color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40, logoFile: null, bannerFile: null,
      memberEmployeeIds: ['e1', 'e2']
    });

    expect(result).toBe(true);
    expect(addMember).toHaveBeenCalledTimes(2);
    expect(addMember).toHaveBeenCalledWith('p1', 'e1');
    expect(addMember).toHaveBeenCalledWith('p1', 'e2');
  });

  it('createProject still returns true when a later staged invite fails', async () => {
    const addMember = vi.fn()
      .mockReturnValueOnce(memberAccepted())
      .mockReturnValueOnce(throwError(() => ({ error: { detail: 'already invited' } })));
    const store = setup({
      create: () => of({ project: { id: 'p1', name: 'Website Revamp' } }),
      addMember,
      listMine: () => of(page)
    } as Partial<ProjectApiService>);

    const result = await store.createProject({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: null, color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40, logoFile: null, bannerFile: null,
      memberEmployeeIds: ['e1', 'e2']
    });

    expect(result).toBe(true);
    expect(store.error()).toBe('already invited');
    expect(store.projects()).toHaveLength(1);
  });

  it('addProjectMember reloads the list on success', async () => {
    const store = setup({
      addMember: () => memberAccepted(),
      listMine: () => of(page)
    } as Partial<ProjectApiService>);
    expect(await store.addProjectMember('p1', 'e1')).toBe(true);
    expect(store.projects()).toHaveLength(1);
  });

  it('createProject returns false and sets error on failure, without touching the list', async () => {
    const store = setup({
      create: () => throwError(() => ({ error: { detail: 'identifier already used' } }))
    } as Partial<ProjectApiService>);

    const result = await store.createProject({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40, logoFile: null, bannerFile: null, memberEmployeeIds: []
    });

    expect(result).toBe(false);
    expect(store.error()).toBe('identifier already used');
    expect(store.projects()).toEqual([]);
  });

  it('deleteProject reloads the list on success', async () => {
    const store = setup({ delete: () => of(void 0), listMine: () => of(page) } as Partial<ProjectApiService>);
    const result = await store.deleteProject('p1');
    expect(result).toBe(true);
    expect(store.projects()).toHaveLength(1);
  });

  it('achieveProject and unachieveProject reload the list on success', async () => {
    const store = setup({
      achieve: () => of(void 0), unachieve: () => of(void 0), listMine: () => of(page)
    } as Partial<ProjectApiService>);
    expect(await store.achieveProject('p1')).toBe(true);
    expect(await store.unachieveProject('p1')).toBe(true);
  });

  it('editProject reloads the list on success', async () => {
    const store = setup({
      edit: () => of({} as any), listMine: () => of(page)
    } as Partial<ProjectApiService>);
    const result = await store.editProject('p1', {
      name: 'Website Revamp v2', description: '', categoryId: 'cat1',
      startDate: '2026-08-01', targetDate: '2027-01-01', color: '', actualHours: 0, allocatedHours: 40
    });
    expect(result).toBe(true);
  });
});
