import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { SelectOption } from '../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../organization/data-access/department-api.service';
import { PositionApiService } from '../../organization/data-access/position-api.service';
import { ChecklistApiService } from '../data-access/checklist-api.service';
import { PeopleApiService } from '../data-access/people-api.service';
import { ChecklistTemplateDetailResponse, DraftChecklistTask, OnboardingChecklistTemplateMatchResponse } from '../models/checklist-template.model';
import {
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
  workModeId: number | null;
}

export interface AddEmployeeWizardState {
  readonly step: WizardStep;
  readonly companyId: string | null;
  readonly departmentId: string | null;
  readonly positionId: string | null;
  readonly departments: readonly SelectOption[];
  readonly positions: readonly SelectOption[];
  readonly loadingDepartments: boolean;
  readonly loadingPositions: boolean;

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
  /** The template id draftTasks was last seeded from (or restored against, for a resumed draft
   *  with editedTasksJson). Lets seeding be skipped so a resumed draft's saved edits are never
   *  clobbered by a subsequent template-detail load for the same template. */
  readonly draftTasksSourceTemplateId: string | null;

  readonly formValue: AddEmployeeFormValue;

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
  loadingDepartments: false,
  loadingPositions: false,

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

  formValue: initialFormValue,

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

export const AddEmployeeWizardStore = signalStore(
  { providedIn: 'root' },
  withState<AddEmployeeWizardState>(initialState),
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
        patchState(store, {
          draftTasks: createDraftTasksFromTemplate(detail.tasks),
          draftTasksSourceTemplateId: templateId
        });
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
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          draftTasks: [],
          draftTasksSourceTemplateId: null
        });
        void this.loadDepartmentsForCompany(companyId);
      },

      async loadWorkModes(): Promise<void> {
        patchState(store, { loadingWorkModes: true, workModesError: null });
        try {
          const modes = await firstValueFrom(peopleApi.getWorkModes());
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
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          draftTasks: [],
          draftTasksSourceTemplateId: null
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
          patchState(store, {
            positions: page.items.map((p) => ({ value: p.id, label: p.name })),
            loadingPositions: false
          });
        } catch {
          if (store.departmentId() !== departmentId) {
            return;
          }
          patchState(store, { positions: [], loadingPositions: false });
        }
      },

      setPosition(positionId: string): void {
        patchState(store, {
          positionId,
          selectedTemplateId: null,
          selectedTemplateDetail: null,
          selectedTemplateDetailError: null,
          loadingSelectedTemplateDetail: false,
          draftTasks: [],
          draftTasksSourceTemplateId: null
        });
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

      updateDraftTask(clientId: string, patch: Partial<Pick<DraftChecklistTask, 'title' | 'dueDays' | 'isRequired' | 'assignee'>>): void {
        patchState(store, {
          draftTasks: store.draftTasks().map((task) => {
            if (task.clientId !== clientId) {
              return task;
            }
            if (patch.assignee === 'employee') {
              return { ...task, ...patch, preservedOwnerType: null, preservedAssignedToId: null };
            }
            return { ...task, ...patch };
          })
        });
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
        if (!form.workModeId || form.workModeId <= 0) {
          patchState(store, { saveError: 'Work mode is required.' });
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
          lastSavedStep
        };

        patchState(store, { saving: true, saveError: null });
        try {
          const response = await firstValueFrom(peopleApi.saveDraft(payload, store.version()));
          patchState(store, {
            saving: false,
            draftId: response.id,
            version: response.version,
            step: response.lastSavedStep,
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
          await this.loadChecklistTemplateMatches();
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
