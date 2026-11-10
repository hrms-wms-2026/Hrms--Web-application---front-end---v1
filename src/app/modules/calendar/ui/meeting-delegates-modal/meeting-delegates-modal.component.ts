import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeoplePickerComponent, PeoplePickerOption } from '../../../../shared/ui/people-picker/people-picker.component';
import { ConversationsApiService } from '../../../inbox/data-access/conversations-api.service';
import { MeetingApiService } from '../../../work/meetings/data-access/meeting-api.service';
import { MeetingDelegateView } from '../../../work/meetings/models/meeting.models';

/**
 * "Meeting delegates" (Calendar page): the people allowed to run the caller's meetings - create, edit, reschedule and
 * cancel them, as the caller. Each person manages only their own list; an optional Until date ends the permission.
 */
@Component({
  selector: 'app-meeting-delegates-modal',
  standalone: true,
  imports: [ModalComponent, DatePickerComponent, PeoplePickerComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Meeting delegates" (closed)="closed.emit()">
      <div class="mdm">
        <p class="mdm__help">These people can schedule, change and cancel your meetings. Invitees see you as the organizer.</p>
        @if (delegates().length > 0) {
          <ul class="mdm__list">
            @for (row of delegates(); track row.id) {
              <li data-testid="meeting-delegate-row">
                <span class="mdm__who">
                  <span>{{ row.name }}</span>
                  <span class="mdm__state" [class.mdm__state--expired]="row.state === 'expired'">
                    {{ row.state === 'expired' ? 'Expired' : 'Active' }}{{ row.expiresAt && row.state === 'active' ? ' · until ' + (row.expiresAt | date: 'd MMM y') : '' }}
                  </span>
                </span>
                <button type="button" class="mdm__remove" [attr.data-testid]="'meeting-delegate-remove-' + row.id"
                  [attr.aria-label]="'Remove ' + row.name + ' as a meeting delegate'" (click)="remove(row.id)">Remove</button>
              </li>
            }
          </ul>
        }
        <div class="mdm__label">Add a delegate</div>
        @if (chosen(); as person) {
          <div class="mdm__chosen">
            <span>{{ person.name }}</span>
            <button type="button" class="mdm__remove" (click)="chosen.set(null)">Change</button>
          </div>
        } @else {
          <app-people-picker [options]="options()" placeholder="Search people…" (searchChange)="onSearch($event)"
            (toggled)="pickById($event)" />
        }
        <app-date-picker label="Until (optional)" [value]="until()" (valueChange)="until.set($event)" />
        @if (error()) { <p class="mdm__error" role="alert" data-testid="meeting-delegate-error">{{ error() }}</p> }
        <div class="mdm__actions">
          <button type="button" class="mdm__secondary" (click)="closed.emit()">Close</button>
          <button type="button" class="mdm__primary" data-testid="save-meeting-delegate" [disabled]="!canSave()" (click)="save()">
            {{ saving() ? 'Saving…' : 'Add delegate' }}
          </button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [`
    .mdm { display: flex; flex-direction: column; gap: 12px; font-size: 13px; }
    .mdm__help { margin: 0; color: var(--color-text-secondary); }
    .mdm__list { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .mdm__list li, .mdm__chosen { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--color-border); border-radius: 10px; }
    .mdm__who { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .mdm__state { color: var(--color-success); font-size: 11px; font-weight: 600; }
    .mdm__state--expired { color: var(--color-text-secondary); }
    .mdm__label { color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .mdm__remove { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-weight: 600; cursor: pointer; }
    .mdm__error { margin: 0; color: var(--color-danger); font-size: 12px; }
    .mdm__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .mdm__secondary, .mdm__primary { padding: 8px 14px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-weight: 600; cursor: pointer; }
    .mdm__primary { border-color: var(--color-accent); background: var(--color-accent); color: var(--color-accent-contrast, #fff); }
    .mdm__primary:disabled { opacity: .55; cursor: default; }
  `],
})
export class MeetingDelegatesModalComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  private readonly api = inject(MeetingApiService);
  private readonly people = inject(ConversationsApiService);

  protected readonly delegates = signal<readonly MeetingDelegateView[]>([]);
  protected readonly options = signal<readonly PeoplePickerOption[]>([]);
  protected readonly chosen = signal<{ id: string; name: string } | null>(null);
  /** The last day, as the date picker gives it (yyyy-MM-dd); empty means until revoked. */
  protected readonly until = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canSave = computed(() => !this.saving() && !!this.chosen());

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.chosen.set(null);
        this.until.set('');
        this.error.set(null);
        void this.load();
      });
    });
  }

  private async load(): Promise<void> {
    try {
      this.delegates.set(await firstValueFrom(this.api.listDelegates()));
    } catch (err) {
      this.error.set(toSafeErrorMessage(err, 'Could not load your meeting delegates.'));
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
      // "Until 1 Dec" lasts to the end of that day, in the viewer's time zone.
      const expiresAt = this.until() ? new Date(`${this.until()}T23:59:59`).toISOString() : undefined;
      const created = await firstValueFrom(this.api.addDelegate(person.id, expiresAt));
      this.delegates.update((rows) => [...rows.filter((r) => r.employeeId !== created.employeeId), created]);
      this.chosen.set(null);
      this.until.set('');
    } catch (err) {
      this.error.set(toSafeErrorMessage(err, 'Could not add the delegate.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(id: string): Promise<void> {
    this.error.set(null);
    try {
      await firstValueFrom(this.api.revokeDelegate(id));
      this.delegates.update((rows) => rows.filter((r) => r.id !== id));
    } catch (err) {
      this.error.set(toSafeErrorMessage(err, 'Could not remove the delegate.'));
    }
  }
}
