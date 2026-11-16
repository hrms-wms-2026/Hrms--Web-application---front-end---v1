import { TestBed } from '@angular/core/testing';
import { GOOGLE_GSI_SCRIPT_URL, GoogleIdentityService } from './google-identity.service';

describe('GoogleIdentityService', () => {
  let service: GoogleIdentityService;
  const initialize = vi.fn();
  const renderButton = vi.fn();

  const gisScripts = (): NodeListOf<HTMLScriptElement> =>
    document.querySelectorAll<HTMLScriptElement>('script[src*="accounts.google.com"]');

  function finishScriptLoad(): void {
    window.google = { accounts: { id: { initialize, renderButton } } };
    gisScripts()[0].dispatchEvent(new Event('load'));
  }

  function credentialCallback(): (response: { credential?: string }) => void {
    return (initialize.mock.calls[0][0] as { callback: (r: { credential?: string }) => void })
      .callback;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GoogleIdentityService);
  });

  afterEach(() => {
    gisScripts().forEach((script) => script.remove());
    delete window.google;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('loads GIS only from the official Google URL', () => {
    void service.load();

    expect(GOOGLE_GSI_SCRIPT_URL).toBe('https://accounts.google.com/gsi/client');
    expect(gisScripts().length).toBe(1);
    expect(gisScripts()[0].src).toBe('https://accounts.google.com/gsi/client');
  });

  it('adds the GIS script only once and shares one pending load', async () => {
    const first = service.load();
    const second = service.load();
    finishScriptLoad();

    const [a, b] = await Promise.all([first, second]);

    expect(gisScripts().length).toBe(1);
    expect(a).toBe(b);
  });

  it('rejects safely when the script is blocked, and allows a later retry', async () => {
    const attempt = service.load();
    gisScripts()[0].dispatchEvent(new Event('error'));

    await expect(attempt).rejects.toThrow('Could not load Google Identity Services.');
    expect(gisScripts().length).toBe(0);

    const retry = service.load();
    expect(gisScripts().length).toBe(1);
    finishScriptLoad();
    await expect(retry).resolves.toBeTruthy();
  });

  it('rejects when the script loads but GIS is missing', async () => {
    const attempt = service.load();
    gisScripts()[0].dispatchEvent(new Event('load'));

    await expect(attempt).rejects.toThrow('Google Identity Services did not initialise.');
  });

  it('initialises GIS in popup mode without auto sign-in and draws the official button', async () => {
    const host = document.createElement('div');

    const rendering = service.renderSignInButton(host, 'client-123', vi.fn());
    finishScriptLoad();
    await rendering;

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-123', ux_mode: 'popup', auto_select: false }),
    );
    expect(renderButton).toHaveBeenCalledWith(
      host,
      expect.objectContaining({ text: 'continue_with' }),
    );
  });

  it('delivers the credential only to the callback, without storage or console writes', async () => {
    const onCredential = vi.fn();
    const localSet = vi.spyOn(Storage.prototype, 'setItem');
    const log = vi.spyOn(console, 'log');
    const info = vi.spyOn(console, 'info');
    const cookieBefore = document.cookie;

    const rendering = service.renderSignInButton(
      document.createElement('div'),
      'client-123',
      onCredential,
    );
    finishScriptLoad();
    await rendering;
    credentialCallback()({ credential: 'id-token-abc' });

    expect(onCredential).toHaveBeenCalledExactlyOnceWith('id-token-abc');
    expect(localSet).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);
  });

  it('ignores a GIS callback without a credential', async () => {
    const onCredential = vi.fn();
    const rendering = service.renderSignInButton(
      document.createElement('div'),
      'client-123',
      onCredential,
    );
    finishScriptLoad();
    await rendering;

    credentialCallback()({ credential: '' });
    credentialCallback()({});

    expect(onCredential).not.toHaveBeenCalled();
  });
});
