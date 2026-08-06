import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ORGANIZATION_ROUTES } from './organization.routes';

describe('ORGANIZATION_ROUTES', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(ORGANIZATION_ROUTES)]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('redirects root path / to departments', async () => {
    await router.navigateByUrl('/');
    expect(router.url).toBe('/departments');
  });

  it('navigates to departments route successfully', async () => {
    const success = await router.navigateByUrl('/departments');
    expect(success).toBe(true);
    expect(router.url).toBe('/departments');
  });

  it('navigates to positions route successfully', async () => {
    const success = await router.navigateByUrl('/positions');
    expect(success).toBe(true);
    expect(router.url).toBe('/positions');
  });
});

describe('ORGANIZATION_ROUTES composed under /organization (matches app.routes.ts)', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'organization', children: ORGANIZATION_ROUTES }])]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('redirects /organization to /organization/departments', async () => {
    await router.navigateByUrl('/organization');
    expect(router.url).toBe('/organization/departments');
  });
});
