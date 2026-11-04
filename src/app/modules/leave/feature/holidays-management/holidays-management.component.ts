/** Settings → Time Off → Holidays: company holidays for a year. They do not count as leave. */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { NotificationService } from '../../../../core/services/notification.service';
import { LeaveCalendarStore } from '../../state/leave-calendar.store';
import { TimeOffSettingsTabsComponent } from '../../ui/time-off-settings-tabs/time-off-settings-tabs.component';
import { yearOptions } from '../../utils/leave-year-options';

@Component({
  selector: 'app-holidays-management',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent, DatePickerComponent, EmptyStateComponent, SelectComponent, TimeOffSettingsTabsComponent],
  template: `
    <section class="to-page">
      <header class="to-header">
        <app-breadcrumb-header class="to-breadcrumb" parentLabel="Settings" middleLabel="Time Off" currentLabel="Holidays" icon="settings" />
        <h1 class="to-sr-only">Holidays</h1>
        <div class="to-header-actions">
          <app-select [options]="yearOptions" [value]="year()" (valueChange)="onYearChange($event)" />
        </div>
      </header>
      <app-time-off-settings-tabs />

      <div class="hm-grid">
        <section class="hm-card" aria-labelledby="hm-list-heading">
          <h2 id="hm-list-heading">Company holidays {{ year() }}</h2>
          <p class="hm-help">These days do not count as leave. They show on the team availability calendar.</p>
          @if (store.holidays().length === 0) {
            <app-empty-state title="No holidays yet" description="Add the days your company is closed." />
          } @else {
            <ul class="hm-list">
              @for (row of store.holidays(); track row.id) {
                <li>
                  <span class="hm-list__name">{{ row.name }}</span>
                  <span class="hm-list__date">{{ row.date }}@if (row.endDate !== row.date) { – {{ row.endDate }} }</span>
                  <app-button variant="secondary" size="sm" [attr.aria-label]="'Remove ' + row.name" (pressed)="onRemove(row.id)">Remove</app-button>
                </li>
              }
            </ul>
          }
        </section>

        <section class="hm-card" aria-labelledby="hm-add-heading">
          <h2 id="hm-add-heading">Add a holiday</h2>
          <label class="hm-field">
            <span class="ui-field-label">Name</span>
            <input class="ui-input" type="text" [value]="name()" (input)="name.set($any($event.target).value)" />
          </label>
          <app-date-picker label="Date" [value]="date()" (valueChange)="date.set($event)" />
          <app-date-picker label="End date (optional)" [value]="endDate()" (valueChange)="endDate.set($event)" />
          @if (store.holidaysError()) { <p class="hm-error">{{ store.holidaysError() }}</p> }
          <div class="hm-actions">
            <app-button data-testid="save-holiday" [disabled]="saving() || !name().trim() || !date()" [loading]="saving()" (pressed)="onSave()">Add holiday</app-button>
          </div>
        </section>
      </div>
    </section>
  `,
  styleUrls: ['../../ui/time-off-chrome.css'],
  styles: [`
    .hm-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
    @media (max-width: 900px) { .hm-grid { grid-template-columns: 1fr; } }
    .hm-card { display: flex; flex-direction: column; gap: .75rem; padding: 1rem 1.1rem; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); }
    .hm-card h2 { margin: 0; font-size: .95rem; font-weight: 650; color: var(--color-text-primary); }
    .hm-help { margin: -.4rem 0 0; color: var(--color-text-secondary); font-size: .8rem; }
    .hm-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
    .hm-list li { display: flex; align-items: center; gap: .75rem; padding: .55rem 0; border-top: 1px solid var(--color-border); font-size: .82rem; }
    .hm-list li:first-child { border-top: 0; }
    .hm-list__name { flex: 1; min-width: 0; color: var(--color-text-primary); font-weight: 600; }
    .hm-list__date { color: var(--color-text-secondary); white-space: nowrap; }
    .hm-field { display: flex; flex-direction: column; gap: .3rem; }
    .hm-error { margin: 0; color: var(--color-danger); font-size: .8rem; }
    .hm-actions { display: flex; justify-content: flex-end; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HolidaysManagementComponent {
  readonly store = inject(LeaveCalendarStore);
  private readonly notificationService = inject(NotificationService);
  readonly yearOptions: SelectOption[] = yearOptions();
  readonly year = signal(String(new Date().getFullYear()));
  readonly name = signal('');
  readonly date = signal('');
  readonly endDate = signal('');
  readonly saving = signal(false);

  constructor() {
    void this.store.loadHolidaysForYear(Number(this.year()));
  }

  onYearChange(year: string): void {
    this.year.set(year);
    void this.store.loadHolidaysForYear(Number(year));
  }

  async onSave(): Promise<void> {
    if (!this.name().trim() || !this.date()) return;
    this.saving.set(true);
    const created = await this.store.createHoliday({ name: this.name().trim(), date: this.date(), endDate: this.endDate() || null });
    this.saving.set(false);
    if (!created) return;
    this.notificationService.success('Holiday added.');
    this.name.set('');
    this.date.set('');
    this.endDate.set('');
  }

  async onRemove(id: string): Promise<void> {
    const ok = await this.store.deleteHoliday(id);
    if (ok) this.notificationService.success('Holiday removed.');
    else this.notificationService.error(this.store.holidaysError() ?? 'Failed to remove holiday.');
  }
}
