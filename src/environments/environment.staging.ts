import { RuntimeConfig } from '../app/core/config/runtime-config.model';

export const environment = {
  production: false,
  environmentName: 'staging',
  apiUrl: 'https://staging-api.onevo.example/api/v1',
  wsUrl: 'wss://staging-api.onevo.example/ws',
  enableDebugLogs: false,
  appName: 'ONEVO HRMS',
} as const satisfies RuntimeConfig;
