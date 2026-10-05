import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CalendarEventActivityEntryDto,
  CalendarEventDto,
  CalendarEventTaskSummaryDto,
  CreateCalendarEventRequestDto,
  ProjectCalendarDto,
  UpdateCalendarEventRequestDto
} from '../models/dto/calendar.dto';

@Injectable({ providedIn: 'root' })
export class CalendarApiService {
  private readonly http = inject(HttpClient);
  private readonly projectsBase = `${environment.apiUrl}/work/projects`;
  private readonly eventsBase = `${environment.apiUrl}/work/calendar-events`;

  getProjectCalendar(projectId: string): Observable<ProjectCalendarDto> {
    return this.http.get<ProjectCalendarDto>(`${this.projectsBase}/${projectId}/calendar`);
  }

  createEvent(projectId: string, payload: CreateCalendarEventRequestDto): Observable<CalendarEventDto> {
    return this.http.post<CalendarEventDto>(`${this.projectsBase}/${projectId}/calendar-events`, payload);
  }

  updateEvent(id: string, payload: UpdateCalendarEventRequestDto): Observable<CalendarEventDto> {
    return this.http.patch<CalendarEventDto>(`${this.eventsBase}/${id}`, payload);
  }

  closeEvent(id: string): Observable<void> {
    return this.http.post<void>(`${this.eventsBase}/${id}/close`, {});
  }

  getEvent(id: string): Observable<CalendarEventDto> {
    return this.http.get<CalendarEventDto>(`${this.eventsBase}/${id}`);
  }

  getEventTasks(id: string): Observable<CalendarEventTaskSummaryDto[]> {
    return this.http.get<CalendarEventTaskSummaryDto[]>(`${this.eventsBase}/${id}/tasks`);
  }

  getEventActivity(id: string): Observable<CalendarEventActivityEntryDto[]> {
    return this.http.get<CalendarEventActivityEntryDto[]>(`${this.eventsBase}/${id}/activity`);
  }
}
