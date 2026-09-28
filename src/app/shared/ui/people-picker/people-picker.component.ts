import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../avatar/avatar.component';

export interface PeoplePickerOption {
  id: string;
  name: string;
  email?: string | null;
  detail?: string | null;
  avatarUrl?: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Multi-select people list with search. Presentational: the parent owns the options (so it can
 * search server-side) and the selection; with `allowGuests` a typed email that matches nobody can
 * be added as a guest. */
@Component({
  selector: 'app-people-picker',
  standalone: true,
  imports: [AvatarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5 select-none">
      <div class="flex items-center gap-1.5 border-b border-[var(--color-border)] px-1.5 py-1">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="h-3.5 w-3.5 shrink-0 fill-none stroke-[var(--color-text-secondary)]" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          data-testid="people-picker-search"
          class="w-full border-0 bg-transparent py-1 text-xs text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-secondary)]"
          [placeholder]="placeholder()"
          [value]="query()"
          (input)="onInput($any($event.target).value)"
        />
      </div>

      <div class="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        @for (guest of guests(); track guest) {
          <button
            type="button"
            data-testid="people-picker-guest-row"
            class="flex w-full items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-surface))] px-2 py-1.5 text-left text-xs text-[var(--color-accent)]"
            aria-pressed="true"
            (click)="guestToggled.emit(guest)"
          >
            <app-avatar size="xs" shape="circle" [userName]="guest" />
            <span class="min-w-0 flex-1 truncate font-semibold">{{ guest }}</span>
            <span class="shrink-0 rounded-full bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)]">Guest</span>
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0 fill-none stroke-current" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m5 12 4 4L19 7" />
            </svg>
          </button>
        }

        @if (inviteCandidate(); as candidate) {
          <button
            type="button"
            data-testid="people-picker-invite"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-accent)] hover:bg-[var(--color-surface-secondary)]"
            (click)="inviteGuest(candidate)"
          >
            <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-dashed border-current text-sm leading-none" aria-hidden="true">+</span>
            <span class="min-w-0 flex-1 truncate">Invite <strong class="font-semibold">{{ candidate }}</strong> as a guest</span>
          </button>
        }

        @for (person of options(); track person.id) {
          <button
            type="button"
            data-testid="people-picker-row"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface-secondary)]"
            [class.bg-[var(--color-surface-secondary)]]="isSelected(person.id)"
            [attr.aria-pressed]="isSelected(person.id)"
            (click)="toggled.emit(person.id)"
          >
            <app-avatar size="xs" shape="circle" [avatarUrl]="person.avatarUrl" [userName]="person.name" />
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="truncate font-medium">{{ person.name }}</span>
              @if (person.email || person.detail) {
                <span class="truncate text-[10px] text-[var(--color-text-secondary)]">{{ subtitle(person) }}</span>
              }
            </span>
            @if (isSelected(person.id)) {
              <svg data-testid="people-picker-check" viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0 fill-none stroke-[var(--color-accent)]" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m5 12 4 4L19 7" />
              </svg>
            }
          </button>
        }

        @if (options().length === 0 && guests().length === 0 && !inviteCandidate()) {
          <p data-testid="people-picker-empty" class="m-0 px-2 py-3 text-center text-xs text-[var(--color-text-secondary)]">{{ emptyText() }}</p>
        }
      </div>
    </div>
  `
})
export class PeoplePickerComponent {
  options = input<readonly PeoplePickerOption[]>([]);
  selectedIds = input<readonly string[]>([]);
  guests = input<readonly string[]>([]);
  allowGuests = input(false);
  placeholder = input('Search people...');
  emptyText = input('No matching people');

  searchChange = output<string>();
  toggled = output<string>();
  guestAdded = output<string>();
  guestToggled = output<string>();

  protected readonly query = signal('');

  protected readonly inviteCandidate = computed(() => {
    if (!this.allowGuests()) return null;
    const email = this.query().trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return null;
    if (this.guests().includes(email)) return null;
    if (this.options().some((person) => person.email?.toLowerCase() === email)) return null;
    return email;
  });

  protected isSelected(id: string): boolean {
    return this.selectedIds().includes(id);
  }

  protected subtitle(person: PeoplePickerOption): string {
    return [person.email, person.detail].filter(Boolean).join(' · ');
  }

  protected onInput(value: string): void {
    this.query.set(value);
    this.searchChange.emit(value.trim().replace(/^@/, ''));
  }

  protected inviteGuest(email: string): void {
    this.guestAdded.emit(email);
    this.query.set('');
    this.searchChange.emit('');
  }
}
