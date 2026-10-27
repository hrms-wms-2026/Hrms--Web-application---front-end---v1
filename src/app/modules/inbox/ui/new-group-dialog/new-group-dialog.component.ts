import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ChangePhotoDialogComponent, PHOTO_ACCEPT } from '../../../../shared/ui/change-photo-dialog/change-photo-dialog.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';

export interface NewGroupChoice {
  /** A case group falls back to its case title when this is empty. */
  name: string;
  employeeIds: string[];
  /** The group's photo (already framed), or null for none. */
  photo: File | null;
}

/**
 * Starts a group: a named group of anyone in the legal entity, or ("case" mode) the dedicated group of a case, which
 * takes the case's people along and is named after the case unless the user names it otherwise. Either can have a photo,
 * framed in the Change photo popup.
 */
@Component({
  selector: 'app-new-group-dialog',
  standalone: true,
  imports: [ChangePhotoDialogComponent, ModalComponent, PeoplePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="caseTitle() ? 'Start a group for this case' : 'New group'"
      [subtitle]="caseTitle() ?? 'Chat with several people at once'" size="md" (closed)="closed.emit()">
      <div class="ngd" data-testid="new-group-dialog">
        <div class="ngd__identity">
          <button type="button" class="ngd__photo" data-testid="new-group-photo" [attr.aria-label]="photoUrl() ? 'Change group photo' : 'Add group photo'"
            [title]="photoUrl() ? 'Change group photo' : 'Add group photo'" (click)="pickPhoto(photoInput)">
            @if (photoUrl(); as url) {
              <img [src]="url" alt="" />
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            }
          </button>
          <input #photoInput type="file" class="ngd__file" [accept]="photoAccept" tabindex="-1" aria-hidden="true" (change)="onPhotoPicked($event)" />
          <label class="ngd__field ngd__field--grow">
            <span>Group name</span>
            <input class="ui-input" data-testid="new-group-name" maxlength="80" [placeholder]="caseTitle() ?? 'e.g. Payroll review'" [value]="name()"
              (input)="name.set($any($event.target).value)" />
          </label>
        </div>
        @if (caseTitle()) {
          <p class="ngd__hint">Everyone already on this case comes along. Add the people who should help.</p>
        }
        <div class="ngd__field">
          <span>People</span>
          <app-people-picker [options]="options()" [selectedIds]="chosen()" placeholder="Search people…"
            (searchChange)="search($event)" (toggled)="toggle($event)" />
        </div>
        @if (error()) { <p class="ngd__error" role="alert">{{ error() }}</p> }
        <div class="ngd__actions">
          <button type="button" class="ngd__btn" (click)="closed.emit()">Cancel</button>
          <button type="button" class="ngd__btn ngd__btn--primary" data-testid="new-group-create" [disabled]="!canCreate() || busy()"
            (click)="create()">{{ caseTitle() ? 'Start group' : 'Create group' }}</button>
        </div>
      </div>
    </app-modal>

    @if (framing()) {
      <app-change-photo-dialog title="Group photo" fileName="group-photo" [initialFile]="pickedFile()" [existingUrl]="photoUrl()"
        (saved)="setPhoto($event)" (removed)="setPhoto(null)" (closed)="framing.set(false)" />
    }
  `,
  styles: [`
    .ngd { display: flex; flex-direction: column; gap: 14px; }
    .ngd__identity { display: flex; align-items: flex-end; gap: 12px; }
    .ngd__photo { display: inline-flex; width: 56px; height: 56px; flex: 0 0 auto; align-items: center; justify-content: center; overflow: hidden; padding: 0;
      border: 1px dashed var(--color-border); border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); cursor: pointer; }
    .ngd__photo:hover { border-color: var(--color-accent); color: var(--color-accent); }
    .ngd__photo:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .ngd__photo img { width: 100%; height: 100%; object-fit: cover; }
    .ngd__photo svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .ngd__file { display: none; }
    .ngd__field { display: flex; flex-direction: column; gap: 6px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .ngd__field--grow { min-width: 0; flex: 1; }

    .ngd__hint { margin: 0; color: var(--color-text-secondary); font-size: 13px; }
    .ngd__error { margin: 0; color: var(--color-danger); font-size: 12px; }
    .ngd__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .ngd__btn { height: 32px; padding: 0 14px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .ngd__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .ngd__btn:disabled { opacity: .5; cursor: default; }
  `]
})
export class NewGroupDialogComponent {
  private readonly conversations = inject(ConversationsApiService);

  open = input(false);
  /** Set for "case" mode: the case the group is for (and its name unless the user changes it). */
  caseTitle = input<string | null>(null);
  /** People already picked when it opens (the other person of a 1-on-1 chat). */
  initialPeople = input<readonly PeoplePickerOption[]>([]);
  busy = input(false);
  error = input<string | null>(null);

  created = output<NewGroupChoice>();
  closed = output<void>();

  protected readonly photoAccept = PHOTO_ACCEPT;
  protected readonly name = signal('');
  protected readonly chosen = signal<string[]>([]);
  protected readonly options = signal<PeoplePickerOption[]>([]);
  /** The framed photo and its preview URL. */
  protected readonly photo = signal<File | null>(null);
  protected readonly photoUrl = signal<string | null>(null);
  /** The Change photo popup is open, on a newly picked file or the current photo. */
  protected readonly framing = signal(false);
  protected readonly pickedFile = signal<File | null>(null);
  private known = new Map<string, PeoplePickerOption>();

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.name.set(this.caseTitle() ?? '');
        this.setPhoto(null);
        this.known = new Map(this.initialPeople().map((p) => [p.id, p]));
        this.chosen.set(this.initialPeople().map((p) => p.id));
        this.search('');
      });
    });
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected canCreate(): boolean {
    return this.chosen().length > 0 && (!!this.caseTitle() || this.name().trim().length > 0);
  }

  protected search(text: string): void {
    this.conversations.searchPeople(text).pipe(catchError(() => of([]))).subscribe((people) => {
      for (const p of people) this.known.set(p.employeeId, { id: p.employeeId, name: p.name });
      // Picked people stay listed while searching for others.
      const found = people.map((p) => ({ id: p.employeeId, name: p.name }));
      const picked = this.chosen().filter((id) => !found.some((f) => f.id === id)).map((id) => this.known.get(id)).filter((p): p is PeoplePickerOption => !!p);
      this.options.set([...picked, ...found]);
    });
  }

  protected toggle(id: string): void {
    this.chosen.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  /** No photo yet opens the file picker; a photo opens the Change photo popup (re-frame, pick another, remove). */
  protected pickPhoto(fileInput: HTMLInputElement): void {
    if (this.photo()) {
      // The popup opens on the file itself: it cannot fetch a blob: preview URL. existingUrl only offers "Remove".
      this.pickedFile.set(this.photo());
      this.framing.set(true);
    } else {
      fileInput.click();
    }
  }

  protected onPhotoPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pickedFile.set(file);
    this.framing.set(true);
  }

  protected setPhoto(file: File | null): void {
    this.framing.set(false);
    this.pickedFile.set(null);
    this.revokePreview();
    this.photo.set(file);
    this.photoUrl.set(file ? URL.createObjectURL(file) : null);
  }

  protected create(): void {
    if (this.canCreate()) this.created.emit({ name: this.name().trim(), employeeIds: this.chosen(), photo: this.photo() });
  }

  private revokePreview(): void {
    const url = this.photoUrl();
    if (url) URL.revokeObjectURL(url);
  }
}
