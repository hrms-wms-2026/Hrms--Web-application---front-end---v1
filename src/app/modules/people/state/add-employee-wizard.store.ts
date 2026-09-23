import { inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { SelectOption } from '../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../organization/data-access/department-api.service';
import { PositionApiService } from '../../organization/data-access/position-api.service';
import { PositionListItemResponse } from '../../organization/models/position.model';
import { ChecklistApiService } from '../data-access/checklist-api.service';
import { PeopleApiService } from '../data-access/people-api.service';
import {
  ChecklistAssignee,
  ChecklistTemplateDetailResponse,
  DraftChecklistTask,
  OnboardingChecklistTemplateMatchResponse
} from '../models/checklist-template.model';
import {
  ActiveHolder,
  FinalizeOnboardingDraftResponse,
  OnboardingDraftResponse,
  SaveOnboardingDraftPayload,
  WizardStep,
  WorkModeOption
} from '../models/onboarding-draft.model';
import {
  createDraftTasksFromTemplate,
  createEmptyDraftTask,
  parseEditedTasksJsonToDraftTasks,
  serializeDraftTasksToEditedTasksJson,
  validateDraftTasks
} from '../utils/draft-checklist-task.utils';


export interface AddEmployeeFormValue {
  firstName: string;
  lastName: string;
  workEmail: string;
  employmentType: string;
  startDate: string;
  employeeNumber: string;
  workModeId: string | null;
}

export interface AddEmployeeWizardState {
  readonly step: WizardStep;
  readonly companyId: string | null;
  readonly departmentId: string | null;
  readonly positionId: string | null;
  readonly departments: readonly SelectOption[];
  readonly positions: readonly SelectOption[];
  readonly positionItems: readonly PositionListItemResponse[];
  readonly loadingDepartments: boolean;
  readonly loadingPositions: boolean;
  readonly positionValidationMessage: string | null;

  readonly activeHolders: readonly ActiveHolder[];
  readonly selectedReportsToEmployeeId: string | null;
  readonly loadingActiveHolders: boolean;

  readonly workModes: readonly WorkModeOption[];
  readonly loadingWorkModes: boolean;
  readonly workModesError: string | null;

  readonly checklistTemplates: readonly SelectOption[];
  readonly checklistTemplatesUnavailable: boolean;
  readonly checklistTemplateMatches: readonly OnboardingChecklistTemplateMatchResponse[];
  readonly selectedTemplateId: string | null;
  readonly loadingChecklistTemplates: boolean;
  readonly checklistTemplatesError: string | null;

  readonly selectedTemplateDetail: ChecklistTemplateDetailResponse | null;
  readonly loadingSelectedTemplateDetail: boolean;
  readonly selectedTemplateDetailError: string | null;
  readonly templateDetailCache: Readonly<Record<string, ChecklistTemplateDetailResponse>>;

  /** Employee-specific, editable copy of the selected checklist's tasks - never written back to
   *  the template. Only meaningful while selectedTemplateId is set. */
  readonly draftTasks: readonly DraftChecklistTask[];
  readonly draftTasksSourceTemplateId: string | null;
  readonly checklistAssigneePositions: readonly SelectOption[];
  readonly loadingChecklistAssigneePositions: boolean;
  readonly checklistAssigneePositionsError: string | null;
  readonly checklistAssigneesByPosition: Readonly<Record<string, readonly ChecklistAssignee[]>>;
  readonly loadingChecklistAssigneesByPosition: Readonly<Record<string, boolean>>;

  readonly formValue: AddEmployeeFormValue;
  readonly savedDepartmentName: string | null;
  readonly savedPositionName: string | null;
  readonly savedWorkModeLabel: string | null;
  readonly savedReportingManagerName: string | null;
  readonly savedReportingManagerPositionName: string | null;

  readonly draftId: string | null;
  readonly version: string | null;
  readonly lastSaveStatus: OnboardingDraftResponse['status'] | null;
  readonly lastSaveReason: OnboardingDraftResponse['draftReason'] | null;

  readonly saving: boolean;
  readonly saveError: string | null;
  readonly resuming: boolean;
  readonly resumeError: string | null;

  readonly finalizing: boolean;
  readonly finalizeError: string | null;
  readonly finalizeResult: FinalizeOnboardingDraftResponse | null;
}

const initialFormValue: AddEmployeeFormValue = {
  firstName: '',
  lastName: '',
  workEmail: '',
  employmentType: '',
  startDate: '',
  employeeNumber: '',
  workModeId: null
};

const initialState: AddEmployeeWizardState = {
  step: 'employee_details',
  companyId: null,
  departmentId: null,
  positionId: null,
  departments: [],
  positions: [],
  positionItems: [],
  loadingDepartments: false,
  loadingPositions: false,
  positionValidationMessage: null,

  activeHolders: [],
  selectedReportsToEmployeeId: null,
  loadingActiveHolders: false,

  workModes: [],
  loadingWorkModes: false,
  workModesError: null,

  checklistTemplates: [],
  checklistTemplatesUnavailable: true,
  checklistTemplateMatches: [],
  selectedTemplateId: null,
  loadingChecklistTemplates: false,
  checklistTemplatesError: null,

  selectedTemplateDetail: null,
  loadingSelectedTemplateDetail: false,
  selectedTemplateDetailError: null,
  templateDetailCache: {},

  draftTasks: [],
  draftTasksSourceTemplateId: null,
  checklistAssigneePositions: [],
  loadingChecklistAssigneePositions: false,
  checklistAssigneePositionsError: null,
  checklistAssigneesByPosition: {},
  loadingChecklistAssigneesByPosition: {},

  formValue: initialFormValue,
  savedDepartmentName: null,
  savedPositionName: null,
  savedWorkModeLabel: null,
  savedReportingManagerName: null,
  savedReportingManagerPositionName: null,

  draftId: null,
  version: null,
  lastSaveStatus: null,
  lastSaveReason: null,

  saving: false,
  saveError: null,
  resuming: false,
  resumeError: null,

  finalizing: false,
  finalizeError: null,
  finalizeResult: null
};

const POSITION_REQUIRED_MESSAGE = 'Position is required.';
const POSITION_NO_VACANCY_MESSAGE = 'The selected position no longer has a vacancy. Choose another position.';
const POSITION_NO_LONGER_AVAILABLE_MESSAGE = 'The selected position is no longer available. Choose another position.';

function getAvailableSeats(position: PositionListItemResponse): number {
  return position.maxOccupancy - position.assignedCount!;
}

function isPositionFull(position: PositionListItemResponse): boolean {
  return getAvailableSeats(position) <= 0;
}

function toPositionOption(position: PositionListItemResponse): SelectOption {
  const availableSeats = getAvailableSeats(position);
  return {
    value: position.id,
    label: availableSeats <= 0 ? `${position.name} [No vacancy]` : `${position.name} [${availableSeats}]`,
    disabled: availableSeats <= 0
  };
}

export const AddEmployeeWizardStore = signalStore(
  { providedIn: 'root' },
  withState<AddEmployeeWizardState>(initialState),
  withComputed(({ activeHolders }) => ({
    needsReportsToPick: () => activeHolders().length > 1
  })),
  withMethods(
    (
      store,
      peopleApi = inject(PeopleApiService),
      departmentApi = inject(DepartmentApiService),
      positionApi = inject(PositionApiService),
      checklistApi = inject(ChecklistApiService)
    ) => {
      /** Guards against firing a second HTTP request for a template detail fetch that's already in flight. */
      let inFlightTemplateDetailId: string | null = null;

      /** Seeds draftTasks from a loaded template's tasks, unless draftTasks already reflects this
       *  same template - which covers both a resumed draft's restored editedTasksJson (hydrated
       *  directly onto draftTasksSourceTemplateId in resumeDraft, before this ever runs) and a
       *  cache-hit re-selection of a template the user already edited and switched away from. */
      function seedDraftTasksIfNeeded(templateId: string, detail: ChecklistTemplateDetailResponse): void {
        if (store.draftTasksSourceTemplateId() === templateId) {
          return;
        }
        const draftTasks = createDraftTasksFromTemplate(detail.tasks);
        patchState(store, {
          draftTasks,
          draftTasksSourceTemplateId: templateId
        });
        if (draftTasks.some((task) => task.assignee === 'another')) {
          void loadChecklistAssigneePositions();
        }
        for (const task of draftTasks) {
          if (task.assignee === 'another' && task.assigneePositionId) {
            void loadChecklistAssigneesForPosition(task.assigneePositionId);
          }
        }
      }

      function maybePreselectSingleAssignee(positionId: string): void {
        const holders = store.checklistAssigneesByPosition()[positionId] ?? [];
        if (holders.length !== 1) {
          return;
        }
        const onlyUserId = holders[0].userId;
        patchState(store, {
          draftTasks: store.draftTasks().map((task) => {
            if (task.assignee !== 'another' || task.assigneePositionId !== positionId || task.selectedAssigneeUserId) {
              return task;
            }
            return { ...task, selectedAssigneeUserId: onlyUserId };
          })
        });
      }

      function getPositionSelectionIssue(positionId: string | null | undefined): 'required' | 'missing' | 'full' | null {
        if (!positionId) {
          return 'required';
        }
        if (store.positionItems().length === 0) {
          return null;
        }
        const selected = store.positionItems().find((position) => position.id === positionId);
        if (!selected) {
          return 'missing';
        }
        return isPositionFull(selected) ? 'full' : null;
      }

      function getPositionIssueMessage(issue: 'required' | 'missing' | 'full'): string {
        if (issue === 'required') {
          return POSITION_REQUIRED_MESSAGE;
        }
        if (issue === 'missing') {
          return POSITION_NO_LONGER_AVAILABLE_MESSAGE;
        }
        return POSITION_NO_VACANCY_MESSAGE;
      }

      function clearChecklistSelectionState(message: string | null, positionId: string | null): void {
        patchState(store, {
          positionId,
          activeHolders: [],
          selectedReportsToEmployeeId: null,
          loadingActiveHolders: false,
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          savedPositionName: null,
          savedReportingManagerName: null,
          savedReportingManagerPositionName: null,
          draftTasks: [],
          draftTasksSourceTemplateId: null,
          positionValidationMessage: message
        });
      }

      async function loadChecklistAssigneePositions(): Promise<void> {
        const companyId = store.companyId();
        if (!companyId) {
          return;
        }
        patchState(store, {
          loadingChecklistAssigneePositions: true,
          checklistAssigneePositionsError: null
        });
        try {
          const items = await firstValueFrom(peopleApi.getChecklistAssigneePositions(companyId));
          if (store.companyId() !== companyId) {
            return;
          }
          patchState(store, {
            checklistAssigneePositions: items.map((p) => ({ value: p.id, label: p.name })),
            loadingChecklistAssigneePositions: false,
            checklistAssigneePositionsError: null
          });
        } catch (err) {
          if (store.companyId() !== companyId) {
            return;
          }
          patchState(store, {
            checklistAssigneePositions: [],
            loadingChecklistAssigneePositions: false,
            checklistAssigneePositionsError: toSafeErrorMessage(err, 'Could not load positions.')
          });
        }
      }

      async function loadChecklistAssigneesForPosition(positionId: string): Promise<void> {
        const companyId = store.companyId();
        if (!companyId || !positionId) {
          return;
        }
        if (store.checklistAssigneesByPosition()[positionId]) {
          maybePreselectSingleAssignee(positionId);
          return;
        }
        patchState(store, {
          loadingChecklistAssigneesByPosition: { ...store.loadingChecklistAssigneesByPosition(), [positionId]: true }
        });
        try {
          const assignees = await firstValueFrom(peopleApi.getChecklistAssignees(companyId, positionId));
          patchState(store, {
            checklistAssigneesByPosition: { ...store.checklistAssigneesByPosition(), [positionId]: assignees },
            loadingChecklistAssigneesByPosition: { ...store.loadingChecklistAssigneesByPosition(), [positionId]: false }
          });
          maybePreselectSingleAssignee(positionId);
        } catch {
          patchState(store, {
            checklistAssigneesByPosition: { ...store.checklistAssigneesByPosition(), [positionId]: [] },
            loadingChecklistAssigneesByPosition: { ...store.loadingChecklistAssigneesByPosition(), [positionId]: false }
          });
        }
      }

      async function loadActiveHoldersForReportsToPosition(
        reportsToPositionId: string,
        forPositionId: string
      ): Promise<void> {
        const companyId = store.companyId();
        if (!companyId) {
          patchState(store, { activeHolders: [], loadingActiveHolders: false });
          return;
        }

        patchState(store, { loadingActiveHolders: true });
        try {
          const holders = await firstValueFrom(peopleApi.getActiveHolders(companyId, reportsToPositionId));
          if (store.positionId() !== forPositionId) {
            return;
          }
          patchState(store, { activeHolders: holders, loadingActiveHolders: false });
        } catch {
          if (store.positionId() !== forPositionId) {
            return;
          }
          patchState(store, { activeHolders: [], loadingActiveHolders: false });
        }
      }

      return {
      reset(): void {
        patchState(store, initialState);
      },

      setCompany(companyId: string): void {
        patchState(store, {
          companyId,
          departmentId: null,
          positionId: null,
          departments: [],
          positions: [],
          positionItems: [],
          activeHolders: [],
          selectedReportsToEmployeeId: null,
          loadingActiveHolders: false,
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          savedDepartmentName: null,
          savedPositionName: null,
          savedReportingManagerName: null,
          savedReportingManagerPositionName: null,
          draftTasks: [],
          draftTasksSourceTemplateId: null,
          positionValidationMessage: null
        });
        void this.loadDepartmentsForCompany(companyId);
      },

      async loadWorkModes(legalEntityId: string): Promise<void> {
        patchState(store, { loadingWorkModes: true, workModesError: null });
        try {
          const modes = await firstValueFrom(peopleApi.getWorkModes(legalEntityId));
          patchState(store, { workModes: modes, loadingWorkModes: false });
        } catch (err: unknown) {
          patchState(store, {
            workModes: [],
            loadingWorkModes: false,
            workModesError: toSafeErrorMessage(err, 'Failed to load work modes.')
          });
        }
      },

      async loadDepartmentsForCompany(companyId: string): Promise<void> {
        patchState(store, { loadingDepartments: true });
        try {
          const page = await firstValueFrom(departmentApi.listFlat(companyId, { includeInactive: false }));
          if (store.companyId() !== companyId) {
            return;
          }
          patchState(store, {
            departments: page.items.map((d) => ({ value: d.id, label: d.name })),
            loadingDepartments: false
          });
        } catch {
          if (store.companyId() !== companyId) {
            return;
          }
          patchState(store, { departments: [], loadingDepartments: false });
        }
      },

      setDepartment(departmentId: string): void {
        patchState(store, {
          departmentId,
          positionId: null,
          positions: [],
          positionItems: [],
          activeHolders: [],
          selectedReportsToEmployeeId: null,
          loadingActiveHolders: false,
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          savedDepartmentName: null,
          savedPositionName: null,
          savedReportingManagerName: null,
          savedReportingManagerPositionName: null,
          draftTasks: [],
          draftTasksSourceTemplateId: null,
          positionValidationMessage: null
        });
        const companyId = store.companyId();
        if (companyId) {
          void this.loadPositionsForDepartment(companyId, departmentId);
        }
      },

      async loadPositionsForDepartment(companyId: string, departmentId: string): Promise<void> {
        patchState(store, { loadingPositions: true });
        try {
          const page = await firstValueFrom(
            positionApi.listFlat(companyId, { departmentId, includeInactive: false })
          );
          if (store.departmentId() !== departmentId) {
            return;
          }
          const selectedPositionId = store.positionId();
          const selectedPosition = selectedPositionId
            ? page.items.find((position) => position.id === selectedPositionId) ?? null
            : null;
          const selectionIssue =
            selectedPositionId && page.items.length > 0
              ? !selectedPosition
                ? 'missing'
                : isPositionFull(selectedPosition)
                  ? 'full'
                  : null
              : null;
          patchState(store, {
            positions: page.items.map(toPositionOption),
            positionItems: page.items,
            loadingPositions: false,
            positionValidationMessage: selectionIssue ? getPositionIssueMessage(selectionIssue) : null
          });
          if (selectionIssue) {
            clearChecklistSelectionState(getPositionIssueMessage(selectionIssue), null);
          }
        } catch {
          if (store.departmentId() !== departmentId) {
            return;
          }
          patchState(store, { positions: [], positionItems: [], loadingPositions: false });
        }
      },

      async setPosition(positionId: string, reportsToPositionId?: string | null): Promise<void> {
        const normalizedPositionId = positionId || null;
        const resolvedReportsTo =
          reportsToPositionId ??
          store.positionItems().find((p) => p.id === normalizedPositionId)?.reportsToPositionId ??
          null;

        patchState(store, {
          positionId: normalizedPositionId,
          activeHolders: [],
          selectedReportsToEmployeeId: null,
          loadingActiveHolders: false,
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          savedPositionName: null,
          savedReportingManagerName: null,
          savedReportingManagerPositionName: null,
          draftTasks: [],
          draftTasksSourceTemplateId: null,
          positionValidationMessage: null
        });

        if (normalizedPositionId && resolvedReportsTo) {
          await loadActiveHoldersForReportsToPosition(resolvedReportsTo, normalizedPositionId);
        }
      },

      getPositionSelectionIssue(positionId: string | null | undefined): 'required' | 'missing' | 'full' | null {
        return getPositionSelectionIssue(positionId);
      },

      setPositionValidationMessage(message: string | null): void {
        patchState(store, { positionValidationMessage: message });
      },

      syncSelectionFromForm(departmentId: string | null, positionId: string | null): void {
        patchState(store, {
          departmentId,
          positionId
        });
      },

      clearInvalidPositionSelection(message: string): void {
        clearChecklistSelectionState(message, null);
      },

      setReportsToEmployeeId(employeeId: string | null): void {
        patchState(store, { selectedReportsToEmployeeId: employeeId });
      },

      selectChecklistTemplate(templateId: string): void {
        if (store.selectedTemplateId() === templateId) {
          return;
        }
        patchState(store, {
          selectedTemplateId: templateId,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          draftTasks: [],
          draftTasksSourceTemplateId: null
        });
        void this.loadSelectedTemplateDetail(templateId);
      },

      clearSelectedChecklistTemplate(): void {
        patchState(store, {
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          draftTasks: [],
          draftTasksSourceTemplateId: null
        });
      },

      /** Loads checklist template detail for the review preview - cache and in-flight checks keep this from re-firing for a template already fetched or currently loading. */
      async loadSelectedTemplateDetail(templateId: string): Promise<void> {
        const cached = store.templateDetailCache()[templateId];
        if (cached) {
          if (store.selectedTemplateId() === templateId) {
            patchState(store, { selectedTemplateDetail: cached, loadingSelectedTemplateDetail: false, selectedTemplateDetailError: null });
            seedDraftTasksIfNeeded(templateId, cached);
          }
          return;
        }
        if (inFlightTemplateDetailId === templateId) {
          return;
        }
        inFlightTemplateDetailId = templateId;
        patchState(store, { loadingSelectedTemplateDetail: true, selectedTemplateDetailError: null });
        try {
          const detail = await firstValueFrom(checklistApi.getChecklistTemplate(templateId));
          patchState(store, (s) => ({ templateDetailCache: { ...s.templateDetailCache, [templateId]: detail } }));
          if (store.selectedTemplateId() === templateId) {
            patchState(store, { selectedTemplateDetail: detail, loadingSelectedTemplateDetail: false });
            seedDraftTasksIfNeeded(templateId, detail);
          }
        } catch (err: unknown) {
          if (store.selectedTemplateId() === templateId) {
            patchState(store, {
              loadingSelectedTemplateDetail: false,
              selectedTemplateDetailError: toSafeErrorMessage(err, 'Failed to load checklist details.')
            });
          }
        } finally {
          if (inFlightTemplateDetailId === templateId) {
            inFlightTemplateDetailId = null;
          }
        }
      },

      updateDraftTask(
        clientId: string,
        patch: Partial<Pick<DraftChecklistTask, 'title' | 'dueDays' | 'isRequired' | 'assignee' | 'assigneePositionId' | 'selectedAssigneeUserId'>>
      ): void {
        patchState(store, {
          draftTasks: store.draftTasks().map((task) => {
            if (task.clientId !== clientId) {
              return task;
            }
            if (patch.assignee === 'employee') {
              return {
                ...task,
                ...patch,
                preservedOwnerType: null,
                assigneePositionId: null,
                selectedAssigneeUserId: null
              };
            }
            if (patch.assignee === 'another') {
              return {
                ...task,
                ...patch,
                preservedOwnerType: task.preservedOwnerType ?? 'custom_user',
                selectedAssigneeUserId: patch.selectedAssigneeUserId ?? null
              };
            }
            if (patch.assigneePositionId !== undefined && patch.assigneePositionId !== task.assigneePositionId) {
              return { ...task, ...patch, selectedAssigneeUserId: null };
            }
            return { ...task, ...patch };
          })
        });
        const updated = store.draftTasks().find((task) => task.clientId === clientId);
        if (updated?.assignee === 'another' && updated.assigneePositionId) {
          void loadChecklistAssigneesForPosition(updated.assigneePositionId);
        }
      },

      async ensureChecklistAssigneePositionsLoaded(force = false): Promise<void> {
        if (store.loadingChecklistAssigneePositions()) {
          return;
        }
        if (!force && store.checklistAssigneePositions().length > 0) {
          return;
        }
        await loadChecklistAssigneePositions();
      },

      addDraftTask(): void {
        patchState(store, { draftTasks: [...store.draftTasks(), createEmptyDraftTask()] });
      },

      removeDraftTask(clientId: string): void {
        patchState(store, { draftTasks: store.draftTasks().filter((task) => task.clientId !== clientId) });
      },

      moveDraftTaskUp(clientId: string): void {
        const tasks = [...store.draftTasks()];
        const index = tasks.findIndex((task) => task.clientId === clientId);
        if (index > 0) {
          [tasks[index - 1], tasks[index]] = [tasks[index], tasks[index - 1]];
          patchState(store, { draftTasks: tasks });
        }
      },

      moveDraftTaskDown(clientId: string): void {
        const tasks = [...store.draftTasks()];
        const index = tasks.findIndex((task) => task.clientId === clientId);
        if (index >= 0 && index < tasks.length - 1) {
          [tasks[index + 1], tasks[index]] = [tasks[index], tasks[index + 1]];
          patchState(store, { draftTasks: tasks });
        }
      },

      async loadChecklistTemplateMatches(): Promise<void> {
        const legalEntityId = store.companyId();
        if (!legalEntityId) {
          patchState(store, {
            checklistTemplateMatches: [],
            checklistTemplates: [],
            checklistTemplatesUnavailable: true,
            loadingChecklistTemplates: false,
            checklistTemplatesError: null
          });
          return;
        }

        const departmentId = store.departmentId();
        const positionId = store.positionId();

        patchState(store, { loadingChecklistTemplates: true, checklistTemplatesError: null });
        try {
          const matches = await firstValueFrom(
            checklistApi.getOnboardingMatches({
              legalEntityId,
              departmentId: departmentId ?? undefined,
              positionId: positionId ?? undefined
            })
          );

          // Never auto-selects: a previously-selected id (restored from a resumed draft, or kept
          // across a re-render) survives only if it's still present in the fresh matches list.
          // A brand-new draft always lands on no selection, even when exactly one match exists.
          const previouslySelected = store.selectedTemplateId();
          const stillValid = !!previouslySelected && matches.some((m) => m.id === previouslySelected);
          const nextSelectedId = stillValid ? previouslySelected : null;

          patchState(store, {
            checklistTemplateMatches: matches,
            checklistTemplates: matches.map((m) => ({ value: m.id, label: m.name })),
            checklistTemplatesUnavailable: matches.length === 0,
            loadingChecklistTemplates: false,
            selectedTemplateId: nextSelectedId
          });

          if (nextSelectedId) {
            void this.loadSelectedTemplateDetail(nextSelectedId);
          } else {
            patchState(store, {
              selectedTemplateDetail: null,
              selectedTemplateDetailError: null,
              loadingSelectedTemplateDetail: false,
              draftTasks: [],
              draftTasksSourceTemplateId: null
            });
          }
        } catch (err: unknown) {
          patchState(store, {
            checklistTemplateMatches: [],
            checklistTemplates: [],
            loadingChecklistTemplates: false,
            checklistTemplatesError: toSafeErrorMessage(err, 'Something went wrong while saving your changes.')
          });
        }
      },

      updateFormValue(patch: Partial<AddEmployeeFormValue>): void {
        patchState(store, { formValue: { ...store.formValue(), ...patch } });
      },

      goToStep(step: WizardStep): void {
        patchState(store, { step });
      },

      async saveDraft(lastSavedStep: WizardStep): Promise<OnboardingDraftResponse | null> {
        if (store.saving()) {
          return null;
        }

        const form = store.formValue();
        if (!form.workModeId) {
          patchState(store, { saveError: 'Work mode is required.' });
          return null;
        }

        const positionIssue = getPositionSelectionIssue(store.positionId());
        if (positionIssue) {
          const message = getPositionIssueMessage(positionIssue);
          patchState(store, {
            saveError: message,
            positionValidationMessage: message
          });
          if (positionIssue !== 'required') {
            clearChecklistSelectionState(message, null);
          }
          return null;
        }

        const selectedTemplateId = store.selectedTemplateId();
        let editedTasksJson: string | null = null;
        if (selectedTemplateId) {
          if (store.loadingSelectedTemplateDetail() || store.draftTasksSourceTemplateId() !== selectedTemplateId) {
            patchState(store, { saveError: 'Please wait for the checklist to finish loading before saving.' });
            return null;
          }
          const validationErrors = validateDraftTasks(store.draftTasks());
          if (validationErrors.length > 0) {
            patchState(store, { saveError: validationErrors[0] });
            return null;
          }
          editedTasksJson = serializeDraftTasksToEditedTasksJson(store.draftTasks(), form.startDate);
        }

        if (store.needsReportsToPick() && !store.selectedReportsToEmployeeId()) {
          patchState(store, { saveError: 'Select who this employee reports to before continuing.' });
          return null;
        }

        const payload: SaveOnboardingDraftPayload = {
          draftId: store.draftId() ?? undefined,
          firstName: form.firstName,
          lastName: form.lastName,
          workEmail: form.workEmail,
          legalEntityId: store.companyId() ?? '',
          departmentId: store.departmentId(),
          positionId: store.positionId(),
          employmentType: form.employmentType,
          startDate: form.startDate,
          employeeNumber: form.employeeNumber || null,
          workModeId: form.workModeId,
          selectedTemplateId,
          editedTasksJson,
          lastSavedStep,
          reportsToEmployeeId: store.selectedReportsToEmployeeId()
        };

        patchState(store, { saving: true, saveError: null });
        try {
          const response = await firstValueFrom(peopleApi.saveDraft(payload, store.version()));
          patchState(store, {
            saving: false,
            draftId: response.id,
            version: response.version,
            step: response.lastSavedStep,
            savedDepartmentName: response.departmentName ?? store.savedDepartmentName(),
            savedPositionName: response.positionName ?? store.savedPositionName(),
            savedWorkModeLabel: response.workModeLabel ?? store.savedWorkModeLabel(),
            savedReportingManagerName: response.reportingManagerName ?? store.savedReportingManagerName(),
            savedReportingManagerPositionName:
              response.reportingManagerPositionName ?? store.savedReportingManagerPositionName(),
            lastSaveStatus: response.status,
            lastSaveReason: response.draftReason
          });
          return response;
        } catch (err) {
          patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Something went wrong while saving the employee.') });
          return null;
        }
      },

      async resumeDraft(draftId: string): Promise<void> {
        patchState(store, { resuming: true, resumeError: null });
        try {
          const draft = await firstValueFrom(peopleApi.getDraft(draftId));

          // Restoring editedTasksJson (when present) must win over the template-detail load that
          // loadChecklistTemplateMatches() below is about to trigger for the same selected id -
          // stamping draftTasksSourceTemplateId here up front is what makes seedDraftTasksIfNeeded
          // treat that later detail load as a no-op instead of clobbering the restored edits.
          const parsedTasks = draft.editedTasksJson
            ? parseEditedTasksJsonToDraftTasks(draft.editedTasksJson, draft.startDate)
            : null;

          patchState(store, {
            resuming: false,
            draftId: draft.id,
            version: draft.version,
            step: draft.lastSavedStep,
            companyId: draft.legalEntityId,
            departmentId: draft.departmentId,
            positionId: draft.positionId,
            selectedReportsToEmployeeId: draft.reportsToEmployeeId,
            savedDepartmentName: draft.departmentName ?? null,
            savedPositionName: draft.positionName ?? null,
            savedWorkModeLabel: draft.workModeLabel ?? null,
            savedReportingManagerName: draft.reportingManagerName ?? null,
            savedReportingManagerPositionName: draft.reportingManagerPositionName ?? null,
            selectedTemplateId: draft.selectedTemplateId,
            draftTasks: parsedTasks ?? [],
            draftTasksSourceTemplateId: parsedTasks ? draft.selectedTemplateId : null,
            lastSaveStatus: draft.status,
            lastSaveReason: draft.draftReason,
            formValue: {
              firstName: draft.firstName,
              lastName: draft.lastName,
              workEmail: draft.workEmail,
              employmentType: draft.employmentType,
              startDate: draft.startDate,
              employeeNumber: draft.employeeNumber ?? '',
              workModeId: draft.workModeId
            }
          });

          await this.loadDepartmentsForCompany(draft.legalEntityId);
          if (draft.departmentId) {
            await this.loadPositionsForDepartment(draft.legalEntityId, draft.departmentId);
          }
          if (draft.positionId) {
            const reportsTo =
              store.positionItems().find((p) => p.id === draft.positionId)?.reportsToPositionId ?? null;
            if (reportsTo) {
              await loadActiveHoldersForReportsToPosition(reportsTo, draft.positionId);
            }
          }
          await this.loadChecklistTemplateMatches();
          if (store.draftTasks().some((task) => task.assignee === 'another')) {
            await loadChecklistAssigneePositions();
          }
          for (const task of store.draftTasks()) {
            if (task.assignee === 'another' && task.assigneePositionId) {
              await loadChecklistAssigneesForPosition(task.assigneePositionId);
            }
          }
        } catch (err) {
          patchState(store, {
            resuming: false,
            resumeError: toSafeErrorMessage(err, 'The draft or selected organization record could not be found.')
          });
        }
      },

      async finalizeDraft(id: string): Promise<FinalizeOnboardingDraftResponse | null> {
        if (store.finalizing()) {
          return null;
        }
        patchState(store, { finalizing: true, finalizeError: null });
        try {
          const response = await firstValueFrom(peopleApi.finalizeDraft(id));
          patchState(store, {
            finalizing: false,
            finalizeResult: response,
            lastSaveStatus: response.status as OnboardingDraftResponse['status'],
            lastSaveReason: response.draftReason as OnboardingDraftResponse['draftReason']
          });
          return response;
        } catch (err: unknown) {
          patchState(store, {
            finalizing: false,
            finalizeError: toSafeErrorMessage(err, 'Failed to finalize onboarding draft.')
          });
          return null;
        }
      }
      };
    }
  )
);
