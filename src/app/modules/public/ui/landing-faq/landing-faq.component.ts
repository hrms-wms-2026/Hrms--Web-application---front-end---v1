import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
}

@Component({
  selector: 'app-landing-faq',
  standalone: true,
  templateUrl: './landing-faq.component.html',
  styleUrl: './landing-faq.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingFaqComponent {
  readonly openId = signal<number | null>(1);

  readonly faqs: FaqItem[] = [
    {
      id: 1,
      question: 'How does ONEXSO handle employee privacy during activity monitoring?',
      answer:
        'ONEXSO WorkPulse tracks active window titles, application usage, and idle time—never keystrokes or file contents. Raw activity logs are automatically purged after 48 hours. Employers can configure transparency modes (Full, Partial, Covert) per employee and policy.'
    },
    {
      id: 2,
      question: 'Can ONEXSO support multi-company groups under a single tenant?',
      answer:
        'Yes. ONEXSO natively supports multi-company legal entities under a single tenant. Users can switch their operating company context from the topbar while maintaining proper role-based visibility across departments and positions.'
    },
    {
      id: 3,
      question: 'How is the WorkPulse agent deployed to workstations?',
      answer:
        'The WorkPulse Windows agent is distributed as a silent MSIX background service. System administrators push it silently across company devices via Intune or Group Policy (GPO) with zero required employee interaction during installation.'
    },
    {
      id: 4,
      question: 'Does ONEXSO integrate with GitHub for sprint tracking?',
      answer:
        'Yes. WorkSync features direct GitHub integration via signed webhooks. Commits, pull requests, and GitHub Actions CI build statuses automatically link to ONEXSO tasks and Objectives based on branch and message references.'
    },
    {
      id: 5,
      question: 'How do new customers sign up for ONEXSO?',
      answer:
        'Phase 1 ONEXSO is sales-led and operator-provisioned. After a demo and agreement, an ONEXSO operator provisions your dedicated tenant domain (e.g. company.onevo.com) and initial administrative credentials.'
    }
  ];

  toggleFaq(id: number): void {
    this.openId.update((current) => (current === id ? null : id));
  }
}
