import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../auth/state/auth.store';
import { TrayInstallerApiService } from '../../data-access/tray-installer-api.service';
import { TrayInstallerInfo } from '../../models/tray-installer.model';
import { TrayPresenceStore } from '../../state/tray-presence.store';
import { TrayActivationGateComponent } from './tray-activation-gate.component';

const installer: TrayInstallerInfo = {
  version: '1.2.0',
  download_url: 'https://dl.example.com/onevo-1.2.0.msix',
  sha256: 'a'.repeat(64),
  file_size_bytes: 52428800,
  publisher: 'CN=ONEVO',
  minimum_windows_version: '10.0.19041.0',
  release_notes: null,
  channel: 'stable'
};

describe('TrayActivationGateComponent installer step', () => {
  const getLatest = vi.fn();

  const generateCode = vi.fn();

  async function render(
    settle = true,
    phase: 'waiting' | 'needs-code' = 'waiting'
  ): Promise<ComponentFixture<TrayActivationGateComponent>> {
    const presence = {
      phase: signal(phase),
      hasUsableCode: signal(phase === 'waiting'),
      code: signal('BCDF2345'),
      codeSecondsRemaining: signal(600),
      copyState: signal('idle'),
      generationError: signal<string | null>(null),
      copyCode: vi.fn(),
      generateCode,
      retry: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [TrayActivationGateComponent],
      providers: [
        { provide: TrayPresenceStore, useValue: presence },
        { provide: AuthStore, useValue: { logout: vi.fn() } },
        { provide: TrayInstallerApiService, useValue: { getLatest } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TrayActivationGateComponent);
    fixture.detectChanges();
    if (settle) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
    return fixture;
  }

  beforeEach(() => {
    getLatest.mockReset();
    generateCode.mockReset();
  });

  it('asks for a code only when the Generate button is clicked, and still offers the download', async () => {
    getLatest.mockReturnValue(of(installer));
    const fixture = await render(true, 'needs-code');

    expect(generateCode).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('a.download')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('BCDF2345');

    const button = Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'))
      .find(b => b.textContent?.trim() === 'Generate activation code')!;
    button.click();

    expect(generateCode).toHaveBeenCalledOnce();
  });

  it('shows the download link with version and size when an installer is published', async () => {
    getLatest.mockReturnValue(of(installer));
    const fixture = await render();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.download');
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(installer.download_url);
    expect(link.textContent).toContain('Download');
    expect(link.textContent).toContain('1.2.0');
    expect(link.textContent).toContain('50.0 MB');
  });

  it('shows a "not available yet" message and no download link when the installer is missing', async () => {
    getLatest.mockReturnValue(throwError(() => new Error('404')));
    const fixture = await render();

    expect(fixture.nativeElement.querySelector('a.download')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain("The installer isn't available yet");
  });

  it('still renders the activation code and Copy button when the installer is unavailable', async () => {
    getLatest.mockReturnValue(throwError(() => new Error('down')));
    const fixture = await render();

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('BCDF2345');
    expect(text).toContain('Copy code');
  });

  it('shows the loading hint while the installer request is pending', async () => {
    getLatest.mockReturnValue(NEVER);
    const fixture = await render(false);

    expect(fixture.nativeElement.textContent).toContain('Checking for the latest installer');
  });

  it('opens the download link in a new tab safely', async () => {
    getLatest.mockReturnValue(of(installer));
    const fixture = await render();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.download');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
