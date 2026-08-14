import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { ObjectiveMemberApiService } from '../data-access/objective-member-api.service';
import { toMilestone, toMilestoneTreeNode, toProjectDetail } from '../utils/project.mapper';
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
  withMethods((store, api = inject(ProjectApiService), memberApi = inject(ObjectiveMemberApiService)) => ({
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

    async loadMilestoneSubtree(objectiveId: string): Promise<void> {
      patchState(store, { subtreeLoading: true, subtreeError: null });
      try {
        const response = await firstValueFrom(api.getMilestoneSubtree(objectiveId));
        patchState(store, { selectedSubtree: toMilestoneTreeNode(response.objective), subtreeLoading: false });
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
    }
  }))
);
