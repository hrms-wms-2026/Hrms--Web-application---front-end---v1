import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrayInstallerApiService } from './tray-installer-api.service';
import { environment } from '../../../../environments/environment';

describe('TrayInstallerApiService', () => {
  let service: TrayInstallerApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(TrayInstallerApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('requests the stable channel installer', () => {
    service.getLatest().subscribe();
    const req = http.expectOne(`${environment.apiUrl}/tray/releases/latest?channel=stable`);
    expect(req.request.method).toBe('GET');
    req.flush({ version: '1.0.0' });
  });
});
