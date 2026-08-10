import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { SelectOption } from '../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../organization/data-access/department-api.service';
import { PositionApiService } from '../../organization/data-access/position-api.service';
import { PeopleApiService } from '../data-access/people-api.service';
import { OnboardingDraftResponse, SaveOnboardingDraftPayload, WizardStep } from '../models/onboarding-draft.model';

export interface AddEmployeeFormValue {
  employeeName: string;
  workEmail: string;
  employmentType: string;
  startDate: string;
  employeeNumber: string;
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

  // No work_schedules/checklist_templates backend source exists in this slice - these stay
  // permanently empty with an explicit "unavailable" flag, never a fabricated option list.
  readonly schedules: readonly SelectOption[];
  readonly checklistTemplates: readonly SelectOption[];
  readonly schedulesUnavailable: boolean;
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
}

const initialFormValue: AddEmployeeFormValue = {
  employeeName: '',
  workEmail: '',
  employmentType: '',
  startDate: '',
  employeeNumber: ''
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

  schedules: [],
  checklistTemplates: [],
  schedulesUnavailable: true,
  checklistTemplatesUnavailable: true,

  formValue: initialFormValue,

  draftId: null,
  version: null,
  lastSaveStatus: null,
  lastSaveReason: null,

  saving: false,
  saveError: null,
  resuming: false,
  resumeError: null
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
        const payload: SaveOnboardingDraftPayload = {
          draftId: store.draftId() ?? undefined,
          employeeName: form.employeeName,
          workEmail: form.workEmail,
          legalEntityId: store.companyId() ?? '',
          departmentId: store.departmentId(),
          positionId: store.positionId(),
          employmentType: form.employmentType,
          startDate: form.startDate,
          employeeNumber: form.employeeNumber || null,
          scheduleId: null,
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
              employeeName: draft.employeeName,
              workEmail: draft.workEmail,
              employmentType: draft.employmentType,
              startDate: draft.startDate,
              employeeNumber: draft.employeeNumber ?? ''
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
      }
    })
  )
);
