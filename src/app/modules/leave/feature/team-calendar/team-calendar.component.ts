/** Quiet Operations Desk: Screen 7's month view - who's off, colour by type, click for detail. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { LeaveCalendarStore } from '../../state/leave-calendar.store';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveUploadedDocument, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveCalendarGridComponent } from '../../ui/leave-calendar-grid/leave-calendar-grid.component';
import { LeaveCalendarDayDetailComponent } from '../../ui/leave-calendar-day-detail/leave-calendar-day-detail.component';
import { NewLeaveRequestWizardComponent } from '../../ui/new-leave-request-wizard/new-leave-request-wizard.component';

@Component({
  selector: 'app-team-calendar',
  standalone: true,
  imports: [CommonModule, ErrorStateComponent, LeaveCalendarGridComponent, LeaveCalendarDayDetailComponent, NewLeaveRequestWizardComponent],
  templateUrl: './team-calendar.component.html',
  styleUrl: './team-calendar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamCalendarComponent {
  readonly store = inject(LeaveCalendarStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly balanceStore = inject(LeaveBalanceStore);
  readonly requestStore = inject(LeaveRequestStore);
  private readonly permissionService = inject(PermissionService);
  readonly canRequestLeave = computed(() => this.permissionService.hasPermission('leave:read-own'));
  readonly detailOpen = signal(false);
  readonly wizardOpen = signal(false);
  readonly uploadedDocuments = signal<LeaveUploadedDocument[]>([]);
  readonly requestDate = signal<string | null>(null);
  readonly selectedDate = signal<string | null>(null);
  readonly selectedDay = computed(() =>
    this.store.month()?.days.find((d) => d.date === this.selectedDate()) ?? null
  );
  readonly departmentOptions = computed(() => {
    const map = new Map<string, string>();
    for (const day of this.store.month()?.days ?? []) {
      for (const absence of day.absences) {
        if (absence.departmentId && absence.departmentName) map.set(absence.departmentId, absence.departmentName);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  });

  readonly monthLabel = computed(() => {
    const m = this.store.month();
    if (!m) return '';
    return new Date(m.year, m.month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });
  readonly monthStats = computed(() => {
    const month = this.store.month();
    if (!month) return { people: 0, days: 0 };
    const people = new Set<string>();
    let days = 0;
    for (const day of month.days) {
      if (day.absences.length > 0) days += 1;
      for (const absence of day.absences) people.add(absence.employeeId);
    }
    return { people: people.size, days };
  });

  constructor() {
    void this.store.load();
  }

  onDayClicked(date: string): void {
    this.selectedDate.set(date);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
  }

  onDepartmentChange(departmentId: string): void {
    void this.store.setDepartmentFilter(departmentId || null);
  }

  onRequestLeave(date: string): void {
    this.closeDetail();
    this.requestDate.set(date);
    this.wizardOpen.set(true);
    void this.leaveTypeStore.load();
    void this.balanceStore.loadMy(this.store.year());
    void this.balanceStore.loadWorkWindow();
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
    this.requestDate.set(null);
    this.uploadedDocuments.set([]);
    this.requestStore.clearPreview();
  }

  async onDocumentSelected(file: File): Promise<void> {
    const uploaded = await this.requestStore.uploadDocument(file);
    if (uploaded) this.uploadedDocuments.update((docs) => [...docs, uploaded]);
  }

  onDocumentRemoved(id: string): void {
    this.uploadedDocuments.update((docs) => docs.filter((doc) => doc.id !== id));
  }

  onPreviewRequested(payload: SubmitLeaveRequestRequest): void {
    void this.requestStore.preview(payload);
  }

  async onSubmitRequested(payload: SubmitLeaveRequestRequest): Promise<void> {
    const result = await this.requestStore.submit(payload);
    if (result) {
      this.closeWizard();
      void this.store.load();
    }
  }
}
