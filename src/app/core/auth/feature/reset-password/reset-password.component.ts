import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldIconComponent } from '../../../../shared/ui/field-icon/field-icon.component';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../../data-access/auth-api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';

const NETWORK_FAILURE_MESSAGE = 'We could not reach the server. Please try again.';
const INVALID_TOKEN_MESSAGE = 'This password reset link is invalid or has expired. Request a new one.';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, FieldIconComponent, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(AuthApiService);

  token = '';

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.error.set(INVALID_TOKEN_MESSAGE);
    }
  }

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  async submit(): Promise<void> {
    if (!this.token) {
      return;
    }

    if (this.form.controls.password.value !== this.form.controls.confirmPassword.value) {
      this.form.controls.confirmPassword.setErrors({ mismatch: true });
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.api.resetPassword(this.token, this.form.getRawValue().password));
      this.submitted.set(true);
    } catch (err) {
      this.error.set(this.describeFailure(err));
    } finally {
      this.loading.set(false);
    }
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  private describeFailure(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.error && typeof err.error.detail === 'string') {
        return err.error.detail;
      }
      if (err.status === 400 || err.status === 404 || err.status === 410) {
        return INVALID_TOKEN_MESSAGE;
      }
    }
    return NETWORK_FAILURE_MESSAGE;
  }
}
