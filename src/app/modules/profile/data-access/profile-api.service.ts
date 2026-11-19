import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  EmployeeDocument,
  EmployeeDocumentType,
  MyProfile,
  PayrollInfo,
  UpdateBankDetailsRequest,
  UpdatePersonalInformationRequest,
  UpsertDependentRequest,
  UpsertEmergencyContactRequest
} from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/employees/me`;

  getMyProfile(): Observable<MyProfile> {
    return this.http.get<MyProfile>(this.base);
  }

  updatePersonalInformation(payload: UpdatePersonalInformationRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/personal-information`, payload);
  }

  linkAvatar(fileId: string): Observable<{ avatarFileId: string | null }> {
    return this.http.put<{ avatarFileId: string | null }>(`${this.base}/avatar`, { fileId });
  }

  removeAvatar(): Observable<void> {
    return this.http.delete<void>(`${this.base}/avatar`);
  }

  listDocuments(): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${this.base}/documents`);
  }

  addDocument(fileId: string, type: EmployeeDocumentType, name: string): Observable<EmployeeDocument> {
    return this.http.post<EmployeeDocument>(`${this.base}/documents`, { fileId, type, name });
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/documents/${id}`);
  }

  addEmergencyContact(payload: UpsertEmergencyContactRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/emergency-contacts`, payload);
  }

  updateEmergencyContact(id: string, payload: UpsertEmergencyContactRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/emergency-contacts/${id}`, payload);
  }

  deleteEmergencyContact(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/emergency-contacts/${id}`);
  }

  addDependent(payload: UpsertDependentRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/dependents`, payload);
  }

  updateDependent(id: string, payload: UpsertDependentRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/dependents/${id}`, payload);
  }

  deleteDependent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dependents/${id}`);
  }

  getPayroll(): Observable<PayrollInfo> {
    return this.http.get<PayrollInfo>(`${this.base}/payroll`);
  }

  updatePayroll(payload: UpdateBankDetailsRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/payroll`, payload);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword });
  }

  enableMfa(): Observable<{ secret: string; qrCodeUri: string }> {
    return this.http.post<{ secret: string; qrCodeUri: string }>(`${environment.apiUrl}/auth/mfa/enable`, {});
  }

  confirmMfaSetup(code: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/auth/mfa/confirm-setup`, { code });
  }

  disableMfa(currentPassword: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/auth/mfa/disable`, { currentPassword });
  }
}
