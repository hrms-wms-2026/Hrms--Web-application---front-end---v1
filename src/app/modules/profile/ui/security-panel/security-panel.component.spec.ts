import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { SecurityPanelComponent } from './security-panel.component';
import { SecurityInfo } from '../../models/profile.model';

describe('SecurityPanelComponent', () => {
  it('shows Enable MFA when mfaEnabled is false', async () => {
    const security: SecurityInfo = { mfaEnabled: false, lastPasswordChangedAt: null };
    await TestBed.configureTestingModule({ imports: [SecurityPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(SecurityPanelComponent);
    fixture.componentRef.setInput('security', security);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Enable MFA');
  });

  it('shows Disable MFA when mfaEnabled is true', async () => {
    const security: SecurityInfo = { mfaEnabled: true, lastPasswordChangedAt: null };
    await TestBed.configureTestingModule({ imports: [SecurityPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(SecurityPanelComponent);
    fixture.componentRef.setInput('security', security);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Disable MFA');
  });

  it('renders the QR code image and manual-entry secret during MFA setup', async () => {
    const security: SecurityInfo = { mfaEnabled: false, lastPasswordChangedAt: null };
    await TestBed.configureTestingModule({ imports: [SecurityPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(SecurityPanelComponent);
    fixture.componentRef.setInput('security', security);
    fixture.componentRef.setInput('saving', false);
    fixture.componentRef.setInput('qrCodeImage', 'data:image/png;base64,abc123');
    fixture.componentRef.setInput('qrCodeSecret', 'JBSWY3DPEHPK3PXP');
    fixture.detectChanges();

    fixture.componentInstance.onStartMfaSetup();
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(img.src).toContain('data:image/png;base64,abc123');
    expect(fixture.nativeElement.textContent).toContain('JBSWY3DPEHPK3PXP');
  });

  it('emits changePassword with current and new password on submit', async () => {
    const security: SecurityInfo = { mfaEnabled: false, lastPasswordChangedAt: null };
    await TestBed.configureTestingModule({ imports: [SecurityPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(SecurityPanelComponent);
    fixture.componentRef.setInput('security', security);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    fixture.componentInstance.passwordForm.setValue({ currentPassword: 'old-pw', newPassword: 'new-password-123' });

    let emitted: unknown;
    fixture.componentInstance.changePassword.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmitPasswordChange();

    expect(emitted).toEqual({ currentPassword: 'old-pw', newPassword: 'new-password-123' });
  });
});
