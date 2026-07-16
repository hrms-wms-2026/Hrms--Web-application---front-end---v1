import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
import { RuntimeConfig } from './runtime-config.model';

export const APP_RUNTIME_CONFIG = new InjectionToken<RuntimeConfig>(
  'APP_RUNTIME_CONFIG'
);

export const appRuntimeConfig: Readonly<RuntimeConfig> = Object.freeze({
  ...environment,
});
