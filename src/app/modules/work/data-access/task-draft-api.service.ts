import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TaskDraft, TaskDraftPayload, TaskDraftSummary } from '../models/task-draft.model';

/** Wire shape: the backend stores the payload as a JSON string and returns it as `payloadJson`. */
interface TaskDraftWire {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly payloadJson: string;
  readonly updatedAt: string;
}

/** Owner-only "create task" drafts (TaskDraftsController, /api/v1/work/task-drafts). */
@Injectable({ providedIn: 'root' })
export class TaskDraftApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work/task-drafts`;

  list(): Observable<TaskDraftSummary[]> {
    return this.http.get<TaskDraftSummary[]>(this.baseUrl);
  }

  get(id: string): Observable<TaskDraft> {
    return this.http.get<TaskDraftWire>(`${this.baseUrl}/${id}`).pipe(map(toTaskDraft));
  }

  create(projectId: string, title: string, payload: TaskDraftPayload): Observable<TaskDraft> {
    return this.http.post<TaskDraftWire>(this.baseUrl, { projectId, title, payload }).pipe(map(toTaskDraft));
  }

  update(id: string, projectId: string, title: string, payload: TaskDraftPayload): Observable<TaskDraft> {
    return this.http.put<TaskDraftWire>(`${this.baseUrl}/${id}`, { projectId, title, payload }).pipe(map(toTaskDraft));
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}

function toTaskDraft(wire: TaskDraftWire): TaskDraft {
  return {
    id: wire.id,
    projectId: wire.projectId,
    title: wire.title,
    payload: JSON.parse(wire.payloadJson) as TaskDraftPayload,
    updatedAt: wire.updatedAt
  };
}
