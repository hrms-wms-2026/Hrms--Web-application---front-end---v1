import { TestBed } from '@angular/core/testing';
import { ROUTER_CONFIGURATION } from '@angular/router';
import { appConfig } from './app.config';

describe('appConfig', () => {
  it('configures the router with param inheritance enabled, so nested milestone tabs can read the ancestor milestoneId param', () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const routerConfig = TestBed.inject(ROUTER_CONFIGURATION);
    expect(routerConfig.paramsInheritanceStrategy).toBe('always');
  });
});
