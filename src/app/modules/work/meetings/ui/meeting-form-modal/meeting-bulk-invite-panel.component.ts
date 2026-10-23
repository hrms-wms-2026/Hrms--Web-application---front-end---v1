import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CalendarParticipantPickerComponent } from '../../../../calendar/ui/calendar-participant-picker/calendar-participant-picker.component';
import { DepartmentApiService } from '../../../../organization/data-access/department-api.service';
import { LegalEntityApiService } from '../../../../organization/data-access/legal-entity-api.service';
import { MeetingApiService } from '../../data-access/meeting-api.service';
import { MeetingBulkPreviewResponse, MeetingPlatform } from '../../models/meeting.models';
import { meetingErrorMessage } from '../../utils/meeting-error-messages';

const PAGE_SIZE = 100;

/**
 * Bulk invite (spec D8): whole departments or a manager's direct reports, expanded by the server into a snapshot of
 * people. The organizer removes anyone they don't want, and "Add" hands the kept ids to the form - the request carries
 * explicit employee ids, never groups. Capacity is a warning only; the panel hides itself when the flag is off.
 */
@Component({
  selector: 'app-meeting-bulk-invite-panel',
  standalone: true,
  imports: [CalendarParticipantPickerComponent],
  template: `
    @if (!unavailable()) {
      <div data-testid="meeting-bulk-panel" class="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-3 text-sm">
        <div class="font-medium">Invite a group</div>
        <div class="text-xs text-[var(--color-text-secondary)]">Departments</div>
        <div class="flex max-h-32 flex-col gap-1 overflow-y-auto">
          @for (department of departments(); track department.id) {
            <label class="flex items-center gap-2 text-xs">
              <input type="checkbox" [checked]="departmentIds().includes(department.id)" (change)="toggleDepartment(department.id)" />
              {{ department.name }}
            </label>
          }
        </div>
        <div class="text-xs text-[var(--color-text-secondary)]">A manager's direct reports</div>
        <app-calendar-participant-picker [selectedIds]="managerIds()" [guestEmails]="[]" (selectedIdsChange)="managerIds.set($event)" />
        <button type="button" data-testid="bulk-preview" class="self-start rounded-md border px-3 py-1 text-xs"
          [disabled]="loading() || (departmentIds().length === 0 && managerIds().length === 0)" (click)="preview()">Preview</button>
        @if (error()) {
          <p class="text-xs text-[var(--color-danger)]">{{ error() }}</p>
        }
        @if (result(); as r) {
          <p data-testid="bulk-counts" class="text-xs text-[var(--color-text-secondary)]">
            Selected {{ r.selected }} · {{ r.duplicatesRemoved }} duplicates removed · {{ r.inactiveExcluded }} inactive excluded · {{ r.alreadyInvited }} already invited
          </p>
          @if (r.capacityWarning) {
            <p data-testid="bulk-capacity-warning" class="text-xs text-[var(--color-warning)]">{{ r.capacityWarning }}</p>
          }
          <div class="flex max-h-48 flex-col gap-1 overflow-y-auto">
            @for (person of kept(); track person.employeeId) {
              <div data-testid="bulk-person" class="flex items-center justify-between gap-2 text-xs">
                <span class="truncate">{{ person.name }}@if (person.departmentName) { · {{ person.departmentName }} }</span>
                <button type="button" class="shrink-0 text-[var(--color-text-secondary)]" [attr.aria-label]="'Remove ' + person.name"
                  (click)="remove(person.employeeId)">Remove</button>
              </div>
            }
          </div>
          <button type="button" data-testid="bulk-add" class="self-start rounded-md bg-[var(--color-primary)] px-3 py-1 text-xs text-white"
            [disabled]="kept().length === 0" (click)="add()">Add {{ kept().length }} people</button>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeetingBulkInvitePanelComponent implements OnInit {
  private readonly meetings = inject(MeetingApiService);
  private readonly legalEntities = inject(LegalEntityApiService);
  private readonly departmentApi = inject(DepartmentApiService);

  readonly projectId = input<string | null>(null);
  readonly objectiveId = input<string | null>(null);
  readonly seriesId = input<string | null>(null);
  readonly platform = input<MeetingPlatform | null>(null);
  readonly added = output<readonly string[]>();

  readonly departments = signal<readonly { id: string; name: string }[]>([]);
  readonly departmentIds = signal<readonly string[]>([]);
  readonly managerIds = signal<readonly string[]>([]);
  readonly result = signal<MeetingBulkPreviewResponse | null>(null);
  readonly removed = signal<ReadonlySet<string>>(new Set());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly unavailable = signal(false);
  readonly kept = computed(() => (this.result()?.people ?? []).filter((p) => !this.removed().has(p.employeeId)));

  ngOnInit(): void {
    void this.loadDepartments();
  }

  toggleDepartment(id: string): void {
    this.departmentIds.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  remove(employeeId: string): void {
    this.removed.update((set) => new Set([...set, employeeId]));
  }

  async preview(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.meetings.bulkPreview({
        projectId: this.projectId(), objectiveId: this.objectiveId(), departmentIds: [...this.departmentIds()],
        managerEmployeeIds: [...this.managerIds()], employeeIds: [], seriesId: this.seriesId(), platform: this.platform(),
      }));
      this.removed.set(new Set());
      this.result.set(response);
    } catch (e) {
      const code = e instanceof HttpErrorResponse ? (e.error?.code as string | undefined) : undefined;
      if (code === 'bulk_invite_unavailable') this.unavailable.set(true);
      else this.error.set(meetingErrorMessage(code));
    } finally {
      this.loading.set(false);
    }
  }

  add(): void {
    this.added.emit(this.kept().map((p) => p.employeeId));
    this.result.set(null);
    this.departmentIds.set([]);
    this.managerIds.set([]);
  }

  private async loadDepartments(): Promise<void> {
    try {
      const entities = await firstValueFrom(this.legalEntities.getLegalEntities(false));
      const several = entities.length > 1;
      const all: { id: string; name: string }[] = [];
      for (const entity of entities) {
        for (let page = 1; ; page++) {
          const result = await firstValueFrom(this.departmentApi.listFlat(entity.id, { page, pageSize: PAGE_SIZE }));
          all.push(...result.items.map((d) => ({ id: d.id, name: several ? `${d.name} · ${entity.name}` : d.name })));
          if (page * PAGE_SIZE >= result.totalCount) break;
        }
      }
      this.departments.set(all);
    } catch {
      this.departments.set([]);
    }
  }
}
