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
import { EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../models/dto/milestone.dto';
import { ObjectiveMemberItemDto, ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';

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
  readonly myInvitations: readonly ObjectiveInvitationDto[];
}

const initialState: ProjectDetailState = {
  project: null, projectLoading: false, projectError: null,
  milestones: [], milestonesLoading: false, milestonesError: null,
  selectedSubtree: null, subtreeLoading: false, subtreeError: null,
  milestoneActionError: null,
  objectiveMembers: [], objectiveMembersLoading: false, objectiveMembersError: null,
  myInvitations: []
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
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
  ) => ({
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
        patchState(store, { milestonesError: extractError(err, 'Failed to load modules.'), milestonesLoading: false });
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

    async createSubModule(payload: CreateObjectiveRequestDto): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(api.createObjective(payload));
        patchState(store, { milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to create sub-module.') });
        return { success: false };
      }
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

    async addObjectiveMember(objectiveId: string, employeeId: string): Promise<{ success: boolean; alreadyMember: boolean }> {
      try {
        const res = await firstValueFrom(memberApi.addMember(objectiveId, employeeId));
        patchState(store, { milestoneActionError: null });
        return { success: true, alreadyMember: res.body!.alreadyMember };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to add member.') });
        return { success: false, alreadyMember: false };
      }
    },

    async removeObjectiveMember(objectiveId: string, employeeId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(memberApi.removeMember(objectiveId, employeeId));
        patchState(store, { milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to remove member.') });
        return { success: false };
      }
    },

    async transferObjectiveHead(objectiveId: string, newHeadEmployeeId: string): Promise<{ success: boolean; applied: boolean; viaInvitation: boolean }> {
      try {
        const res = await firstValueFrom(memberApi.transferHead(objectiveId, newHeadEmployeeId));
        patchState(store, { milestoneActionError: null });
        return { success: true, applied: res.body!.applied, viaInvitation: res.body!.pendingInvitation !== null };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to transfer leadership.') });
        return { success: false, applied: false, viaInvitation: false };
      }
    },

    async loadMyInvitations(): Promise<void> {
      try {
        const dtos = await firstValueFrom(memberApi.getMyInvitations());
        patchState(store, { myInvitations: dtos });
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to load invitations.') });
      }
    },

    async acceptInvitation(invitationId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(memberApi.acceptInvitation(invitationId));
        patchState(store, { myInvitations: store.myInvitations().filter((i) => i.id !== invitationId), milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to accept invitation.') });
        return { success: false };
      }
    },

    async rejectInvitation(invitationId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(memberApi.rejectInvitation(invitationId));
        patchState(store, { myInvitations: store.myInvitations().filter((i) => i.id !== invitationId), milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to reject invitation.') });
        return { success: false };
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
          taskApi.getStatuses(objectiveId)
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
            .filter((task) => task.sprintId === null)
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
        const children = tasks.map((task) =>
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

    async achieveSprint(sprintId: string): Promise<{ success: boolean }> {
      try {
        const dto = await firstValueFrom(sprintApi.achieve(sprintId));
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

    async completeSprint(sprintId: string): Promise<{ success: boolean }> {
      try {
        const dto = await firstValueFrom(sprintApi.complete(sprintId));
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

    async deleteTask(taskId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(taskApi.deleteTask(taskId));
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
  }))
);
