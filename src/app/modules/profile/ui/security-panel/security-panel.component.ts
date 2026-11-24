import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SecurityInfo } from '../../models/profile.model';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AppValidators, fieldError } from '../../../../shared/utils/validators';
import { AUTH_LIMITS } from '../../../../core/auth/utils/auth-limits';

type MfaSetupStep = 'idle' | 'show-qr' | 'confirm-code';

@Component({
  selector: 'app-security-panel',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ButtonComponent],
  templateUrl: './security-panel.component.html',
  styleUrls: ['../profile-panel.shared.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecurityPanelComponent {
  readonly security = input.required<SecurityInfo>();
  readonly saving = input(false);
  readonly qrCodeImage = input<string | null>(null);
  readonly qrCodeSecret = input<string | null>(null);

  readonly changePassword = output<{ currentPassword: string; newPassword: string }>();
  readonly startMfaSetup = output<void>();
  readonly confirmMfaSetup = output<string>();
  readonly disableMfa = output<string>();

  readonly mfaSetupStep = signal<MfaSetupStep>('idle');

  private readonly fb = new FormBuilder().nonNullable;
  protected readonly fieldError = fieldError;

  readonly passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(AUTH_LIMITS.passwordMin)]]
  });

  readonly mfaCodeForm = this.fb.group({ code: ['', [Validators.required, AppValidators.pattern(/^\d{6}$/, 'mfaCode')]] });
  readonly disableMfaForm = this.fb.group({ currentPassword: ['', Validators.required] });

  onSubmitPasswordChange(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const value = this.passwordForm.getRawValue();
    this.changePassword.emit({ currentPassword: value.currentPassword, newPassword: value.newPassword });
    this.passwordForm.reset();
  }

  onStartMfaSetup(): void {
    this.mfaSetupStep.set('show-qr');
    this.startMfaSetup.emit();
  }

  onProceedToConfirmCode(): void {
    this.mfaSetupStep.set('confirm-code');
  }

  onSubmitMfaCode(): void {
    if (this.mfaCodeForm.invalid) {
      this.mfaCodeForm.markAllAsTouched();
      return;
    }
    this.confirmMfaSetup.emit(this.mfaCodeForm.getRawValue().code.trim());
    this.mfaSetupStep.set('idle');
    this.mfaCodeForm.reset();
  }

  onSubmitDisableMfa(): void {
    if (this.disableMfaForm.invalid) {
      this.disableMfaForm.markAllAsTouched();
      return;
    }
    this.disableMfa.emit(this.disableMfaForm.getRawValue().currentPassword);
    this.disableMfaForm.reset();
  }
}
