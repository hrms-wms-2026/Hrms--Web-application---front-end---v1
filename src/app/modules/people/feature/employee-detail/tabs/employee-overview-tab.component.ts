import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EmployeeDetailResponse } from '../../../models/employee.model';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { calculateTenure, primaryLocation } from '../../../utils/employee-detail.utils';
import {
  attendanceAttentionLabel,
  attendanceSeverityClass,
  attendanceStatusLabel,
  attendanceWarningLabel,
  breakOverageLabel
} from '../../../utils/employee-view.utils';

const HISTORY_PREVIEW_LIMIT = 5;

/**
 * Overview tab. Phase 1 shows the cards that existing endpoints already back (attendance today,
 * employment & organization, employee history). The period-based cards from the design
 * (attendance month, work management, time off, productivity) arrive with their backend
 * aggregates in a later phase.
 */
@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    @if (store.employee(); as employee) {
      <div class="grid gap-4 lg:grid-cols-3">
        @if (employee.attendanceSummary) {
          <section class="detail-card" aria-labelledby="overview-attendance-today">
            <h2 id="overview-attendance-today" class="detail-card__title">Attendance today</h2>
            @if (employee.attendanceSummary.showNotClockedInWarning && attendanceWarningLabel(employee); as warningLabel) {
              <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
                <span class="w-2 h-2 rounded-full bg-red-500"></span>
                {{ warningLabel }}
              </span>
            } @else {
              <span class="text-sm font-semibold text-[var(--color-text-primary)] block">
                {{ attendanceStatusLabel(employee) || 'Not specified' }}
              </span>
              @if (attendanceAttentionLabel(employee); as attentionLabel) {
                <span class="mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full" [class]="severityBadgeClass(employee)">
                  {{ attentionLabel }}
                </span>
              }
            }
            @if (breakOverageLabel(employee); as breakLabel) {
              <span class="mt-1 block text-xs font-medium text-red-600">{{ breakLabel }}</span>
            }
          </section>
        }

        <section class="detail-card" [class.lg:col-span-2]="!employee.attendanceSummary" aria-labelledby="overview-employment">
          <div class="detail-card__head">
            <h2 id="overview-employment" class="detail-card__title">Employment &amp; Organization</h2>
            <a routerLink="../employment" class="detail-card__link">View details</a>
          </div>
          <dl class="detail-list">
            <dt>Position</dt><dd>{{ employee.jobInformation.positionName || 'Unassigned' }}</dd>
            <dt>Department</dt><dd>{{ employee.jobInformation.departmentName || '—' }}</dd>
            <dt>Company</dt><dd>{{ employee.jobInformation.legalEntityName || '—' }}</dd>
            <dt>Reporting Manager</dt><dd>{{ employee.jobInformation.reportingManagerName || 'Unassigned' }}</dd>
            <dt>Employment Type</dt><dd>{{ employee.jobInformation.employmentTypeLabel || '—' }}</dd>
            <dt>Work Mode</dt><dd>{{ employee.jobInformation.workModeLabel || '—' }}</dd>
            <dt>Primary Location</dt><dd>{{ location() }}</dd>
            <dt>Hire Date</dt><dd>{{ employee.jobInformation.hireDate ? (employee.jobInformation.hireDate | date: 'dd MMM yyyy') : '—' }}</dd>
            <dt>Tenure</dt><dd data-testid="overview-tenure">{{ tenure() }}</dd>
          </dl>
        </section>

        <section class="detail-card" aria-labelledby="overview-history">
          <div class="detail-card__head">
            <h2 id="overview-history" class="detail-card__title">Employee History</h2>
            <a routerLink="../employment" class="detail-card__link">View all</a>
          </div>
          @if (historyPreview().length === 0) {
            <p class="text-sm text-[var(--color-text-secondary)]">No position history recorded yet.</p>
          } @else {
            <ol class="space-y-3">
              @for (entry of historyPreview(); track $index) {
                <li data-testid="overview-history-entry" class="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
                  <span class="text-[var(--color-text-secondary)]">{{ entry.effectiveFrom | date: 'MMM d, yyyy' }}</span>
                  <span>
                    <span class="block font-medium text-[var(--color-text-primary)]">{{ entry.changeReason || 'Position assigned' }}</span>
                    <span class="block text-xs text-[var(--color-text-secondary)]">{{ entry.positionName }}</span>
                  </span>
                </li>
              }
            </ol>
          }
        </section>
      </div>
    }
  `,
  styleUrl: './employee-detail-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeOverviewTabComponent {
  protected readonly store = inject(EmployeeDetailStore);

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;

  readonly tenure = computed(() => calculateTenure(this.store.employee()?.jobInformation.hireDate));
  readonly location = computed(() => primaryLocation(this.store.employee()?.personalInformation.addresses));
  readonly historyPreview = computed(() =>
    [...this.store.jobJourney()]
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
      .slice(0, HISTORY_PREVIEW_LIMIT)
  );

  severityBadgeClass(employee: EmployeeDetailResponse): string {
    const severity = attendanceSeverityClass(employee);
    if (severity === 'emp-attention--critical') return 'bg-red-50 text-red-700';
    if (severity === 'emp-attention--warning') return 'bg-amber-50 text-amber-700';
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }
}
