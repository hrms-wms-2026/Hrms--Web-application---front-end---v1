import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { SelectOption } from '../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../organization/data-access/department-api.service';
import { PositionApiService } from '../../organization/data-access/position-api.service';
import { PeopleApiService } from '../data-access/people-api.service';
import {
  FinalizeOnboardingDraftResponse,
  OnboardingDraftResponse,
  SaveOnboardingDraftPayload,
  WizardStep,
  WorkModeOption
} from '../models/onboarding-draft.model';


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
      positionApi = inject(PositionApiService)
    ) => ({
      reset(): void {
        patchState(store, initialState);
      },

      setCompany(companyId: string): void {
        patchState(store, {
          companyId,
          departmentId: null,
          positionId: null,
          departments: [],
          positions: []
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
        patchState(store, { departmentId, positionId: null, positions: [] });
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
        patchState(store, { positionId });
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
          selectedTemplateId: null,
          editedTasksJson: null,
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
          patchState(store, {
            resuming: false,
            draftId: draft.id,
            version: draft.version,
            step: draft.lastSavedStep,
            companyId: draft.legalEntityId,
            departmentId: draft.departmentId,
            positionId: draft.positionId,
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
    })
  )
);
