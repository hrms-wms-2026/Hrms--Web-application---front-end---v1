import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../state/auth.store';
import { AuthApiService } from '../../data-access/auth-api.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { InvitationPreviewDto } from '../../models/dto/invitation-preview.dto';
import { PublishedLegalDocumentDto } from '../../models/dto/published-legal-document.dto';

const NETWORK_FAILURE_MESSAGE = 'We could not load this invitation. Refresh and try again.';

const STATUS_MESSAGES: Record<string, string> = {
  accepted: 'This invitation has already been accepted. Please sign in instead.',
  revoked: 'This invitation has been revoked. Contact your HR administrator for a new invite.',
  expired: 'This invitation has expired. Ask your HR administrator to send you a new one.'
};

@Component({
  selector: 'app-accept-invitation',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent],
  templateUrl: './accept-invitation.component.html'
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

  form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    legalAccepted: [false]
  });

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

    // The backend already computes a definitive status (pending/accepted/revoked/expired) even
    // on a successful 200 response - only "pending" should ever render the password form.
    if (invitation.status !== 'pending') {
      this.loadingPreview.set(false);
      return;
    }

    try {
      const legalDocuments = await firstValueFrom(this.api.getCurrentLegalDocuments());
      this.legalDocuments.set(legalDocuments);
      if (legalDocuments.length > 0) {
        this.form.controls.legalAccepted.addValidators(Validators.requiredTrue);
        this.form.controls.legalAccepted.updateValueAndValidity();
      }
    } catch (err) {
      this.previewError.set(this.describePreviewFailure(err));
    } finally {
      this.loadingPreview.set(false);
    }
  }

  statusMessage(): string {
    const status = this.invitation()?.status ?? '';
    return STATUS_MESSAGES[status] ?? 'This invitation is not available.';
  }

  private describePreviewFailure(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) {
        return 'This invitation link could not be found. Double-check the link or ask for a new invite.';
      }
      if (err.status === 0 || err.status >= 500) {
        return NETWORK_FAILURE_MESSAGE;
      }
    }
    return NETWORK_FAILURE_MESSAGE;
  }

  async submit(): Promise<void> {
    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.form.controls.confirmPassword.setErrors({ mismatch: true });
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const acceptances = this.legalDocuments().map((doc) => ({
      document_type: doc.document_type,
      version: doc.version,
      decision: 'accepted' as const
    }));

    try {
      await this.store.acceptEmployeeInvitation(this.token, {
        password,
        confirm_password: confirmPassword,
        acceptances
      });
    } catch {
      return;
    }

    // TenantHostDirect finalization signs the session in immediately on this same host - no
    // continue_url hand-off needed, unlike login()/acceptLegalDocuments() on the root host.
    this.router.navigate(['/dashboard']);
  }
}
