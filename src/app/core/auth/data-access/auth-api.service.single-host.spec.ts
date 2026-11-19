import { environment } from '@environments/environment';
import { getTenantApiUrl } from './auth-api.service';

describe('getTenantApiUrl on a single host', () => {
  const mutableEnv = environment as unknown as { tenancyMode: string };
  let originalMode: string;

  beforeEach(() => {
    originalMode = mutableEnv.tenancyMode;
    mutableEnv.tenancyMode = 'single-host';
  });

  afterEach(() => {
    mutableEnv.tenancyMode = originalMode;
  });

  it('returns apiUrl unchanged for a valid slug', () => {
    expect(getTenantApiUrl('https://app.azurewebsites.net/api/v1', 'acme')).toBe('https://app.azurewebsites.net/api/v1');
  });

  it('still rejects an invalid slug', () => {
    expect(() => getTenantApiUrl('https://app.azurewebsites.net/api/v1', 'Bad.Slug')).toThrow();
  });
});
