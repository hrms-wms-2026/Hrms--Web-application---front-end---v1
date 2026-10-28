import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { PeopleApiService } from '../../../modules/people/data-access/people-api.service';
import { buildFileUrl } from '../../data-access/file-api.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { ModalComponent, PopupIcon } from '../modal/modal.component';

/** A person the picker can list. `detail` is the grey second line (job, department, email). */
export interface PersonPickerOption {
  id: string;
  name: string;
  avatarFileId?: string | null;
  detail?: string | null;
}

/** Finds people for a search text ('' = the first page). */
export type PersonSearch = (text: string) => Observable<readonly PersonPickerOption[]>;

const SEARCH_DEBOUNCE_MS = 250;
const DIRECTORY_PAGE_SIZE = 50;

/**
 * The app's one "pick people" popup (WhatsApp-style): a search box, everyone matching it alphabetically with a photo,
 * people who are already in (`disabledPeople`) listed too but ticked and greyed out, and Cancel / Add. With
 * `multiple` off it picks one person on click (no checkboxes, no footer). By default it searches the employee
 * directory; `search` swaps in another source (e.g. the people a chat may add).
 */
@Component({
  selector: 'app-person-picker-dialog',
  standalone: true,
  imports: [AvatarComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './person-picker-dialog.component.html',
  styleUrl: './person-picker-dialog.component.css'
})
export class PersonPickerDialogComponent {
  private readonly people = inject(PeopleApiService);

  open = input(false);
  title = input('Add member');
  subtitle = input('');
  icon = input<PopupIcon>('user-plus');
  /** Several people with checkboxes and an Add button, or one person picked on click. */
  multiple = input(true);
  /** Where people come from; null = the employee directory. */
  search = input<PersonSearch | null>(null);
  /** People already in: always listed (when they match the search), ticked and disabled. */
  disabledPeople = input<readonly PersonPickerOption[]>([]);
  disabledLabel = input('Already added');
  /** People never listed (e.g. the viewer). */
  hiddenIds = input<readonly string[]>([]);
  confirmLabel = input('Add');
  busy = input(false);

  /** The picked ids (one in single mode). */
  confirmed = output<string[]>();
  closed = output<void>();

  protected readonly text = signal('');
  protected readonly found = signal<readonly PersonPickerOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly chosen = signal<readonly string[]>([]);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private request = 0;

  /** Everyone matching the search, alphabetically; people already in are listed too (disabled). */
  protected readonly rows = computed(() => {
    const hidden = new Set(this.hiddenIds());
    const term = this.text().trim().toLowerCase();
    const disabled = new Map(this.disabledPeople().map((p) => [p.id, p]));
    const rows = new Map<string, PersonPickerOption & { disabled: boolean }>();
    for (const p of this.found()) rows.set(p.id, { ...p, disabled: disabled.has(p.id) });
    for (const p of disabled.values()) {
      if (!rows.has(p.id) && (!term || p.name.toLowerCase().includes(term))) rows.set(p.id, { ...p, disabled: true });
    }
    return [...rows.values()].filter((r) => !hidden.has(r.id)).sort((a, b) => a.name.localeCompare(b.name));
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.text.set('');
        this.chosen.set([]);
        this.query('');
      });
    });
    inject(DestroyRef).onDestroy(() => { if (this.timer) clearTimeout(this.timer); });
  }

  protected onType(text: string): void {
    this.text.set(text);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.query(text.trim()), SEARCH_DEBOUNCE_MS);
  }

  protected toggle(id: string): void {
    this.chosen.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  protected pickOne(id: string): void {
    this.confirmed.emit([id]);
  }

  protected confirm(): void {
    if (this.chosen().length > 0) this.confirmed.emit([...this.chosen()]);
  }

  protected isChosen(id: string): boolean {
    return this.chosen().includes(id);
  }

  protected avatarUrl(fileId: string | null | undefined): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  private query(text: string): void {
    const mine = ++this.request;
    this.loading.set(true);
    (this.search() ?? this.directory)(text).pipe(catchError(() => of([] as readonly PersonPickerOption[]))).subscribe((people) => {
      if (mine !== this.request) return;
      this.found.set(people);
      this.loading.set(false);
    });
  }

  /** The employee directory: name, photo, and job · department as the second line. */
  private readonly directory: PersonSearch = (text) =>
    this.people.listEmployees({ search: text, page: 1, pageSize: DIRECTORY_PAGE_SIZE }).pipe(
      map((page) => page.items.map((e) => ({
        id: e.id, name: e.fullName, avatarFileId: e.avatarFileId ?? null,
        detail: [e.positionName, e.departmentName].filter(Boolean).join(' · ') || e.email
      }))));
}
