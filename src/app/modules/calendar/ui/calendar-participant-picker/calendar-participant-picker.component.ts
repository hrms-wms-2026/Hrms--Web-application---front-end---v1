import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../../people/models/employee.model';
import { AuthStore } from '../../../../core/auth/state/auth.store';

@Component({
  selector: 'app-calendar-participant-picker',
  standalone: true,
  imports: [ModalComponent, PeoplePickerComponent],
  template: `
    <app-modal [open]="open()" title="Add participants" (closed)="closed.emit()">
      <app-people-picker
        [options]="options()"
        [selectedIds]="selectedIds()"
        [guests]="guestEmails()"
        [allowGuests]="true"
        placeholder="Search people, or type an email to invite a guest"
        (searchChange)="query($event)"
        (toggled)="toggle($event)"
        (guestAdded)="addGuest($event)"
        (guestToggled)="removeGuest($event)"
      />
    </app-modal>
  `
})
export class CalendarParticipantPickerComponent {
  private readonly peopleApi = inject(PeopleApiService);
  private readonly authStore = inject(AuthStore);

  open = input(false);
  selectedIds = input<readonly string[]>([]);
  guestEmails = input<readonly string[]>([]);
  selectedIdsChange = output<readonly string[]>();
  /** Same selection as `selectedIdsChange`, paired with display names so callers can
   * render avatar chips without a second lookup. */
  selectedPeopleChange = output<readonly { id: string; name: string }[]>();
  guestEmailsChange = output<readonly string[]>();
  closed = output<void>();

  results = signal<readonly EmployeeListItemResponse[]>([]);
  protected readonly options = computed<readonly PeoplePickerOption[]>(() =>
    this.results().map((e) => ({
      id: e.id, name: e.fullName, email: e.email, detail: e.departmentName
    }))
  );
  private readonly namesById = new Map<string, string>();

  constructor() {
    effect(() => {
      if (this.open()) {
        this.query('');
      }
    });
  }

  query(search: string): void {
    // Someone on leave, suspended, offboarding, terminated, or resigned can't actually attend a
    // future meeting - don't offer them as a pickable participant.
    this.peopleApi.listEmployees({ search, page: 1, pageSize: 20, activeOnly: true }).subscribe((page) => {
      // The organizer is already on the event by definition - offering them as a pickable
      // "participant" of their own event is meaningless and would let them add themselves twice.
      const currentEmployeeId = this.authStore.employeeId();
      const items = currentEmployeeId ? page.items.filter((e) => e.id !== currentEmployeeId) : page.items;
      for (const e of items) this.namesById.set(e.id, e.fullName);
      this.results.set(items);
    });
  }

  toggle(employeeId: string): void {
    const current = this.selectedIds();
    const next = current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId];
    this.selectedIdsChange.emit(next);
    this.selectedPeopleChange.emit(next.map((id) => ({ id, name: this.namesById.get(id) ?? '' })));
  }

  addGuest(email: string): void {
    if (this.guestEmails().includes(email)) return;
    this.guestEmailsChange.emit([...this.guestEmails(), email]);
  }

  removeGuest(email: string): void {
    this.guestEmailsChange.emit(this.guestEmails().filter((g) => g !== email));
  }
}
