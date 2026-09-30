import { DatePipe } from '@angular/common';
import { Component, computed, effect, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { ApprovalTypeIconComponent } from '../approval-type-icon/approval-type-icon.component';
import { ApprovalFeedItemDto } from '../../models/dto/approval-feed.dto';
import {
  APPROVAL_TYPE_META,
  approvalSubtitle,
  approvalTitle,
  approvalTypeKey,
  statusLabel,
  statusTone
} from '../../utils/approval-feed.util';

const PAGE_SIZES = [10, 20, 50];

/** The Approvals page list: one row per request (already filtered + sorted), client-side paging, 3-dot quick actions. */
@Component({
  selector: 'app-approval-table',
  standalone: true,
  imports: [DatePipe, AvatarComponent, DropdownMenuComponent, WorkDropdownComponent, ApprovalTypeIconComponent],
  template: `
    <div class="approval-table" data-testid="approval-table">
      @if (items().length === 0) {
        <div class="approval-table__empty" data-testid="approval-table-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6" /><path d="M8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><path d="m9 13 2 2 4-4" /></svg>
          <p>{{ emptyMessage() }}</p>
        </div>
      } @else {
        <div class="approval-table__scroll">
          <table>
            <thead>
              <tr>
                <th scope="col" class="approval-table__col-title">Title</th>
                <th scope="col" class="approval-table__col-type">Type</th>
                <th scope="col" class="approval-table__col-person">Requested by</th>
                <th scope="col" class="approval-table__col-status">Status</th>
                <th scope="col" class="approval-table__actions-col"><span class="approval-table__sr">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (item of pageItems(); track item.source + item.id) {
                <tr
                  class="approval-table__row"
                  data-testid="approval-row"
                  [attr.data-id]="item.id"
                  [class.approval-table__row--selected]="item.id === selectedId()"
                  [class.approval-table__row--busy]="item.id === busyId()"
                  tabindex="0"
                  [attr.aria-selected]="item.id === selectedId()"
                  (click)="rowSelected.emit(item)"
                  (keydown.enter)="rowSelected.emit(item)"
                >
                  <td>
                    <div class="approval-table__title-cell">
                      <app-approval-type-icon [icon]="meta(item).icon" [tone]="meta(item).tone" />
                      <div class="approval-table__title-text">
                        <span class="approval-table__title">
                          {{ title(item) }}
                          @if (item.commentCount > 0) {
                            <span class="approval-table__comments" data-testid="approval-row-comments" [attr.aria-label]="item.commentCount + ' comments'">
                              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>
                              {{ item.commentCount }}
                            </span>
                          }
                        </span>
                        <span class="approval-table__subtitle">{{ subtitle(item) }}</span>
                      </div>
                    </div>
                  </td>
                  <td><span class="approval-pill" [class]="'approval-pill approval-pill--' + meta(item).tone">{{ meta(item).label }}</span></td>
                  <td>
                    <span class="approval-table__person">
                      <app-avatar [userName]="item.requestedByName" size="sm" />
                      <span class="approval-table__person-text">
                        <span class="approval-table__primary">{{ item.requestedByName }}</span>
                        <span class="approval-table__secondary">{{ item.createdAt | date: 'MMM d, y · h:mm a' }}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span data-testid="approval-status" [class]="'approval-pill approval-pill--' + tone(item)">{{ status(item) }}</span>
                  </td>
                  <td class="approval-table__actions-col" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()">
                    <app-dropdown-menu [items]="menuFor(item)" ariaLabel="Request actions" (selected)="onMenu(item, $event)">
                      <button menu-trigger type="button" class="approval-table__kebab" data-testid="approval-row-menu" aria-label="Request actions">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
                      </button>
                    </app-dropdown-menu>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="approval-table__footer">
          <span data-testid="approval-table-range">Showing {{ rangeStart() }} - {{ rangeEnd() }} of {{ items().length }} requests</span>
          <div class="approval-table__pager" role="navigation" aria-label="Pages">
            <button type="button" class="approval-table__page-btn" data-testid="approval-page-prev" aria-label="Previous page"
              [disabled]="page() === 1" (click)="goTo(page() - 1)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
            </button>
            @for (p of pages(); track p) {
              <button type="button" class="approval-table__page-btn" [class.approval-table__page-btn--active]="p === page()"
                [attr.aria-current]="p === page() ? 'page' : null" [attr.data-testid]="'approval-page-' + p" (click)="goTo(p)">{{ p }}</button>
            }
            <button type="button" class="approval-table__page-btn" data-testid="approval-page-next" aria-label="Next page"
              [disabled]="page() === pageCount()" (click)="goTo(page() + 1)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
            </button>
          </div>
          <app-work-dropdown
            size="sm"
            direction="up"
            accessibleLabel="Rows per page"
            testId="approval-page-size"
            [options]="pageSizeOptions"
            [selected]="pageSize() + ''"
            (selectionChanged)="setPageSize($event)"
          />
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .approval-table { display: flex; flex-direction: column; border: 1px solid var(--color-border); border-radius: 14px; background: var(--color-surface); overflow: hidden; }
    .approval-table__scroll { overflow: hidden; }
    table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 13px; }
    .approval-table__col-type { width: 132px; }
    .approval-table__col-person { width: 30%; }
    .approval-table__col-status { width: 100px; }
    th { position: sticky; top: 0; padding: 11px 14px; border-bottom: 1px solid var(--color-border); background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 12px; font-weight: 600; text-align: left; white-space: nowrap; }
    td { overflow: hidden; padding: 10px 14px; border-bottom: 1px solid var(--color-border); color: var(--color-text-primary); vertical-align: middle; }
    tbody tr:last-child td { border-bottom: 0; }
    .approval-table__row { cursor: pointer; transition: background-color .12s ease; }
    .approval-table__row:hover td { background: color-mix(in srgb, var(--color-accent) 4%, transparent); }
    .approval-table__row:focus-visible { outline: 2px solid var(--color-focus-ring, var(--color-accent)); outline-offset: -2px; }
    .approval-table__row--selected td { background: color-mix(in srgb, var(--color-accent) 9%, transparent); box-shadow: inset 0 1px 0 var(--color-accent), inset 0 -1px 0 var(--color-accent); }
    .approval-table__row--selected td:first-child { box-shadow: inset 1px 1px 0 var(--color-accent), inset 0 -1px 0 var(--color-accent); }
    .approval-table__row--selected td:last-child { box-shadow: inset -1px 1px 0 var(--color-accent), inset 0 -1px 0 var(--color-accent); }
    .approval-table__row--busy { opacity: .6; }
    .approval-table__title-cell { display: flex; align-items: center; gap: 11px; min-width: 0; }
    .approval-table__title-text { display: flex; flex-direction: column; min-width: 0; }
    .approval-table__title { display: flex; align-items: center; gap: 8px; min-width: 0; font-weight: 600; white-space: nowrap; }
    .approval-table__subtitle, .approval-table__secondary { color: var(--color-text-secondary); font-size: 12px; }
    .approval-table__subtitle, .approval-table__primary, .approval-table__secondary { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .approval-table__comments { display: inline-flex; align-items: center; gap: 3px; color: var(--color-text-secondary); font-size: 11px; font-weight: 600; }
    .approval-table__comments svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
    .approval-table__person { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .approval-table__person app-avatar { flex: 0 0 auto; }
    .approval-table__person-text { display: flex; min-width: 0; flex-direction: column; }
    .approval-pill { --tone: var(--color-accent); display: inline-block; max-width: 100%; overflow: hidden; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .approval-pill--neutral { --tone: var(--color-text-secondary); }
    .approval-table__actions-col { width: 48px; padding-inline: 4px; text-align: right; }
    .approval-table__kebab { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .approval-table__kebab:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .approval-table__kebab svg, .approval-table__page-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .approval-table__footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-top: 1px solid var(--color-border); color: var(--color-text-secondary); font-size: 13px; }
    .approval-table__pager { display: flex; align-items: center; gap: 4px; }
    .approval-table__page-btn { display: inline-flex; min-width: 32px; height: 32px; align-items: center; justify-content: center; padding: 0 8px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--color-text-primary); font: inherit; cursor: pointer; }
    .approval-table__page-btn:disabled { color: var(--color-text-secondary); opacity: .5; cursor: default; }
    .approval-table__page-btn--active { border-color: color-mix(in srgb, var(--color-accent) 35%, transparent); background: color-mix(in srgb, var(--color-accent) 12%, transparent); color: var(--color-accent); font-weight: 650; }
    .approval-table__empty { display: flex; min-height: 220px; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--color-text-secondary); font-size: 13px; }
    .approval-table__empty svg { width: 34px; height: 34px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .approval-table__empty p { margin: 0; }
    .approval-table__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `]
})
export class ApprovalTableComponent {
  items = input.required<readonly ApprovalFeedItemDto[]>();
  selectedId = input<string | null>(null);
  busyId = input<string | null>(null);
  emptyMessage = input('No requests match these filters.');

  rowSelected = output<ApprovalFeedItemDto>();
  quickApprove = output<ApprovalFeedItemDto>();
  cancelRequest = output<ApprovalFeedItemDto>();
  openTarget = output<ApprovalFeedItemDto>();
  copyLink = output<ApprovalFeedItemDto>();

  protected readonly pageSize = signal(10);
  protected readonly page = signal(1);
  protected readonly pageSizeOptions: readonly WorkDropdownOption[] = PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} / page` }));

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.items().length / this.pageSize())));
  protected readonly pages = computed(() => Array.from({ length: this.pageCount() }, (_, i) => i + 1));
  protected readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.items().slice(start, start + this.pageSize());
  });
  protected readonly rangeStart = computed(() => this.items().length === 0 ? 0 : (this.page() - 1) * this.pageSize() + 1);
  protected readonly rangeEnd = computed(() => Math.min(this.page() * this.pageSize(), this.items().length));

  constructor() {
    // A new filter result (or reload) starts from the first page.
    effect(() => {
      this.items();
      this.page.set(1);
    });
  }

  protected meta(item: ApprovalFeedItemDto) { return APPROVAL_TYPE_META[approvalTypeKey(item.actionType)]; }
  protected title(item: ApprovalFeedItemDto): string { return approvalTitle(item); }
  protected subtitle(item: ApprovalFeedItemDto): string { return approvalSubtitle(item); }
  protected status(item: ApprovalFeedItemDto): string { return statusLabel(item); }
  protected tone(item: ApprovalFeedItemDto): string { return statusTone(item); }

  protected goTo(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.pageCount()));
  }

  protected setPageSize(value: string): void {
    const size = Number(value);
    if (!PAGE_SIZES.includes(size)) return;
    this.pageSize.set(size);
    this.page.set(1);
  }

  /** Never 'reject' - rejecting always goes through the card's reminder dialog. */
  menuFor(item: ApprovalFeedItemDto): MenuItem[] {
    const items: MenuItem[] = [{ id: 'view', label: 'View details' }];
    if (item.status === 'pending' && item.canDecide) {
      items.push({ id: 'approve', label: item.source === 'invitation' ? 'Accept' : 'Approve' });
    }
    if (item.targetId && (item.targetType === 'task' || item.targetType === 'module')) {
      items.push({ id: 'open', label: item.targetType === 'task' ? 'Open task' : 'Open module' });
    }
    if (item.status === 'pending' && item.canCancel) items.push({ id: 'cancel', label: 'Cancel request' });
    items.push({ id: 'copy', label: 'Copy link' });
    return items;
  }

  protected onMenu(item: ApprovalFeedItemDto, id: string): void {
    switch (id) {
      case 'view': this.rowSelected.emit(item); break;
      case 'approve': this.quickApprove.emit(item); break;
      case 'open': this.openTarget.emit(item); break;
      case 'cancel': this.cancelRequest.emit(item); break;
      case 'copy': this.copyLink.emit(item); break;
    }
  }
}
