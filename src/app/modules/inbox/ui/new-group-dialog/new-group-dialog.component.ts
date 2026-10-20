import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { catchError, of } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { ConversationsApiService } from '../../data-access/conversations-api.service';

export interface NewGroupChoice {
  /** Empty for a case group: it is named after its case. */
  name: string;
  employeeIds: string[];
}

/**
 * Starts a group: a named group of anyone in the legal entity, or ("case" mode) the dedicated group of a case, which
 * takes the case's people along and is named after it - only the people to add are asked for.
 */
@Component({
  selector: 'app-new-group-dialog',
  standalone: true,
  imports: [ModalComponent, PeoplePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" [title]="caseTitle() ? 'Start a group for this case' : 'New group'"
      [subtitle]="caseTitle() ?? 'Chat with several people at once'" size="md" (closed)="closed.emit()">
      <div class="ngd" data-testid="new-group-dialog">
        @if (!caseTitle()) {
          <label class="ngd__field">
            <span>Group name</span>
            <input data-testid="new-group-name" maxlength="80" placeholder="e.g. Payroll review" [value]="name()"
              (input)="name.set($any($event.target).value)" />
          </label>
        } @else {
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
  `,
  styles: [`
    .ngd { display: flex; flex-direction: column; gap: 14px; }
    .ngd__field { display: flex; flex-direction: column; gap: 6px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; }
    .ngd__field input { height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface);
      color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 400; }
    .ngd__field input:focus { border-color: var(--color-accent); outline: none; }
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
  /** Set for "case" mode: the case the group is for. */
  caseTitle = input<string | null>(null);
  /** People already picked when it opens (the other person of a 1-on-1 chat). */
  initialPeople = input<readonly PeoplePickerOption[]>([]);
  busy = input(false);
  error = input<string | null>(null);

  created = output<NewGroupChoice>();
  closed = output<void>();

  protected readonly name = signal('');
  protected readonly chosen = signal<string[]>([]);
  protected readonly options = signal<PeoplePickerOption[]>([]);
  private known = new Map<string, PeoplePickerOption>();

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.name.set('');
        this.known = new Map(this.initialPeople().map((p) => [p.id, p]));
        this.chosen.set(this.initialPeople().map((p) => p.id));
        this.search('');
      });
    });
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

  protected create(): void {
    if (this.canCreate()) this.created.emit({ name: this.name().trim(), employeeIds: this.chosen() });
  }
}
