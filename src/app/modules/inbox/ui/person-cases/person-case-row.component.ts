import { Component, computed, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { InboxItemDto, InboxItemRef, InboxPersonCaseDto } from '../../models/inbox.dto';
import { inboxIconTone, inboxStatusLabel, inboxStatusTone, inboxTypeMeta } from '../../utils/inbox-item.util';
import { isMutedPersonCase } from '../../utils/person-cases.util';
import { InboxTypeIconComponent } from '../inbox-type-icon/inbox-type-icon.component';

/** Every source titles a ticket "<type> - <person>"; the history row is about one person, so it shows the type only. */
export function personCaseLabel(item: InboxItemDto): string {
  const suffix = item.requestedBy ? ` - ${item.requestedBy.name}` : null;
  return suffix && item.title.endsWith(suffix) ? item.title.slice(0, -suffix.length) : item.title;
}

/** One past case: type icon (coloured like the ticket list) · type · date · status. Severity shows only as the colour. */
@Component({
  selector: 'app-person-case-row',
  standalone: true,
  imports: [DatePipe, InboxTypeIconComponent],
  template: `
    @let row = case();
    <button type="button" class="pcr" [class.pcr--muted]="muted()" [class.pcr--locked]="!row.canOpen"
            [disabled]="!row.canOpen"
            [title]="row.canOpen ? '' : 'You can’t open this case'" (click)="onClick()">
      <app-inbox-type-icon class="pcr__icon" [icon]="meta().icon" [tone]="iconTone()" />
      <span class="pcr__type" data-testid="pcr-type">{{ label() }}</span>
      <span class="pcr__date" data-testid="pcr-date">{{ row.item.createdAt | date: 'd MMM' }}</span>
      <span [class]="'pcr__chip pcr__chip--' + statusTone()" data-testid="pcr-status">{{ statusText() }}</span>
    </button>
  `,
  styles: [`
    :host { display: block; }
    .pcr { display: grid; width: 100%; min-width: 0; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 6px 8px; border: 0; border-radius: 8px; background: none; color: var(--color-text-primary); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    .pcr:hover:not(.pcr--locked) { background: var(--color-surface-hover, color-mix(in srgb, var(--color-text-primary) 5%, transparent)); }
    .pcr:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 1px; }
    .pcr--locked { color: var(--color-text-primary); cursor: default; }
    .pcr--muted { opacity: .55; }
    .pcr__icon { --iti-size: 26px; }
    .pcr__type { overflow: hidden; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
    .pcr__date { color: var(--color-text-secondary); font-size: 12px; white-space: nowrap; }
    .pcr__chip { --tone: var(--color-accent); padding: 1px 8px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 11px; font-weight: 600; white-space: nowrap; }
    .pcr__chip--neutral { --tone: var(--color-text-secondary); }
    .pcr__chip--warning { --tone: var(--color-warning, #d97706); }
    .pcr__chip--danger { --tone: var(--color-danger); }
    .pcr__chip--info { --tone: var(--color-info, #7c3aed); }
  `]
})
export class PersonCaseRowComponent {
  case = input.required<InboxPersonCaseDto>();
  open = output<InboxItemRef>();

  protected readonly meta = computed(() => inboxTypeMeta(this.case().item));
  protected readonly iconTone = computed(() => inboxIconTone(this.case().item, this.meta()));
  protected readonly label = computed(() => personCaseLabel(this.case().item));
  protected readonly statusText = computed(() => inboxStatusLabel(this.case().item));
  protected readonly statusTone = computed(() => inboxStatusTone(this.case().item));
  protected readonly muted = computed(() => isMutedPersonCase(this.case().item));

  protected onClick(): void {
    const { item, canOpen } = this.case();
    if (canOpen) this.open.emit({ source: item.source, kind: item.kind, id: item.id });
  }
}
