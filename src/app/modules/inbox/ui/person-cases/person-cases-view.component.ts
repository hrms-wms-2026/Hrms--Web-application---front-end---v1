import { Component, computed, inject, input, output, signal } from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DatePipe } from '@angular/common';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { InboxItemRef } from '../../models/inbox.dto';
import { InboxPersonCasesStore } from '../../state/inbox-person-cases.store';
import { PersonCaseMonthGridComponent, personCaseMonthBounds } from './person-case-month-grid.component';
import { PersonCaseRowComponent } from './person-case-row.component';

/** A person's cases one month at a time, across every type - the details panel of a 1-on-1 chat. */
@Component({
  selector: 'app-person-cases-view',
  standalone: true,
  imports: [AvatarComponent, DatePipe, PopoverComponent, PersonCaseMonthGridComponent, PersonCaseRowComponent],
  template: `
    <section class="pcv" data-testid="person-cases-view">
      <header class="pcv__head">
        <app-avatar [userName]="store.personName()" [avatarUrl]="avatarUrl()" size="md" />
        <div class="pcv__who">
          <span class="pcv__person" data-testid="pcv-person">{{ store.personName() }}</span>
          <span class="pcv__category" data-testid="pcv-category">Requests and alerts</span>
        </div>
      </header>

      <div class="pcv__switcher">
        <button type="button" class="pcv__arrow" data-testid="pcv-prev" aria-label="Previous month"
                [disabled]="key() - 1 < bounds().min" (click)="step(-1)">‹</button>
        <app-popover [open]="gridOpen()" ariaLabel="Pick a month" align="left" (closed)="gridOpen.set(false)">
          <button popover-trigger type="button" class="pcv__month" data-testid="pcv-month" [attr.aria-expanded]="gridOpen()"
                  (click)="toggleGrid()">{{ monthDate() | date: 'MMMM y' }}</button>
          <div popover-panel>
            @if (gridOpen()) {
              <app-person-case-month-grid
                [year]="store.dotsYear()"
                [selectedMonth]="store.dotsYear() === store.year() ? store.month() : null"
                [dots]="store.dots()"
                [hireDate]="store.hireDate()"
                [today]="today"
                (yearChange)="store.browseYear($event)"
                (pick)="pick($event.year, $event.month)" />
            }
          </div>
        </app-popover>
        <button type="button" class="pcv__arrow" data-testid="pcv-next" aria-label="Next month"
                [disabled]="key() + 1 > bounds().max" (click)="step(1)">›</button>
      </div>

      <div class="pcv__list scroll-fade">
        @if (store.monthLoading()) {
          <p class="pcv__quiet">Loading…</p>
        } @else {
          @for (row of store.monthCases(); track row.item.source + row.item.kind + row.item.id) {
            <app-person-case-row [case]="row" (open)="open.emit($event)" />
          } @empty {
            <p class="pcv__quiet" data-testid="pcv-empty">No cases this month</p>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: flex; min-height: 0; flex: 1; flex-direction: column; }
    .pcv { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 12px; padding: 16px; }
    .pcv__head { display: flex; align-items: center; gap: 12px; }
    .pcv__who { display: flex; min-width: 0; flex-direction: column; }
    .pcv__person { overflow: hidden; font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .pcv__category { color: var(--color-text-secondary); font-size: 12px; }
    .pcv__switcher { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border); }
    .pcv__arrow { width: 32px; height: 32px; border: 0; border-radius: 8px; background: none; color: var(--color-text-primary); font-size: 18px; cursor: pointer; }
    .pcv__arrow:hover:not(:disabled) { background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); }
    .pcv__arrow:disabled { opacity: .35; cursor: default; }
    .pcv__month { padding: 6px 12px; border: 0; border-radius: 8px; background: none; color: var(--color-text-primary); font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; }
    .pcv__month:hover { background: color-mix(in srgb, var(--color-text-primary) 6%, transparent); }
    .pcv__list { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 2px; overflow-y: auto; }
    .pcv__quiet { margin: 0; padding: 4px 8px; color: var(--color-text-secondary); font-size: 13px; }
  `]
})
export class PersonCasesViewComponent {
  protected readonly store = inject(InboxPersonCasesStore);
  /** The person's photo, when the chat list has it. */
  avatarFileId = input<string | null>(null);
  open = output<InboxItemRef>();

  protected readonly avatarUrl = computed(() => (this.avatarFileId() ? buildFileUrl(this.avatarFileId()!) : null));

  protected readonly today = new Date();
  protected readonly gridOpen = signal(false);
  protected readonly bounds = computed(() => personCaseMonthBounds(this.store.hireDate(), this.today));
  /** year * 12 + month, the same key the bounds use. */
  protected readonly key = computed(() => this.store.year() * 12 + this.store.month());
  protected readonly monthDate = computed(() => new Date(this.store.year(), this.store.month() - 1, 1));

  protected step(delta: number): void {
    const date = new Date(this.store.year(), this.store.month() - 1 + delta, 1);
    void this.store.goToMonth(date.getFullYear(), date.getMonth() + 1);
  }

  protected toggleGrid(): void {
    const opening = !this.gridOpen();
    this.gridOpen.set(opening);
    if (opening) void this.store.browseYear(this.store.year());
  }

  protected pick(year: number, month: number): void {
    this.gridOpen.set(false);
    void this.store.goToMonth(year, month);
  }
}
