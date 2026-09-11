import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TaskProgressResponse } from '../models/task-progress.model';

@Injectable({ providedIn: 'root' })
export class TaskProgressApiService {
  private readonly http = inject(HttpClient);
  private readonly basePath = `${environment.apiUrl}/work`;

  getMyTaskProgress(): Observable<TaskProgressResponse> {
    return this.http.get<TaskProgressResponse>(`${this.basePath}/my-task-progress`);
  }
}
