import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmployeeDocument } from '@modules/profile/models/profile.model';

/** Read-only view of another employee's personal documents (employees:read + management coverage). */
@Injectable({ providedIn: 'root' })
export class EmployeeDocumentsApiService {
  private readonly http = inject(HttpClient);

  list(employeeId: string): Observable<EmployeeDocument[]> {
    return this.http.get<EmployeeDocument[]>(`${environment.apiUrl}/employees/${employeeId}/documents`);
  }
}
