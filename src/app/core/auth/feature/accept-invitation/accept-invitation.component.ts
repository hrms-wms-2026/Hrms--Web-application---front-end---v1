import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FieldIconComponent } from '../../../../shared/ui/field-icon/field-icon.component';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../state/auth.store';
import { AuthApiService } from '../../data-access/auth-api.service';
import { EMPLOYEE_ONBOARDING_PURPOSE, InvitationPreviewDto } from '../../models/dto/invitation-preview.dto';
import { PublishedLegalDocumentDto } from '../../models/dto/published-legal-document.dto';
import { safeServerDetail } from '../../../services/error-handler.service';

const NETWORK_FAILURE_MESSAGE = 'We could not load this invitation. Refresh and try again.';

const STATUS_MESSAGES: Record<string, string> = {
  accepted: 'This invitation has already been accepted. Please sign in instead.',
  revoked: 'This invitation has been revoked. Contact your HR administrator for a new invite.',
  expired: 'This invitation has expired. Ask your HR administrator to send you a new one.'
};

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [ReactiveFormsModule, FieldIconComponent],
  templateUrl: './accept-invitation.component.html',
  styleUrl: './accept-invitation.component.css'
})
export class AcceptInvitationComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(AuthApiService);
  store = inject(AuthStore);

  token = this.route.snapshot.paramMap.get('token') ?? '';

  loadingPreview = signal(true);
  previewError = signal<string | null>(null);
  invitation = signal<InvitationPreviewDto | null>(null);
  legalDocuments = signal<PublishedLegalDocumentDto[]>([]);
  activeDoc = signal<PublishedLegalDocumentDto | null>(null);

  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    legalAccepted: [false]
  });

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  openDocument(doc: PublishedLegalDocumentDto, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeDoc.set(doc);
  }

  closeDocument(): void {
    this.activeDoc.set(null);
  }

  async ngOnInit(): Promise<void> {
    if (!this.token) {
      this.previewError.set('This invitation link is invalid.');
      this.loadingPreview.set(false);
      return;
    }

    let invitation: InvitationPreviewDto;
    try {
      invitation = await firstValueFrom(this.api.getInvitationPreview(this.token));
    } catch (err) {
      this.previewError.set(this.describePreviewFailure(err));
      this.loadingPreview.set(false);
      return;
    }

    this.invitation.set(invitation);
    this.loadingPreview.set(false);

    if (invitation.status !== 'pending') {
      return;
    }

    try {
      const docs = await firstValueFrom(this.api.getCurrentLegalDocuments());
      this.legalDocuments.set(docs);
    } catch {
      this.previewError.set(NETWORK_FAILURE_MESSAGE);
    }
  }

  statusMessage(): string {
    const status = this.invitation()?.status ?? '';
    return STATUS_MESSAGES[status] ?? 'This invitation cannot be processed right now.';
  }

  private describePreviewFailure(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) {
        return 'This invitation link could not be found.';
      }
      if (err.status === 410) {
        return 'This invitation link has expired.';
      }
      const detail = safeServerDetail(err);
      if (detail) {
        return detail;
      }
    }
    return NETWORK_FAILURE_MESSAGE;
  }

  async submit(): Promise<void> {
    if (this.form.controls.password.value !== this.form.controls.confirmPassword.value) {
      this.form.controls.confirmPassword.setErrors({ mismatch: true });
      this.form.markAllAsTouched();
      return;
    }

    if (this.legalDocuments().length > 0 && !this.form.controls.legalAccepted.value) {
      this.form.controls.legalAccepted.setErrors({ required: true });
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = {
      password: this.form.controls.password.value,
      confirm_password: this.form.controls.confirmPassword.value,
      acceptances: this.legalDocuments().map((d) => ({
        document_type: d.document_type,
        version: d.version,
        decision: 'accepted' as const
      }))
    };

    try {
      await this.store.acceptEmployeeInvitation(
        this.token,
        payload,
        this.invitation()?.purpose ?? EMPLOYEE_ONBOARDING_PURPOSE
      );
    } catch {
      return;
    }

    this.router.navigate(['/dashboard']);
  }
}
