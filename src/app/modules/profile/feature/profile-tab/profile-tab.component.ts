import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { toDataURL } from 'qrcode';
import { ProfileStore } from '../../state/profile.store';
import { PersonalInfoFormComponent } from '../../ui/personal-info-form/personal-info-form.component';
import { JobInfoPanelComponent } from '../../ui/job-info-panel/job-info-panel.component';
import { EmergencyContactsPanelComponent } from '../../ui/emergency-contacts-panel/emergency-contacts-panel.component';
import { DependentsPanelComponent } from '../../ui/dependents-panel/dependents-panel.component';
import { PayrollPanelComponent } from '../../ui/payroll-panel/payroll-panel.component';
import { SecurityPanelComponent } from '../../ui/security-panel/security-panel.component';
import { DocumentsPanelComponent, DocumentRowAction } from '../../ui/documents-panel/documents-panel.component';
import { DocumentUploadPanelComponent } from '../../ui/document-upload-panel/document-upload-panel.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProfileSubTabId } from '../../models/profile-subtab.model';
import { toViewableBlob } from '../../models/employee-document.config';
import {
  EmployeeDocument,
  EmployeeDocumentType,
  UpdateBankDetailsRequest,
  UploadEmployeeDocumentRequest,
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
    DocumentsPanelComponent,
    DocumentUploadPanelComponent,
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
  /** Type preselected in the open "Upload document" panel; null while the panel is closed. */
  readonly uploadType = signal<EmployeeDocumentType | null>(null);
  private documentsRequested = false;

  constructor() {
    // Documents load lazily the first time their tab is shown; the upload panel never outlives it.
    effect(() => {
      const onDocuments = this.activeSubTab() === 'documents';
      untracked(() => {
        if (onDocuments && !this.documentsRequested) {
          this.documentsRequested = true;
          this.store.loadDocuments();
        }
        if (!onDocuments) this.uploadType.set(null);
      });
    });
  }

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

  openUpload(type: EmployeeDocumentType): void {
    this.store.clearDocumentError();
    // Re-create the panel so a different category card re-seeds its preselected type.
    this.uploadType.set(null);
    queueMicrotask(() => this.uploadType.set(type));
  }

  closeUpload(): void {
    this.uploadType.set(null);
    this.store.clearDocumentError();
  }

  async onUploadDocument(request: UploadEmployeeDocumentRequest): Promise<void> {
    if (await this.store.uploadDocument(request)) {
      this.uploadType.set(null);
    }
  }

  async onDocumentAction(action: DocumentRowAction, document: EmployeeDocument): Promise<void> {
    const blob = await this.store.downloadDocument(document);
    if (!blob) return;
    // Word files (and anything not a PDF/image) are downloaded even when "View" is chosen.
    const viewable = action === 'view' ? toViewableBlob(blob, document.fileName) : null;
    const url = URL.createObjectURL(viewable ?? blob);
    if (viewable) {
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return;
    }
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.fileName || document.name;
    anchor.style.display = 'none';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
