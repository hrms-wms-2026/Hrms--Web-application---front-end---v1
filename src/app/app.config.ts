import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { APP_RUNTIME_CONFIG, appRuntimeConfig } from './core/config/app.config';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { correlationInterceptor } from './core/interceptors/correlation.interceptor';
import { csrfInterceptor } from './core/interceptors/csrf.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { provideTaskImageUploader } from './modules/work/data-access/task-image-uploader.provider';

export const appConfig: ApplicationConfig = {
  providers: [
    provideTaskImageUploader(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' })
    ),
    provideHttpClient(
      withInterceptors([authInterceptor, correlationInterceptor, csrfInterceptor, errorInterceptor])
    ),
    {
      provide: APP_RUNTIME_CONFIG,
      useValue: appRuntimeConfig,
    }
  ]
};
