import { Component, inject, output } from '@angular/core';
import { InboxItemRef } from '../../models/inbox.dto';
import { InboxPersonCasesStore } from '../../state/inbox-person-cases.store';
import { PersonCaseRowComponent } from './person-case-row.component';

/** Ticket details "Past cases": up to 5 of the person's other cases from the ticket's month, then View all. */
@Component({
  selector: 'app-person-cases-section',
  standalone: true,
  imports: [PersonCaseRowComponent],
  template: `
    @if (store && !store.hidden()) {
      <section class="pcs" data-testid="person-cases">
        <h4 class="pcs__label">Past cases</h4>
        @if (store.compactLoading()) {
          <p class="pcs__quiet">Loading…</p>
        } @else {
          @for (row of store.compactRows(); track row.item.source + row.item.kind + row.item.id) {
            <app-person-case-row [case]="row" (open)="open.emit($event)" />
          } @empty {
            <p class="pcs__quiet" data-testid="pcs-empty">No other cases this month</p>
          }
          <button type="button" class="pcs__more" data-testid="pcs-view-all" (click)="store.openView()">
            {{ store.moreCount() > 0 ? 'View all (' + store.moreCount() + ')' : 'View history' }}
          </button>
        }
      </section>
    }
  `,
  styles: [`
    .pcs { display: flex; flex-direction: column; gap: 2px; }
    .pcs__label { margin: 0 0 8px; color: var(--color-text-primary); font-size: 13px; font-weight: 650; }
    .pcs__quiet { margin: 0; padding: 4px 8px; color: var(--color-text-secondary); font-size: 13px; }
    .pcs__more { align-self: flex-start; margin-top: 4px; padding: 0 8px; border: 0; background: none; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
  `]
})
export class PersonCasesSectionComponent {
  /** Provided by the inbox page; absent elsewhere (the card's own specs), where the section simply doesn't render. */
  protected readonly store = inject(InboxPersonCasesStore, { optional: true });
  open = output<InboxItemRef>();
}
