import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { APP_RUNTIME_CONFIG, appRuntimeConfig } from './core/config/app.config';
import { tenantHeaderInterceptor } from './core/interceptors/tenant-header.interceptor';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { correlationInterceptor } from './core/interceptors/correlation.interceptor';
import { csrfInterceptor } from './core/interceptors/csrf.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' })
    ),
    provideHttpClient(
      withInterceptors([tenantHeaderInterceptor, authInterceptor, correlationInterceptor, csrfInterceptor, errorInterceptor])
    ),
    {
      provide: APP_RUNTIME_CONFIG,
      useValue: appRuntimeConfig,
    }
  ]
};
