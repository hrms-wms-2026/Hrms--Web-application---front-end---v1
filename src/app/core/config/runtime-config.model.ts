export type EnvironmentName = 'development' | 'staging' | 'production';

export interface RuntimeConfig {
  readonly production: boolean;
  readonly environmentName: EnvironmentName;
  readonly apiUrl: string;
  readonly wsUrl: string;
  readonly enableDebugLogs: boolean;
  readonly appName: string;
  /** 'single-host' resolves the tenant from X-Crownus-Tenant / ?tenant= instead of a subdomain (test builds). */
  readonly tenancyMode: 'subdomain' | 'single-host';
}
