import { Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../../people/models/employee.model';
import { AuthStore } from '../../../../core/auth/state/auth.store';
/** Search-and-pick list for event participants. Created only while its panel is open, so it queries the
 * directory each time it opens. With `search` set, the parent owns the search box (the event form's
 * participants field) and this renders only the results; without it, the list has its own search bar. */
@Component({
  selector: 'app-calendar-participant-picker',
  standalone: true,
  imports: [PeoplePickerComponent],
  template: `
    <div class="w-full" data-testid="calendar-participant-picker">
      <app-people-picker
        [options]="options()"
        [selectedIds]="selectedIds()"
        [guests]="search() === null ? guestEmails() : []"
        [allowGuests]="true"
        [searchText]="search()"
        placeholder="Search people, or type an email to invite a guest"
        (searchChange)="query($event)"
        (toggled)="toggle($event)"
        (guestAdded)="addGuest($event)"
        (guestToggled)="removeGuest($event)"
      />
    </div>
  `
})
export class CalendarParticipantPickerComponent {
  private readonly peopleApi = inject(PeopleApiService);
  private readonly authStore = inject(AuthStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  open = input(false);
  selectedIds = input<readonly string[]>([]);
  guestEmails = input<readonly string[]>([]);
  /** Search text from a parent-owned search box; null shows the picker's own search bar. */
  search = input<string | null>(null);
  selectedIdsChange = output<readonly string[]>();
  /** Same selection as `selectedIdsChange`, paired with display names so callers can
   * render avatars without a second lookup. */
  selectedPeopleChange = output<readonly { id: string; name: string }[]>();
  guestEmailsChange = output<readonly string[]>();

  results = signal<readonly EmployeeListItemResponse[]>([]);
  /** The viewer, listed first so they can add themselves - never added automatically. Null while their
   * row isn't part of the current results (e.g. a search that doesn't match them). */
  private readonly self = signal<{ id: string; name: string; email: string | null; detail: string | null } | null>(null);
  protected readonly options = computed<readonly PeoplePickerOption[]>(() => {
    const self = this.self();
    const others = this.results().map((e) => ({ id: e.id, name: e.fullName, email: e.email, detail: e.departmentName }));
    return self ? [{ id: self.id, name: `${self.name} (You)`, email: self.email, detail: self.detail }, ...others] : others;
  });
  private readonly namesById = new Map<string, string>();
  private selfRow: EmployeeListItemResponse | null = null;

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const external = this.search();
      this.query(external ?? '');
      if (external === null) {
        setTimeout(() => this.host.nativeElement.querySelector<HTMLInputElement>('[data-testid="people-picker-search"]')?.focus());
      }
    });
  }

  query(search: string): void {
    // Someone on leave, suspended, offboarding, terminated, or resigned can't actually attend a
    // future meeting - don't offer them as a pickable participant.
    this.peopleApi.listEmployees({ search, page: 1, pageSize: 20, activeOnly: true }).subscribe((page) => {
      for (const e of page.items) this.namesById.set(e.id, e.fullName);
      const selfRow = page.items.find((e) => this.isSelf(e)) ?? null;
      this.results.set(page.items.filter((e) => !this.isSelf(e)));
      if (selfRow) {
        this.selfRow = selfRow;
        this.setSelf(selfRow);
      } else if (!search.trim()) {
        // Not on this page of the directory - still offer them first when nothing is being searched.
        this.offerSelf();
      } else {
        this.self.set(null);
      }
    });
  }

  /** Matched on employee id, or on the login email when the session carries no employee id. */
  private isSelf(employee: EmployeeListItemResponse): boolean {
    const id = this.authStore.employeeId();
    if (id) return employee.id === id;
    const email = this.authStore.email?.()?.toLowerCase();
    return !!email && employee.email?.toLowerCase() === email;
  }

  private setSelf(row: EmployeeListItemResponse): void {
    this.self.set({ id: row.id, name: row.fullName, email: row.email, detail: row.departmentName });
  }

  private offerSelf(): void {
    if (this.selfRow) {
      this.setSelf(this.selfRow);
      return;
    }
    const email = this.authStore.email?.();
    if (!email) {
      this.self.set(null);
      return;
    }
    this.peopleApi.listEmployees({ search: email, page: 1, pageSize: 5, activeOnly: true }).subscribe({
      next: (page) => {
        const row = page.items.find((e) => this.isSelf(e));
        if (!row) return;
        this.selfRow = row;
        this.namesById.set(row.id, row.fullName);
        this.setSelf(row);
      },
      error: () => this.self.set(null)
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
