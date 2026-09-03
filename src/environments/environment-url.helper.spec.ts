import { buildApiUrl, buildLocalApiUrl, buildLocalWsUrl, buildWsUrl, resolveWsProtocol } from './environment-url.helper';

describe('buildApiUrl (generic same-origin builder, used by production/staging)', () => {
  it('omits the port when none is given, for same-origin production/staging use', () => {
    expect(buildApiUrl('https:', 'acme.onevo.com')).toBe('https://acme.onevo.com/api/v1');
  });

  it('preserves the current hostname unchanged, whatever it is', () => {
    expect(buildApiUrl('https:', 'onevo.com')).toBe('https://onevo.com/api/v1');
  });
});

describe('buildWsUrl (generic same-origin builder, used by production/staging)', () => {
  it('uses wss for an https page and omits the port, for same-origin production/staging use', () => {
    expect(buildWsUrl('https:', 'acme.onevo.com')).toBe('wss://acme.onevo.com/ws');
  });
});

describe('resolveWsProtocol', () => {
  it('maps https to wss', () => {
    expect(resolveWsProtocol('https:')).toBe('wss:');
  });

  it('maps http to ws', () => {
    expect(resolveWsProtocol('http:')).toBe('ws:');
  });
});

describe('buildLocalApiUrl (local dev - HTTPS-only, fixed backend port 7229)', () => {
  it('builds an https apiUrl on the fixed local backend port for bare localhost', () => {
    expect(buildLocalApiUrl('localhost')).toBe('https://localhost:7229/api/v1');
  });

  it('preserves a tenant subdomain hostname', () => {
    expect(buildLocalApiUrl('acme.localhost')).toBe('https://acme.localhost:7229/api/v1');
  });

  it('always produces an https url, never http', () => {
    expect(buildLocalApiUrl('localhost')).toMatch(/^https:\/\//);
  });

  it('never uses the retired local HTTP port 5139', () => {
    expect(buildLocalApiUrl('localhost')).not.toContain('5139');
  });
});

describe('buildLocalWsUrl (local dev - HTTPS-only, fixed backend port 7229)', () => {
  it('builds a wss url on the fixed local backend port for bare localhost', () => {
    expect(buildLocalWsUrl('localhost')).toBe('wss://localhost:7229/ws');
  });

  it('preserves a tenant subdomain hostname', () => {
    expect(buildLocalWsUrl('acme.localhost')).toBe('wss://acme.localhost:7229/ws');
  });

  it('always produces a wss url, never plain ws', () => {
    expect(buildLocalWsUrl('localhost')).toMatch(/^wss:\/\//);
  });

  it('never uses the retired local HTTP port 5139', () => {
    expect(buildLocalWsUrl('localhost')).not.toContain('5139');
  });
});
