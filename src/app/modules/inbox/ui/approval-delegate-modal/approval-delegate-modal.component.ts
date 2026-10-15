import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { ApprovalDelegateDto, ApprovalDelegatesApiService } from '../../data-access/approval-delegates-api.service';
import { ConversationsApiService } from '../../data-access/conversations-api.service';

function errorText(err: unknown, fallback: string): string {
  const e = err as { error?: { detail?: string; message?: string }; message?: string };
  return e?.error?.detail || e?.error?.message || fallback;
}

/** "Delegate my approvals" (Inbox toolbar, leave:approve): who covers the caller's leave approvals and when. */
@Component({
  selector: 'app-approval-delegate-modal',
  standalone: true,
  imports: [ModalComponent, DatePickerComponent, PeoplePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Delegate my approvals" (closed)="closed.emit()">
      <div class="adm">
        <p class="adm__help">While you are away, this person can approve leave in your queue.</p>
        @if (delegates().length > 0) {
          <ul class="adm__list">
            @for (row of delegates(); track row.id) {
              <li data-testid="delegate-row">
                <span>{{ row.delegateName }} · {{ row.startDate }} – {{ row.endDate }}</span>
                <button type="button" class="adm__remove" [attr.data-testid]="'delegate-remove-' + row.id"
                  [attr.aria-label]="'Remove cover for ' + row.delegateName" (click)="remove(row.id)">Remove</button>
              </li>
            }
          </ul>
        }
        <div class="adm__label">Who covers you</div>
        @if (chosen(); as person) {
          <div class="adm__chosen">
            <span>{{ person.name }}</span>
            <button type="button" class="adm__remove" (click)="chosen.set(null)">Change</button>
          </div>
        } @else {
          <app-people-picker [options]="options()" placeholder="Search people…" (searchChange)="onSearch($event)"
            (toggled)="pickById($event)" />
        }
        <div class="adm__dates">
          <app-date-picker label="From" [value]="startDate()" (valueChange)="startDate.set($event)" />
          <app-date-picker label="To" [value]="endDate()" (valueChange)="endDate.set($event)" />
        </div>
        @if (error()) { <p class="adm__error" role="alert" data-testid="delegate-error">{{ error() }}</p> }
        <div class="adm__actions">
          <button type="button" class="adm__secondary" (click)="closed.emit()">Close</button>
          <button type="button" class="adm__primary" data-testid="save-delegate" [disabled]="!canSave()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Save cover' }}
          </button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .adm { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
    .adm__help { margin: 0; color: var(--color-text-secondary); }
    .adm__list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .adm__list li, .adm__chosen { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 10px; }
    .adm__label { color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .adm__dates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .adm__remove { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-weight: 600; cursor: pointer; }
    .adm__error { margin: 0; color: var(--color-danger); font-size: 12px; }
    .adm__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .adm__secondary, .adm__primary { padding: 8px 14px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-weight: 600; cursor: pointer; }
    .adm__primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .adm__primary:disabled { opacity: .55; cursor: default; }
  `]
})
export class ApprovalDelegateModalComponent {
  open = input(false);
  closed = output<void>();

  private readonly api = inject(ApprovalDelegatesApiService);
  private readonly people = inject(ConversationsApiService);

  protected readonly delegates = signal<readonly ApprovalDelegateDto[]>([]);
  protected readonly options = signal<readonly PeoplePickerOption[]>([]);
  protected readonly chosen = signal<{ id: string; name: string } | null>(null);
  protected readonly startDate = signal('');
  protected readonly endDate = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canSave = computed(() => !this.saving() && !!this.chosen() && !!this.startDate() && !!this.endDate());

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.chosen.set(null);
        this.startDate.set('');
        this.endDate.set('');
        this.error.set(null);
        void this.load();
      });
    });
  }

  private async load(): Promise<void> {
    try {
      this.delegates.set(await firstValueFrom(this.api.list()));
    } catch (err) {
      this.error.set(errorText(err, 'Could not load your covers.'));
    }
  }

  protected async onSearch(text: string): Promise<void> {
    if (!text.trim()) {
      this.options.set([]);
      return;
    }
    try {
      const found = await firstValueFrom(this.people.searchPeople(text));
      this.options.set(found.map((p) => ({ id: p.employeeId, name: p.name })));
    } catch {
      this.options.set([]);
    }
  }

  protected pickById(id: string): void {
    const person = this.options().find((o) => o.id === id);
    if (person) this.pick(person.id, person.name);
  }

  protected pick(id: string, name: string): void {
    this.chosen.set({ id, name });
  }

  protected async save(): Promise<void> {
    const person = this.chosen();
    if (!person || !this.canSave()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const created = await firstValueFrom(this.api.create({ delegateEmployeeId: person.id, startDate: this.startDate(), endDate: this.endDate() }));
      this.delegates.update((rows) => [...rows, created]);
      this.chosen.set(null);
      this.startDate.set('');
      this.endDate.set('');
    } catch (err) {
      this.error.set(errorText(err, 'Could not save the cover.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(id: string): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.remove(id));
      this.delegates.update((rows) => rows.filter((r) => r.id !== id));
    } catch (err) {
      this.error.set(errorText(err, 'Could not remove the cover.'));
    }
  }
}
