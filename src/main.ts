import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { captureSingleHostTenantFromUrl } from './app/core/auth/utils/single-host-tenant';

captureSingleHostTenantFromUrl();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
