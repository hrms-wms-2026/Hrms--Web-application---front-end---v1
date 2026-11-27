import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { ObjectiveMemberApiService } from '../data-access/objective-member-api.service';
import { SprintApiService } from '../data-access/sprint-api.service';
import { TaskApiService } from '../data-access/task-api.service';
import { buildObjectiveForest, findTreeNode, isLeafObjective, removeTreeNode, toMilestone, toProjectDetail, toSprintTreeNode, toTaskTreeNode, updateTreeNode } from '../utils/project.mapper';
import { toTaskStatusColumn } from '../utils/task.mapper';
import { ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode, ObjectiveDetail } from '../models/milestone.model';
import { EditObjectiveRequestDto, CreateObjectiveRequestDto, ObjectiveAssetDto } from '../models/dto/milestone.dto';
import { CompleteSprintRequestDto } from '../models/dto/sprint.dto';
import { isPendingApproval } from '../models/dto/work-approval.dto';
import { ObjectiveMemberItemDto } from '../models/dto/objective-invitation.dto';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

interface ProjectDetailState {
  readonly project: ProjectDetail | null;
  readonly projectLoading: boolean;
  readonly projectError: string | null;
  readonly milestones: readonly Milestone[];
  readonly milestonesLoading: boolean;
  readonly milestonesError: string | null;
  readonly selectedSubtree: MilestoneTreeNode | null;
  readonly subtreeLoading: boolean;
  readonly subtreeError: string | null;
  readonly milestoneActionError: string | null;
  readonly objectiveMembers: readonly ObjectiveMemberItemDto[];
  readonly objectiveMembersLoading: boolean;
  readonly objectiveMembersError: string | null;
  /** Union of every member across every module the caller can reach in this project (deduped
   *  by employeeId) - the assignee source for task-create flows everywhere (Tree/Board/Backlog),
   *  rather than whichever specific module a create-task click happened to be scoped to. Not
   *  scoped to the Default Objective alone: a parent-level member (owner or cascading access)
   *  needs to be able to assign tasks to people who only belong to a child module. */
  readonly projectMembers: readonly ObjectiveMemberItemDto[];
  readonly projectMembersLoading: boolean;
}

const initialState: ProjectDetailState = {
  project: null, projectLoading: false, projectError: null,
  milestones: [], milestonesLoading: false, milestonesError: null,
  selectedSubtree: null, subtreeLoading: false, subtreeError: null,
  milestoneActionError: null,
  objectiveMembers: [], objectiveMembersLoading: false, objectiveMembersError: null,
  projectMembers: [], projectMembersLoading: false
};

function extractError(err: unknown, fallback: string): string {
  return toSafeErrorMessage(err, fallback);
}

export const ProjectDetailStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectDetailState>(initialState),
  withMethods((
    store,
    api = inject(ProjectApiService),
    memberApi = inject(ObjectiveMemberApiService),
    sprintApi = inject(SprintApiService),
    taskApi = inject(TaskApiService)
  ) => {
    // Tree/Board/Backlog are sibling routes that each mount their own component (and re-run
    // their own ngOnInit) on every tab switch, all calling loadProjectMembers independently for
    // the same project - without this guard, switching tabs back and forth refetches the same
    // member list every single time.
    let membersLoadedForProjectId: string | null = null;

    return {
    async loadProject(id: string): Promise<void> {
      patchState(store, { projectLoading: true, projectError: null });
      try {
        const dto = await firstValueFrom(api.getById(id));
        patchState(store, { project: toProjectDetail(dto), projectLoading: false });
      } catch (err) {
        patchState(store, { projectError: extractError(err, 'Failed to load project.'), projectLoading: false, project: null });
      }
    },

    async loadMyMilestones(projectId: string): Promise<void> {
      patchState(store, { milestonesLoading: true, milestonesError: null });
      try {
        const dtos = await firstValueFrom(api.getMyMilestones(projectId));
        patchState(store, { milestones: dtos.map(toMilestone), milestonesLoading: false });
      } catch (err) {
        patchState(store, { milestonesError: extractError(err, 'Failed to load milestones.'), milestonesLoading: false });
      }
    },

    async loadProjectMembers(projectId: string): Promise<void> {
      if (membersLoadedForProjectId === projectId) return;

      patchState(store, { projectMembersLoading: true });
      try {
        const milestones = store.milestones().length > 0
          ? store.milestones()
          : (await firstValueFrom(api.getMyMilestones(projectId))).map(toMilestone);
        if (store.milestones().length === 0) patchState(store, { milestones });

        if (milestones.length === 0) {
          patchState(store, { projectMembers: [], projectMembersLoading: false });
          membersLoadedForProjectId = projectId;
          return;
        }

        // Union of every module's members across the whole tree (not just the Default
        // Objective): milestones already only lists what the caller can effectively reach
        // (cascading ownership - GetMyProjectMilestonesQueryHandler), so this is "everyone
        // assignable from here", not literally every employee in the project. A single
        // module's member-fetch failing shouldn't blank out everyone else's.
        const memberLists = await Promise.all(
          milestones.map((m) => firstValueFrom(memberApi.getMembers(m.objectiveId)).catch(() => ({ items: [] as ObjectiveMemberItemDto[] })))
        );
        const byEmployeeId = new Map<string, ObjectiveMemberItemDto>();
        for (const list of memberLists) {
          for (const member of list.items) {
            if (!member.pending && !byEmployeeId.has(member.employeeId)) byEmployeeId.set(member.employeeId, member);
          }
        }
        patchState(store, { projectMembers: Array.from(byEmployeeId.values()), projectMembersLoading: false });
        membersLoadedForProjectId = projectId;
      } catch {
        patchState(store, { projectMembers: [], projectMembersLoading: false });
      }
    },

    async loadProjectTree(projectId: string): Promise<void> {
      patchState(store, { subtreeLoading: true, subtreeError: null });
      try {
        const items = await firstValueFrom(api.getProjectTree(projectId));
        patchState(store, { selectedSubtree: buildObjectiveForest(items), subtreeLoading: false });
      } catch (err) {
        patchState(store, { subtreeError: extractError(err, 'Failed to load milestone.'), subtreeLoading: false });
      }
    },

    clearSelectedSubtree(): void {
      patchState(store, { selectedSubtree: null, subtreeError: null });
    },

    async getMilestoneDetail(id: string): Promise<ObjectiveDetail | null> {
      try {
        const detail = await firstValueFrom(api.getObjectiveById(id));
        patchState(store, { milestoneActionError: null });
        return detail;
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to load milestone.') });
        return null;
      }
    },

    async editMilestone(id: string, payload: EditObjectiveRequestDto): Promise<{ success: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(api.editObjective(id, payload));
        patchState(store, { milestoneActionError: null });
        return { success: true, pending: res.status === 202 };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to save changes.') });
        return { success: false, pending: false };
      }
    },

    async achieveMilestone(id: string): Promise<{ success: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(api.achieveObjective(id));
        patchState(store, { milestoneActionError: null });
        return { success: true, pending: res.status === 202 };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to achieve milestone.') });
        return { success: false, pending: false };
      }
    },

    async unachieveMilestone(id: string): Promise<{ success: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(api.unachieveObjective(id));
        patchState(store, { milestoneActionError: null });
        return { success: true, pending: res.status === 202 };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to unachieve milestone.') });
        return { success: false, pending: false };
      }
    },

    async createSubModule(payload: CreateObjectiveRequestDto): Promise<{ success: boolean; objectiveId?: string }> {
      try {
        const created = await firstValueFrom(api.createObjective(payload));
        patchState(store, { milestoneActionError: null });
        return { success: true, objectiveId: created.id };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to create sub-milestone.') });
        return { success: false };
      }
    },

    async uploadMilestoneAsset(objectiveId: string, file: File): Promise<{ success: boolean; asset?: ObjectiveAssetDto }> {
      try {
        const asset = await firstValueFrom(api.uploadObjectiveAsset(objectiveId, file));
        patchState(store, { milestoneActionError: null });
        return { success: true, asset };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to upload file.') });
        return { success: false };
      }
    },

    async deleteMilestoneAsset(objectiveId: string, assetId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(api.deleteObjectiveAsset(objectiveId, assetId));
        patchState(store, { milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to delete file.') });
        return { success: false };
      }
    },

    setMilestoneActionError(message: string | null): void {
      patchState(store, { milestoneActionError: message });
    },

    async loadObjectiveMembers(objectiveId: string): Promise<void> {
      patchState(store, { objectiveMembersLoading: true, objectiveMembersError: null });
      try {
        const dto = await firstValueFrom(memberApi.getMembers(objectiveId));
        patchState(store, { objectiveMembers: dto.items, objectiveMembersLoading: false });
      } catch (err) {
        patchState(store, { objectiveMembersError: extractError(err, 'Failed to load members.'), objectiveMembersLoading: false });
      }
    },

    async addObjectiveMember(objectiveId: string, employeeId: string): Promise<{ success: boolean; alreadyMember: boolean; applied: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(memberApi.addMember(objectiveId, employeeId));
        patchState(store, { milestoneActionError: null });
        const body = res.body!;
        return { success: true, alreadyMember: body.alreadyMember, applied: body.applied, pending: !body.alreadyMember && !body.applied };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to add member.') });
        return { success: false, alreadyMember: false, applied: false, pending: false };
      }
    },

    async removeObjectiveMember(objectiveId: string, employeeId: string): Promise<{ success: boolean; applied: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(memberApi.removeMember(objectiveId, employeeId));
        patchState(store, { milestoneActionError: null });
        // 204 = applied (ASP.NET drops a 204's body); 202 = sent for approval.
        const applied = res.status === 204 || !!res.body?.applied;
        return { success: true, applied, pending: !applied };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to remove member.') });
        return { success: false, applied: false, pending: false };
      }
    },

    async transferObjectiveHead(objectiveId: string, newHeadEmployeeId: string): Promise<{ success: boolean; applied: boolean; viaInvitation: boolean }> {
      try {
        const res = await firstValueFrom(memberApi.transferHead(objectiveId, newHeadEmployeeId));
        patchState(store, { milestoneActionError: null });
        // 204 = applied (ASP.NET drops a 204's body); 202 = leader invitation or sent for approval.
        return {
          success: true,
          applied: res.status === 204 || !!res.body?.applied,
          viaInvitation: !!res.body?.pendingInvitation
        };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to transfer leadership.') });
        return { success: false, applied: false, viaInvitation: false };
      }
    },

    async loadSprintsAndTasksForLeaf(objectiveId: string, options?: { force?: boolean }): Promise<void> {
      const tree = store.selectedSubtree();
      if (!tree) return;
      const target = findTreeNode(tree, objectiveId);
      if (!target || !isLeafObjective(target)) return;
      const state = target.sprintTaskLoadState;
      if (!options?.force && (state === 'loaded' || state === 'loading')) return;

      patchState(store, {
        selectedSubtree: updateTreeNode(tree, objectiveId, (node) => ({ ...node, sprintTaskLoadState: 'loading' }))
      });

      try {
        const [sprints, tasks, statuses] = await firstValueFrom(forkJoin([
          sprintApi.getByObjective(objectiveId, false),
          taskApi.getTasks(objectiveId),
          taskApi.getStatuses(store.project()?.id ?? '')
        ]));
        const current = store.selectedSubtree();
        if (!current) return;
        const leaf = findTreeNode(current, objectiveId);
        if (!leaf) return;
        const statusNames = Object.fromEntries(statuses.map((s) => [s.id, s.name]));
        const taskStatuses = statuses.map(toTaskStatusColumn);
        const parent = { ...leaf, statusNames, taskStatuses };
        const children = [
          ...sprints.map((sprint) => toSprintTreeNode(sprint, parent)),
          ...tasks
            .filter((task) => task.sprintId == null)
            .map((task) => toTaskTreeNode(task, parent, statusNames[task.statusId] ?? task.statusId))
        ];
        patchState(store, {
          selectedSubtree: updateTreeNode(current, objectiveId, (node) => ({
            ...node,
            children,
            sprintTaskLoadState: 'loaded',
            statusNames,
            taskStatuses
          }))
        });
      } catch {
        const current = store.selectedSubtree();
        if (!current) return;
        patchState(store, {
          selectedSubtree: updateTreeNode(current, objectiveId, (node) => ({ ...node, sprintTaskLoadState: 'error' }))
        });
      }
    },

    async loadTasksForSprint(sprintId: string, options?: { force?: boolean }): Promise<void> {
      const tree = store.selectedSubtree();
      if (!tree) return;
      const target = findTreeNode(tree, sprintId);
      if (!target || target.kind !== 'sprint') return;
      const state = target.sprintTaskLoadState;
      if (!options?.force && (state === 'loaded' || state === 'loading')) return;

      patchState(store, {
        selectedSubtree: updateTreeNode(tree, sprintId, (node) => ({ ...node, sprintTaskLoadState: 'loading' }))
      });

      try {
        const tasks = await firstValueFrom(taskApi.getBySprintId(sprintId));
        const current = store.selectedSubtree();
        if (!current) return;
        const sprint = findTreeNode(current, sprintId);
        if (!sprint) return;
        // Sprints are project-level (may hold tasks from several modules); under a module's tree
        // node only that module's tasks belong.
        const children = tasks
          .filter((task) => !sprint.parentObjectiveId || task.objectiveId === sprint.parentObjectiveId)
          .map((task) =>
            toTaskTreeNode(task, sprint, (sprint.statusNames ?? {})[task.statusId] ?? task.statusId)
          );
        patchState(store, {
          selectedSubtree: updateTreeNode(current, sprintId, (node) => ({
            ...node,
            children,
            sprintTaskLoadState: 'loaded'
          }))
        });
      } catch {
        const current = store.selectedSubtree();
        if (!current) return;
        patchState(store, {
          selectedSubtree: updateTreeNode(current, sprintId, (node) => ({ ...node, sprintTaskLoadState: 'error' }))
        });
      }
    },

    /** pending = sent for approval; the tree node is left as it is until the request is approved. */
    async achieveSprint(sprintId: string): Promise<{ success: boolean; pending?: boolean }> {
      try {
        const dto = await firstValueFrom(sprintApi.achieve(sprintId));
        if (isPendingApproval(dto)) {
          patchState(store, { milestoneActionError: null });
          return { success: true, pending: true };
        }
        const tree = store.selectedSubtree();
        if (tree) {
          patchState(store, {
            selectedSubtree: updateTreeNode(tree, sprintId, (node) => ({
              ...node,
              title: dto.name,
              startDate: dto.startDate,
              endDate: dto.endDate,
              status: dto.status,
              isAchieved: dto.status === 'achieved'
            })),
            milestoneActionError: null
          });
        }
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to achieve the sprint.') });
        return { success: false };
      }
    },

    /** pending = sent for approval; the tree node is left as it is until the request is approved. */
    async completeSprint(sprintId: string, request: CompleteSprintRequestDto): Promise<{ success: boolean; pending?: boolean }> {
      try {
        const dto = await firstValueFrom(sprintApi.complete(sprintId, request));
        if (isPendingApproval(dto)) {
          patchState(store, { milestoneActionError: null });
          return { success: true, pending: true };
        }
        const tree = store.selectedSubtree();
        if (tree) {
          patchState(store, {
            selectedSubtree: updateTreeNode(tree, sprintId, (node) => ({
              ...node,
              title: dto.name,
              startDate: dto.startDate,
              endDate: dto.endDate,
              status: dto.status,
              isAchieved: dto.status === 'achieved'
            })),
            milestoneActionError: null
          });
        }
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to complete the sprint.') });
        return { success: false };
      }
    },

    /** Deletes a complete or achieved sprint: its node leaves the tree and the module is reloaded so the
     *  sprint's tasks reappear in the backlog. pending = sent for approval; nothing changes yet. */
    async deleteSprint(sprintId: string): Promise<{ success: boolean; pending?: boolean }> {
      try {
        const res = await firstValueFrom(sprintApi.delete(sprintId));
        if (isPendingApproval(res)) {
          patchState(store, { milestoneActionError: null });
          return { success: true, pending: true };
        }
        const tree = store.selectedSubtree();
        const parentObjectiveId = tree ? findTreeNode(tree, sprintId)?.parentObjectiveId : undefined;
        if (tree) {
          patchState(store, { selectedSubtree: removeTreeNode(tree, sprintId), milestoneActionError: null });
        }
        if (parentObjectiveId) {
          await this.loadSprintsAndTasksForLeaf(parentObjectiveId, { force: true });
        }
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to delete the sprint.') });
        return { success: false };
      }
    },

    /** pendingApproval = the deletion was sent for approval; the task stays until it is approved. */
    async deleteTask(taskId: string): Promise<{ success: boolean; pendingApproval?: boolean }> {
      try {
        const res = await firstValueFrom(taskApi.deleteTask(taskId));
        if (isPendingApproval(res)) {
          patchState(store, { milestoneActionError: null });
          return { success: true, pendingApproval: true };
        }
        const tree = store.selectedSubtree();
        if (tree) {
          patchState(store, {
            selectedSubtree: removeTreeNode(tree, taskId),
            milestoneActionError: null
          });
        }
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to delete the task.') });
        return { success: false };
      }
    }
    };
  })
);
