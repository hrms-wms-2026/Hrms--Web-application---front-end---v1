import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ActiveHolder,
  AddCoverageRecordRequest,
  CoverageResolutionLevel,
  CoverageVisualizationResponse,
  CreatePositionRequest,
  ListPositionsQueryParams,
  ManagementCoverageRecordResponse,
  PositionArchiveBlockers,
  PositionAccessTemplateResponse,
  PositionPageResponse,
  PositionResponse,
  PositionTemplatePackListResponse,
  PositionPeopleChartNode,
  PositionTreeNodeResponse,
  ReportingLineMoveImpact,
  ReportingLineMoveRequest,
  SetPositionAccessRequest,
  UpdateCoverageRecordRequest,
  UpdatePositionRequest
} from '../models/position.model';

@Injectable({ providedIn: 'root' })
export class PositionApiService {
  private readonly http = inject(HttpClient);

  listPositionTemplatePacks(): Observable<PositionTemplatePackListResponse> {
    return this.http.get<PositionTemplatePackListResponse>(
      `${environment.apiUrl}/org/position-template-packs`
    );
  }


  listFlat(
    legalEntityId: string,
    params?: ListPositionsQueryParams
  ): Observable<PositionPageResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.departmentId) httpParams = httpParams.set('departmentId', params.departmentId);
      if (params.search) httpParams = httpParams.set('search', params.search);
      if (params.includeInactive !== undefined) httpParams = httpParams.set('includeInactive', params.includeInactive);
      if (params.page) httpParams = httpParams.set('page', params.page);
      if (params.pageSize) httpParams = httpParams.set('pageSize', params.pageSize);
      if (params.sortBy) httpParams = httpParams.set('sortBy', params.sortBy);
      if (params.sortDirection) httpParams = httpParams.set('sortDirection', params.sortDirection);
    }
    return this.http.get<PositionPageResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions`,
      { params: httpParams }
    );
  }

  listTree(
    legalEntityId: string,
    includeInactive = false
  ): Observable<readonly PositionTreeNodeResponse[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<readonly PositionTreeNodeResponse[]>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/tree`,
      { params }
    );
  }

  /** One card per position holder under who they actually report to, plus vacant positions. */
  getPeopleChart(legalEntityId: string): Observable<readonly PositionPeopleChartNode[]> {
    return this.http.get<readonly PositionPeopleChartNode[]>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/people-chart`
    );
  }

  previewReportingLineMove(
    legalEntityId: string,
    payload: ReportingLineMoveRequest
  ): Observable<ReportingLineMoveImpact> {
    return this.http.post<ReportingLineMoveImpact>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/people-chart/reporting-line/preview`,
      payload
    );
  }

  moveReportingLines(
    legalEntityId: string,
    payload: ReportingLineMoveRequest
  ): Observable<ReportingLineMoveImpact> {
    return this.http.post<ReportingLineMoveImpact>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/people-chart/reporting-line/move`,
      payload
    );
  }

  getPosition(legalEntityId: string, positionId: string): Observable<PositionResponse> {
    return this.http.get<PositionResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}`
    );
  }

  createPosition(
    legalEntityId: string,
    payload: CreatePositionRequest
  ): Observable<PositionResponse> {
    return this.http.post<PositionResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions`,
      payload
    );
  }

  updatePosition(
    legalEntityId: string,
    positionId: string,
    payload: UpdatePositionRequest
  ): Observable<PositionResponse> {
    return this.http.put<PositionResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}`,
      payload
    );
  }

  checkArchive(legalEntityId: string, positionId: string): Observable<PositionArchiveBlockers> {
    return this.http.post<PositionArchiveBlockers>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/archive-check`,
      {}
    );
  }

  archivePosition(legalEntityId: string, positionId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/archive`,
      {}
    );
  }

  restorePosition(legalEntityId: string, positionId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/restore`,
      {}
    );
  }

  listCoverage(
    legalEntityId: string,
    positionId: string
  ): Observable<readonly ManagementCoverageRecordResponse[]> {
    return this.http.get<readonly ManagementCoverageRecordResponse[]>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/coverage`
    );
  }

  getCoverageVisualization(
    legalEntityId: string,
    positionId: string
  ): Observable<CoverageVisualizationResponse> {
    return this.http.get<CoverageVisualizationResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/coverage-visualization`
    );
  }

  /**
   * Every active coverage record for a specific covered target, regardless of which position owns
   * each rule. Used to compute the true occupied-responsibility-level set before the user submits,
   * instead of only finding out via a 409 from addCoverage/updateCoverage - listCoverage() above
   * only returns records owned by one position and can't see this on its own.
   */
  listCoverageByTarget(
    legalEntityId: string,
    coveredTargetType: 'Position' | 'Department',
    coveredPositionId: string | null,
    coveredDepartmentId: string | null,
    excludingRecordId?: string | null
  ): Observable<readonly ManagementCoverageRecordResponse[]> {
    let params = new HttpParams().set('coveredTargetType', coveredTargetType);
    if (coveredPositionId) params = params.set('coveredPositionId', coveredPositionId);
    if (coveredDepartmentId) params = params.set('coveredDepartmentId', coveredDepartmentId);
    if (excludingRecordId) params = params.set('excludingRecordId', excludingRecordId);

    return this.http.get<readonly ManagementCoverageRecordResponse[]>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/coverage/by-target`,
      { params }
    );
  }

  getActiveHolders(legalEntityId: string, positionId: string): Observable<readonly ActiveHolder[]> {
    return this.http.get<readonly ActiveHolder[]>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/active-holders`
    );
  }

  resolveCoverage(
    legalEntityId: string,
    coveredTargetType: 'Position' | 'Department',
    coveredPositionId: string | null,
    coveredDepartmentId: string | null
  ): Observable<readonly CoverageResolutionLevel[]> {
    let params = new HttpParams().set('coveredTargetType', coveredTargetType);
    if (coveredPositionId) params = params.set('coveredPositionId', coveredPositionId);
    if (coveredDepartmentId) params = params.set('coveredDepartmentId', coveredDepartmentId);

    return this.http.get<readonly CoverageResolutionLevel[]>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/coverage/resolve`,
      { params }
    );
  }

  addCoverage(
    legalEntityId: string,
    positionId: string,
    payload: AddCoverageRecordRequest
  ): Observable<ManagementCoverageRecordResponse> {
    return this.http.post<ManagementCoverageRecordResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/coverage`,
      payload
    );
  }

  updateCoverage(
    legalEntityId: string,
    positionId: string,
    coverageId: string,
    payload: UpdateCoverageRecordRequest
  ): Observable<ManagementCoverageRecordResponse> {
    return this.http.put<ManagementCoverageRecordResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/coverage/${coverageId}`,
      payload
    );
  }

  removeCoverage(
    legalEntityId: string,
    positionId: string,
    coverageId: string
  ): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/coverage/${coverageId}/remove`,
      {}
    );
  }

  getPositionAccess(
    legalEntityId: string,
    positionId: string
  ): Observable<PositionAccessTemplateResponse> {
    return this.http.get<PositionAccessTemplateResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/access`
    );
  }

  setPositionAccess(
    legalEntityId: string,
    positionId: string,
    payload: SetPositionAccessRequest
  ): Observable<PositionAccessTemplateResponse> {
    return this.http.put<PositionAccessTemplateResponse>(
      `${environment.apiUrl}/org/legal-entities/${legalEntityId}/positions/${positionId}/access`,
      payload
    );
  }
}
