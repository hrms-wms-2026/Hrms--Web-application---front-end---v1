import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TrayInstallerInfo } from '../models/tray-installer.model';

@Injectable({ providedIn: 'root' })
export class TrayInstallerApiService {
  private readonly http = inject(HttpClient);

  getLatest(): Observable<TrayInstallerInfo> {
    return this.http.get<TrayInstallerInfo>(
      `${environment.apiUrl}/tray/releases/latest?channel=stable`
    );
  }
}
