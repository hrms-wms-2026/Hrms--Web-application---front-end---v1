import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OffboardingApiService } from '../data-access/offboarding-api.service';
import {
  BypassRequestResponse,
  ChecklistTemplateMatchResponse,
  CreateBypassRequestRequest,
  EmployeeChecklistTaskResponse,
  OffboardingRecordResponse,
  StartOffboardingRequest,
  UpdateEmployeeChecklistTaskRequest
} from '../models/offboarding.model';

export type OffboardingWizardStep =
  | 'start' | 'choose_checklist' | 'review_tasks' | 'track_exit_work' | 'complete_or_bypass' | 'complete_exit';

export interface OffboardingWizardState {
  readonly employeeId: string | null;
  readonly record: OffboardingRecordResponse | null;
  readonly checklistMatches: readonly ChecklistTemplateMatchResponse[];
  readonly tasks: readonly EmployeeChecklistTaskResponse[];
  readonly myPendingBypassRequests: readonly BypassRequestResponse[];
  readonly step: OffboardingWizardStep;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
}

const initialState: OffboardingWizardState = {
  employeeId: null, record: null, checklistMatches: [], tasks: [], myPendingBypassRequests: [],
  step: 'start', loading: false, saving: false, error: null
};

export const OffboardingWizardStore = signalStore(
  { providedIn: 'root' },
  withState<OffboardingWizardState>(initialState),
  withMethods((store, api = inject(OffboardingApiService), notifications = inject(NotificationService)) => ({
    reset(): void {
      patchState(store, initialState);
    },

    goToStep(step: OffboardingWizardStep): void {
      patchState(store, { step });
    },

    async loadOffboarding(employeeId: string): Promise<void> {
      patchState(store, { employeeId, loading: true, error: null });
      try {
        const record = await firstValueFrom(api.getOffboarding(employeeId));
        patchState(store, { record, loading: false });
        if (record) {
          patchState(store, { step: record.status === 'initiated' ? 'choose_checklist' : 'review_tasks' });
          if (record.status !== 'initiated') {
            await this.loadTasks(employeeId);
          }
        }
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load offboarding status.') });
      }
    },

    async startOffboarding(employeeId: string, payload: StartOffboardingRequest): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.startOffboarding(employeeId, payload));
        patchState(store, { saving: false, employeeId });
        await this.loadOffboarding(employeeId);
        patchState(store, { step: 'choose_checklist' });
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to start offboarding.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async loadChecklistMatches(employeeId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const checklistMatches = await firstValueFrom(api.getChecklistMatches(employeeId));
        patchState(store, { checklistMatches, loading: false });
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load matching checklists.') });
      }
    },

    async selectChecklist(employeeId: string, templateId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.selectChecklist(employeeId, templateId));
        patchState(store, { saving: false });
        await this.loadOffboarding(employeeId);
        patchState(store, { step: 'review_tasks' });
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to select checklist.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async loadTasks(employeeId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const tasks = await firstValueFrom(api.listChecklistTasks(employeeId));
        patchState(store, { tasks, loading: false });
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load checklist tasks.') });
      }
    },

    async updateTask(employeeId: string, taskId: string, payload: UpdateEmployeeChecklistTaskRequest): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.updateChecklistTask(employeeId, taskId, payload));
        patchState(store, { saving: false });
        await this.loadTasks(employeeId);
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to update task.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async completeTask(employeeId: string, taskId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.completeChecklistTask(employeeId, taskId));
        patchState(store, { saving: false });
        notifications.success('Task marked complete.');
        await this.loadTasks(employeeId);
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to complete task.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async createBypassRequest(employeeId: string, taskId: string, payload: CreateBypassRequestRequest): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.createBypassRequest(employeeId, taskId, payload));
        patchState(store, { saving: false });
        notifications.success('Bypass request sent for approval.');
        await this.loadTasks(employeeId);
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to request bypass.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async cancelOffboarding(employeeId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.cancelOffboarding(employeeId));
        patchState(store, { saving: false });
        notifications.success('Offboarding cancelled.');
        this.reset();
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to cancel offboarding.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async completeOffboarding(employeeId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.completeOffboarding(employeeId));
        patchState(store, { saving: false });
        notifications.success('Offboarding completed.');
        await this.loadOffboarding(employeeId);
        patchState(store, { step: 'complete_exit' });
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to complete offboarding.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async loadMyPendingBypassRequests(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const myPendingBypassRequests = await firstValueFrom(api.listMyPendingBypassRequests());
        patchState(store, { myPendingBypassRequests, loading: false });
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load pending approvals.') });
      }
    },

    async decideBypassRequest(id: string, decision: 'approve' | 'reject', decisionComment: string | null): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(decision === 'approve' ? api.approveBypassRequest(id) : api.rejectBypassRequest(id, decisionComment));
        patchState(store, { saving: false });
        notifications.success(decision === 'approve' ? 'Bypass approved.' : 'Bypass rejected.');
        await this.loadMyPendingBypassRequests();
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to record the decision.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    }
  }))
);
