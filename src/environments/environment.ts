import { RuntimeConfig } from '../app/core/config/runtime-config.model';

export const environment = {
  production: false,
  environmentName: 'development',
  apiUrl: 'http://localhost:5000/api/v1',
  wsUrl: 'ws://localhost:5000/ws',
  enableDebugLogs: true,
  appName: 'ONEVO HRMS',
} as const satisfies RuntimeConfig;
