import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { DepartmentStore } from '../../../organization/state/department.store';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { PositionStore } from '../../../organization/state/position.store';
import { RoleStore } from '../../../organization/state/role.store';
import { WorkModeStore } from '../../../settings/state/work-mode.store';
import { MonitoringStore } from '../../state/monitoring.store';
import {
  MonitoringFeatureToggles,
  MonitoringPolicyOverride,
  MonitoringPolicyOverrideRequest,
  MonitoringScopeType,
  MONITORING_SCOPE_LABELS
} from '../../models/monitoring.model';

const emptyOverride = (): MonitoringPolicyOverrideRequest => ({
  activityMonitoring: null,
  applicationTracking: null,
  documentTracking: null,
  communicationTracking: null,
  screenshotCapture: null,
  autoScreenshotCapture: null,
  meetingDetection: null,
  deviceTracking: null,
  workLocationVerification: null,
  identityVerification: null,
  biometric: null,
  idleThresholdMinutes: null,
  allowedRadiusMeters: null,
  overrideReason: null
});

@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbHeaderComponent, SelectComponent],
  templateUrl: './monitoring.component.html',
  styleUrl: './monitoring.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonitoringComponent {
  private readonly permissions = inject(PermissionService);
  private readonly notifications = inject(NotificationService);
  readonly monitoringStore = inject(MonitoringStore);
  readonly legalEntityStore = inject(LegalEntityStore);
  readonly departmentStore = inject(DepartmentStore);
  readonly positionStore = inject(PositionStore);
  readonly roleStore = inject(RoleStore);
  readonly workModeStore = inject(WorkModeStore);

  readonly hasReadAccess = computed(
    () => this.permissions.hasModule('time_attendance') && this.permissions.hasPermission('monitoring:read')
  );
  readonly hasWriteAccess = computed(() => this.permissions.hasPermission('monitoring:configure'));
  readonly selectedScope = this.monitoringStore.selectedScope;
  readonly companyDefault = signal<MonitoringFeatureToggles | null>(null);
  readonly companyForm = signal<MonitoringFeatureToggles | null>(null);
  readonly overrideForm = signal<MonitoringPolicyOverrideRequest>(emptyOverride());
  readonly selectedTargetId = signal('');
  readonly editMode = signal(false);
  readonly scopeLabels = MONITORING_SCOPE_LABELS;
  readonly scopeOptions: readonly MonitoringScopeType[] = ['department', 'position', 'role', 'work_mode'];

  scopeLabel(scope: MonitoringScopeType): string {
    return this.scopeLabels[scope];
  }

  overrideCount(scope: MonitoringScopeType): number {
    return this.monitoringStore.overrides().filter((item) => item.scopeType === scope).length;
  }

  readonly visibleOverrides = computed(() =>
    this.monitoringStore.overrides().filter((item) => item.scopeType === this.selectedScope())
  );

  readonly targetOptions = computed(() => {
    switch (this.selectedScope()) {
      case 'department':
        return this.departmentStore.allFlatList().filter((item) => item.isActive).map((item) => ({ id: item.id, name: item.name }));
      case 'position':
        return this.positionStore.allPositionsList().filter((item) => item.isActive).map((item) => ({ id: item.id, name: item.name }));
      case 'role':
        return this.roleStore.roles().map((item) => ({ id: item.id, name: item.name }));
      case 'work_mode':
        return this.workModeStore.items().filter((item) => item.isActive).map((item) => ({ id: item.id, name: item.name }));
      default:
        return [];
    }
  });

  readonly targetSelectOptions = computed<readonly SelectOption[]>(() => {
    return this.targetOptions().map((item) => ({
      value: item.id,
      label: item.name
    }));
  });

  targetPlaceholder(): string {
    switch (this.selectedScope()) {
      case 'department':
        return 'Select a department';
      case 'position':
        return 'Select a position';
      case 'role':
        return 'Select a role';
      case 'work_mode':
        return 'Select a work mode';
      default:
        return 'Select a target';
    }
  }

  readonly overrideFieldList: readonly { readonly key: keyof MonitoringPolicyOverrideRequest; readonly label: string }[] = [
    { key: 'workLocationVerification', label: 'Location tracking' },
    { key: 'activityMonitoring', label: 'Keyboard and mouse activity' },
    { key: 'applicationTracking', label: 'Application usage' },
    { key: 'screenshotCapture', label: 'Screenshot capture' }
  ];

  getOverrideFlag(key: keyof MonitoringPolicyOverrideRequest): boolean | null {
    const val = this.overrideForm()[key];
    return typeof val === 'boolean' ? val : null;
  }

  readonly hasActiveCompanyContext = this.monitoringStore.hasActiveCompanyContext;

  private rolesLoaded = false;

  constructor() {
    effect(() => {
      if (!this.hasReadAccess() || this.legalEntityStore.loaded()) return;
      void this.legalEntityStore.loadCompanies();
    });

    effect(() => {
      if (!this.hasReadAccess()) return;
      const company = this.legalEntityStore.selectedLegalEntity();
      untracked(() => {
        void this.monitoringStore.load();
        if (company) {
          void this.departmentStore.load(company.id);
          void this.positionStore.load(company.id);
          this.workModeStore.load(company.id);
        }
        if (!this.rolesLoaded) {
          this.rolesLoaded = true;
          void this.roleStore.loadRolesOnly();
        }
      });
    });

    effect(() => {
      const value = this.monitoringStore.companyDefault();
      if (value && !this.companyForm()) {
        this.companyDefault.set(value);
        this.companyForm.set({ ...value });
      }
    });
  }

  setScope(scope: MonitoringScopeType): void {
    this.monitoringStore.selectScope(scope);
    this.clearOverrideForm();
  }

  setCompanyFlag(key: keyof MonitoringFeatureToggles, value: boolean): void {
    if (!this.hasWriteAccess() || key === 'updatedAt' || key === 'idleThresholdMinutes' || key === 'allowedRadiusMeters') return;
    this.companyForm.update((current) => current ? { ...current, [key]: value } : current);
  }

  setCompanyThreshold(value: string): void {
    if (!this.hasWriteAccess()) return;
    const threshold = Number(value);
    this.companyForm.update((current) => current ? { ...current, idleThresholdMinutes: Number.isFinite(threshold) ? threshold : current.idleThresholdMinutes } : current);
  }

  setCompanyAllowedRadius(value: string): void {
    if (!this.hasWriteAccess()) return;
    const parsed = value.trim() === '' ? null : Number(value);
    this.companyForm.update((current) => current ? { ...current, allowedRadiusMeters: parsed === null || Number.isFinite(parsed) ? parsed : current.allowedRadiusMeters } : current);
  }

  async saveCompany(): Promise<void> {
    const form = this.companyForm();
    if (!form || !this.hasWriteAccess()) return;
    const { updatedAt: _updatedAt, ...payload } = form;
    if (payload.idleThresholdMinutes < 1 || payload.idleThresholdMinutes > 1440) {
      this.notifications.error('Activity threshold must be between 1 and 1440 minutes.');
      return;
    }
    if (await this.monitoringStore.saveCompany(payload)) {
      this.notifications.success('Monitoring defaults saved.');
      this.companyForm.set({ ...this.monitoringStore.companyDefault()! });
    } else {
      this.notifications.error(this.monitoringStore.saveError() ?? 'Could not save monitoring defaults.');
    }
  }

  selectTarget(targetId: string): void {
    this.selectedTargetId.set(targetId);
    const existing = this.visibleOverrides().find((item) => item.scopeId === targetId);
    this.editMode.set(!!existing);
    this.overrideForm.set(existing ? this.formFromOverride(existing) : emptyOverride());
  }

  setOverrideFlag(key: keyof MonitoringPolicyOverrideRequest, value: boolean | null): void {
    if (!this.hasWriteAccess() || key === 'idleThresholdMinutes' || key === 'allowedRadiusMeters' || key === 'overrideReason') return;
    this.overrideForm.update((current) => ({ ...current, [key]: value }));
  }

  setOverrideThreshold(value: string): void {
    const parsed = value.trim() === '' ? null : Number(value);
    this.overrideForm.update((current) => ({ ...current, idleThresholdMinutes: parsed === null || Number.isFinite(parsed) ? parsed : current.idleThresholdMinutes }));
  }

  setOverrideAllowedRadius(value: string): void {
    const parsed = value.trim() === '' ? null : Number(value);
    this.overrideForm.update((current) => ({ ...current, allowedRadiusMeters: parsed === null || Number.isFinite(parsed) ? parsed : current.allowedRadiusMeters }));
  }

  overrideSelectValue(key: keyof MonitoringPolicyOverrideRequest): string {
    const value = this.overrideForm()[key];
    return value === null || value === undefined ? '' : String(value);
  }

  selectToBoolean(value: string): boolean | null {
    return value === '' ? null : value === 'true';
  }

  setOverrideReason(value: string): void {
    this.overrideForm.update((current) => ({ ...current, overrideReason: value }));
  }

  async saveOverride(): Promise<void> {
    const targetId = this.selectedTargetId();
    if (!targetId || !this.hasWriteAccess()) {
      this.notifications.error('Select a target before saving an override.');
      return;
    }
    const threshold = this.overrideForm().idleThresholdMinutes;
    if (threshold != null && (threshold < 1 || threshold > 1440)) {
      this.notifications.error('Activity threshold must be between 1 and 1440 minutes.');
      return;
    }
    if (await this.monitoringStore.saveOverride(this.selectedScope(), targetId, this.overrideForm())) {
      this.notifications.success('Monitoring override saved.');
      this.clearOverrideForm();
    } else {
      this.notifications.error(this.monitoringStore.saveError() ?? 'Could not save this monitoring override.');
    }
  }

  async removeOverride(item: MonitoringPolicyOverride): Promise<void> {
    if (!this.hasWriteAccess()) return;
    if (!window.confirm(`Remove the monitoring override for ${item.targetName}?`)) return;
    if (await this.monitoringStore.removeOverride(item.scopeType, item.scopeId)) {
      this.notifications.success('Monitoring override removed.');
      if (this.selectedTargetId() === item.scopeId) this.clearOverrideForm();
    } else {
      this.notifications.error(this.monitoringStore.saveError() ?? 'Could not remove this monitoring override.');
    }
  }

  clearOverrideForm(): void {
    this.selectedTargetId.set('');
    this.overrideForm.set(emptyOverride());
    this.editMode.set(false);
  }

  flagValue(value: boolean | null): string {
    return value == null ? 'Inherited' : value ? 'On' : 'Off';
  }

  private formFromOverride(item: MonitoringPolicyOverride): MonitoringPolicyOverrideRequest {
    return {
      activityMonitoring: item.activityMonitoring,
      applicationTracking: item.applicationTracking,
      documentTracking: item.documentTracking,
      communicationTracking: item.communicationTracking,
      screenshotCapture: item.screenshotCapture,
      autoScreenshotCapture: item.autoScreenshotCapture,
      meetingDetection: item.meetingDetection,
      deviceTracking: item.deviceTracking,
      workLocationVerification: item.workLocationVerification,
      identityVerification: item.identityVerification,
      biometric: item.biometric,
      idleThresholdMinutes: item.idleThresholdMinutes,
      allowedRadiusMeters: item.allowedRadiusMeters,
      overrideReason: item.overrideReason
    };
  }
}
