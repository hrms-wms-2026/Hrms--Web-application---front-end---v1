import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal, viewChild } from '@angular/core';
import { toDataURL } from 'qrcode';
import { ProfileStore } from '../../state/profile.store';
import { PersonalInfoFormComponent } from '../../ui/personal-info-form/personal-info-form.component';
import { JobInfoPanelComponent } from '../../ui/job-info-panel/job-info-panel.component';
import { EmergencyContactsPanelComponent } from '../../ui/emergency-contacts-panel/emergency-contacts-panel.component';
import { DependentsPanelComponent } from '../../ui/dependents-panel/dependents-panel.component';
import { PayrollPanelComponent } from '../../ui/payroll-panel/payroll-panel.component';
import { SecurityPanelComponent } from '../../ui/security-panel/security-panel.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProfileSubTabId } from '../../models/profile-subtab.model';
import {
  UpdateBankDetailsRequest,
  UpdatePersonalInformationRequest,
  UpsertDependentRequest,
  UpsertEmergencyContactRequest
} from '../../models/profile.model';

@Component({
  selector: 'app-profile-tab',
  standalone: true,
  imports: [
    PersonalInfoFormComponent,
    JobInfoPanelComponent,
    EmergencyContactsPanelComponent,
    DependentsPanelComponent,
    PayrollPanelComponent,
    SecurityPanelComponent,
    ButtonComponent
  ],
  templateUrl: './profile-tab.component.html',
  styleUrl: './profile-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileTabComponent implements OnInit {
  readonly store = inject(ProfileStore);

  readonly activeSubTab = input<ProfileSubTabId>('personal');
  readonly cancelled = output<void>();

  private readonly contactsPanel = viewChild<EmergencyContactsPanelComponent>('contactsPanel');
  private readonly dependentsPanel = viewChild<DependentsPanelComponent>('dependentsPanel');
  readonly qrCodeImage = signal<string | null>(null);
  readonly qrCodeSecret = signal<string | null>(null);

  ngOnInit(): void {
    this.store.loadProfile();
  }

  onSavePersonalInformation(payload: UpdatePersonalInformationRequest): void {
    this.store.savePersonalInformation(payload);
  }

  onAvatarSelected(file: File): void {
    this.store.uploadAvatar(file);
  }

  onAddEmergencyContact(payload: UpsertEmergencyContactRequest): void {
    this.store.addEmergencyContact(payload);
  }

  onRemoveEmergencyContact(id: string): void {
    this.store.removeEmergencyContact(id);
  }

  onAddDependent(payload: UpsertDependentRequest): void {
    this.store.addDependent(payload);
  }

  /** Footer save on the Emergency tab: adds whatever is typed into either add-form; closes when both are empty. */
  onSaveEmergency(): void {
    const results = [this.contactsPanel()?.submitIfFilled(), this.dependentsPanel()?.submitIfFilled()];
    if (results.every((r) => r === 'empty' || r === undefined)) {
      this.cancelled.emit();
    }
  }

  onRemoveDependent(id: string): void {
    this.store.removeDependent(id);
  }

  onSavePayroll(payload: UpdateBankDetailsRequest): void {
    this.store.savePayroll(payload);
  }

  async onStartMfaSetup(): Promise<void> {
    const result = await this.store.enableMfa();
    if (!result) {
      this.qrCodeImage.set(null);
      this.qrCodeSecret.set(null);
      return;
    }
    this.qrCodeSecret.set(result.secret);
    this.qrCodeImage.set(await toDataURL(result.qrCodeUri));
  }

  onChangePassword(payload: { currentPassword: string; newPassword: string }): void {
    this.store.changePassword(payload.currentPassword, payload.newPassword);
  }

  onConfirmMfaSetup(code: string): void {
    this.store.confirmMfaSetup(code);
  }

  onDisableMfa(currentPassword: string): void {
    this.store.disableMfa(currentPassword);
  }
}
