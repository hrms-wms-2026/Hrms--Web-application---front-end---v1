import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateTaskCommentRequestDto, EditTaskCommentRequestDto, TaskCommentDto } from '../models/dto/task-comment.dto';

@Injectable({ providedIn: 'root' })
export class TaskCommentApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/work`;

  getComments(taskId: string): Observable<TaskCommentDto[]> {
    return this.http.get<TaskCommentDto[]>(`${this.baseUrl}/tasks/${taskId}/comments`);
  }

  postComment(taskId: string, request: CreateTaskCommentRequestDto): Observable<TaskCommentDto> {
    return this.http.post<TaskCommentDto>(`${this.baseUrl}/tasks/${taskId}/comments`, request);
  }

  postReply(commentId: string, request: CreateTaskCommentRequestDto): Observable<TaskCommentDto> {
    return this.http.post<TaskCommentDto>(`${this.baseUrl}/comments/${commentId}/replies`, request);
  }

  editComment(commentId: string, request: EditTaskCommentRequestDto): Observable<TaskCommentDto> {
    return this.http.patch<TaskCommentDto>(`${this.baseUrl}/comments/${commentId}`, request);
  }

  deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/comments/${commentId}`);
  }

  addReaction(commentId: string, emoji: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/comments/${commentId}/reactions`, { emoji });
  }

  removeReaction(commentId: string, emoji: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`);
  }
}
