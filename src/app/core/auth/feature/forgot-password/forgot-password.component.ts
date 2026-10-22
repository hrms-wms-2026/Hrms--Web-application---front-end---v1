import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldIconComponent } from '../../../../shared/ui/field-icon/field-icon.component';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../../data-access/auth-api.service';


const NETWORK_FAILURE_MESSAGE = 'We could not reach the server. Please try again.';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, FieldIconComponent, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private api = inject(AuthApiService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.api.forgotPassword(this.form.getRawValue().email));
      this.submitted.set(true);
    } catch (err) {
      this.error.set(this.describeFailure(err));
    } finally {
      this.loading.set(false);
    }
  }

  private describeFailure(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.error && typeof err.error.detail === 'string') {
      return err.error.detail;
    }
    return NETWORK_FAILURE_MESSAGE;
  }
}
