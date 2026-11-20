import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ControlContainer, FormGroup, FormGroupDirective, ReactiveFormsModule } from '@angular/forms';
import { FieldIconComponent } from '../../../../shared/ui/field-icon/field-icon.component';

/**
 * Password + confirm-password fields shared by the accept-invitation and reset-password pages.
 * The parent form owns the `password` and `confirmPassword` controls, their validators and the
 * submit logic; this component only renders them and reads their touched/invalid state.
 */
@Component({
  selector: 'app-new-password-fields',
  standalone: true,
  imports: [ReactiveFormsModule, FieldIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  templateUrl: './new-password-fields.component.html',
  styleUrl: './new-password-fields.component.css'
})
export class NewPasswordFieldsComponent implements OnInit {
  readonly passwordPlaceholder = input.required<string>();
  readonly confirmPlaceholder = input.required<string>();

  private readonly container = inject(ControlContainer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  ngOnInit(): void {
    // Parent actions such as markAllAsTouched() or setErrors() change control state without any
    // event inside this OnPush view, so re-check whenever the parent group reports a change.
    (this.container.control as FormGroup).events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cdr.markForCheck());
  }

  get password(): AbstractControl | null {
    return this.container.control?.get('password') ?? null;
  }

  get confirmPassword(): AbstractControl | null {
    return this.container.control?.get('confirmPassword') ?? null;
  }

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }
}
