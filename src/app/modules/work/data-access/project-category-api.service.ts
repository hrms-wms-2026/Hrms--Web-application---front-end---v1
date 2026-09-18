import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ProjectCategoryDto } from '../models/dto/project-category.dto';

@Injectable({ providedIn: 'root' })
export class ProjectCategoryApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<ProjectCategoryDto[]> {
    return this.http.get<ProjectCategoryDto[]>(`${environment.apiUrl}/work/project-categories`);
  }

  create(name: string): Observable<ProjectCategoryDto> {
    return this.http.post<ProjectCategoryDto>(`${environment.apiUrl}/work/project-categories`, { name });
  }
}
