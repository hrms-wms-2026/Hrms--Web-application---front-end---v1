import { RuntimeConfig } from '../app/core/config/runtime-config.model';

export const environment = {
  production: true,
  environmentName: 'production',
  apiUrl: 'https://api.onevo.example/api/v1',
  wsUrl: 'wss://api.onevo.example/ws',
  enableDebugLogs: false,
  appName: 'ONEVO HRMS',
} as const satisfies RuntimeConfig;
