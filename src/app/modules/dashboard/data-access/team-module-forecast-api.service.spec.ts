import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { TeamModuleForecastApiService } from './team-module-forecast-api.service';

describe('TeamModuleForecastApiService', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    return { api: TestBed.inject(TeamModuleForecastApiService), http: TestBed.inject(HttpTestingController) };
  }

  it('asks for one page, leaving unset filters out', () => {
    const { api, http } = setup();
    api.get({ status: null, projectId: null, search: '  ', sort: 'overtime', page: 1, pageSize: 10 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/work/forecast/modules'));
    expect(req.request.params.keys().sort()).toEqual(['page', 'pageSize', 'sort']);
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush({});
  });

  it('sends status, project and search when set', () => {
    const { api, http } = setup();
    api.get({ status: 'overtime', projectId: 'p1', search: ' api ', sort: 'endDate', page: 2, pageSize: 25 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/work/forecast/modules'));
    expect(req.request.params.get('status')).toBe('overtime');
    expect(req.request.params.get('projectId')).toBe('p1');
    expect(req.request.params.get('search')).toBe('api');
    expect(req.request.params.get('sort')).toBe('endDate');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({});
  });
});
