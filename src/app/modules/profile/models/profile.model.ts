export interface Address {
  id: string;
  addressType: 'permanent' | 'current';
  addressJson: string;
  isPrimary: boolean;
}

export interface PersonalInformation {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationalityId: string | null;
  countryName: string | null;
  displayTimezone: string | null;
  legalEntityTimezone: string | null;
  avatarFileId: string | null;
  addresses: Address[];
  version: string;
}

export interface JobInformation {
  employeeNumber: string;
  legalEntityName: string | null;
  departmentName: string | null;
  positionName: string | null;
  reportingManagerName: string | null;
  employmentTypeLabel: string;
  employmentStatus: string;
  hireDate: string;
  probationEndDate: string | null;
  workMode: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

export interface Dependent {
  id: string;
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'other';
  dateOfBirth: string;
  isEmergencyContact: boolean;
  phone: string | null;
}

export interface PayrollInfo {
  hasBankDetailsOnFile: boolean;
  bankName: string | null;
  maskedAccountNumber: string | null;
  accountType: string | null;
  canEdit: boolean;
}

export interface SecurityInfo {
  mfaEnabled: boolean;
  lastPasswordChangedAt: string | null;
}

export interface MyProfile {
  personalInformation: PersonalInformation;
  jobInformation: JobInformation;
  emergencyContacts: EmergencyContact[];
  dependents: Dependent[];
  payroll: PayrollInfo;
  security: SecurityInfo;
}

export interface UpdatePersonalInformationRequest {
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationalityId: string | null;
  displayTimezone: string | null;
  addresses: { addressType: 'permanent' | 'current'; addressJson: string; isPrimary: boolean }[];
  version: string;
}

export interface UpsertEmergencyContactRequest {
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

export interface UpsertDependentRequest {
  name: string;
  relationship: Dependent['relationship'];
  dateOfBirth: string;
  isEmergencyContact: boolean;
  phone: string | null;
}

export interface UpdateBankDetailsRequest {
  bankName: string;
  branchName: string;
  accountHolderName: string;
  accountNumber: string;
  accountType: string;
  routingNumber: string | null;
}

export type EmployeeDocumentType = 'cv' | 'identity' | 'certificate' | 'other';

export interface EmployeeDocument {
  id: string;
  fileId: string;
  name: string;
  documentType: EmployeeDocumentType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedAt: string;
}

export interface UploadEmployeeDocumentRequest {
  file: File;
  type: EmployeeDocumentType;
  name: string;
}
