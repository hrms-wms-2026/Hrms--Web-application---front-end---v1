export type EnvironmentName = 'development' | 'staging' | 'production';

export interface RuntimeConfig {
  readonly production: boolean;
  readonly environmentName: EnvironmentName;
  readonly apiUrl: string;
  readonly wsUrl: string;
  readonly enableDebugLogs: boolean;
  readonly appName: string;
}
