import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ModuleCapacityCheckDto, ModuleCapacityCheckRequestDto, MonitorAlertDto, TaskLoadCheckDto, TaskLoadCheckRequestDto
} from '../models/dto/monitor.dto';

/** The project monitor: advisory planning checks and the open alerts on the project tree. */
@Injectable({ providedIn: 'root' })
export class ProjectMonitorApiService {
  private readonly http = inject(HttpClient);
  private readonly workBase = `${environment.apiUrl}/work`;

  checkModule(projectId: string, body: ModuleCapacityCheckRequestDto): Observable<ModuleCapacityCheckDto> {
    return this.http.post<ModuleCapacityCheckDto>(`${this.workBase}/projects/${projectId}/monitor/module-check`, body);
  }

  checkTask(projectId: string, body: TaskLoadCheckRequestDto): Observable<TaskLoadCheckDto> {
    return this.http.post<TaskLoadCheckDto>(`${this.workBase}/projects/${projectId}/monitor/task-check`, body);
  }

  listAlerts(projectId: string): Observable<MonitorAlertDto[]> {
    return this.http.get<MonitorAlertDto[]>(`${this.workBase}/projects/${projectId}/monitor/alerts`);
  }
}
