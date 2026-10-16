import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, skip } from 'rxjs';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { BulkAction, BulkActionBarComponent } from '../../../../shared/ui/bulk-action-bar/bulk-action-bar.component';
import { BulkActionResultModalComponent, BulkResultSummary } from '../../../../shared/ui/bulk-action-result-modal/bulk-action-result-modal.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { FilterBarComponent, FilterFieldConfig } from '../../../../shared/ui/filter-bar/filter-bar.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { TabOption, TabsComponent } from '../../../../shared/ui/tabs/tabs.component';
import { TaskAssigneeAvatarFilterComponent, TaskAssigneeAvatarMember } from '../../../work/ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { InboxCapability, InboxHistoryEntryDto, InboxItemDto, InboxItemRef, InboxSort, InboxTargetDto, sameRef } from '../../models/inbox.dto';
import { InboxKindsStore } from '../../state/inbox-kinds.store';
import { InboxStore } from '../../state/inbox.store';
import { InboxOutcomeChoice, InboxOutcomeDialogComponent } from '../../ui/inbox-action-dialogs/inbox-outcome-dialog.component';
import { ApprovalDelegateModalComponent } from '../../ui/approval-delegate-modal/approval-delegate-modal.component';
import { ConversationPanelComponent } from '../../ui/conversation-panel/conversation-panel.component';
import { InboxCommentDialogComponent } from '../../ui/inbox-comment-dialog/inbox-comment-dialog.component';
import { InboxCardAction, InboxItemCardComponent } from '../../ui/inbox-item-card/inbox-item-card.component';
import { InboxTypeIconComponent } from '../../ui/inbox-type-icon/inbox-type-icon.component';
import {
  inboxMenuItems,
  inboxStatusLabel,
  inboxStatusTone,
  inboxSubtitle,
  inboxTitle,
  inboxTypeMeta,
  requestedOnFrom,
  toFilterFields
} from '../../utils/inbox-item.util';
import {
  InboxBulkActionChoice,
  InboxDirectionChoice,
  InboxPageState,
  InboxTab,
  bulkActionsFor,
  groupByEmployee,
  pageStateFromParams,
  pageStateToParams,
  pageStateToQuery,
  tabCounts
} from '../../utils/inbox-page-state.util';

const SORT_OPTIONS: readonly { id: InboxSort; label: string; short: string }[] = [
  { id: 'latest', label: 'Latest activity', short: 'Latest' },
  { id: 'newest', label: 'Newest first', short: 'Newest' },
  { id: 'oldest', label: 'Oldest first', short: 'Oldest' }
];
const CHECK_ICON = 'M20 6 9 17l-5-5';
/** Whether the ticket details panel is collapsed - a per-viewer preference. */
const DETAILS_HIDDEN_KEY = 'inbox.detailsHidden';
const NARROW_QUERY = '(max-width: 1023px)';

function readDetailsHidden(): boolean {
  try {
    return localStorage.getItem(DETAILS_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

const DIRECTION_OPTIONS: readonly TabOption[] = [
  { value: 'all', label: 'All' }, { value: 'received', label: 'Received' }, { value: 'sent', label: 'Sent' }, { value: 'about', label: 'About me' }
];

const TAB_LABELS: Record<InboxTab, string> = { all: 'All', request: 'Requests', alert: 'Alerts', history: 'History' };

const LEAVE_APPROVE = 'leave:approve';

function sameParams(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

function withCount(label: string, n: number): string {
  return n > 0 ? `${label} (${n > 99 ? '99+' : n})` : label;
}

/** The Inbox as a ticket workspace: the ticket list (tabs, direction, sort, filters), the selected ticket's own
 *  conversation, and its details panel (collapsible) with the actions - across projects and modules. */
@Component({
  selector: 'app-inbox-page',
  standalone: true,
  imports: [
    DatePipe, AvatarComponent, BulkActionBarComponent, BulkActionResultModalComponent, DataTableComponent, DataTableCellDirective,
    DropdownMenuComponent, FilterBarComponent, BreadcrumbHeaderComponent, TabsComponent, ApprovalDelegateModalComponent, ConversationPanelComponent,
    InboxCommentDialogComponent, InboxItemCardComponent, InboxOutcomeDialogComponent, InboxTypeIconComponent, TaskAssigneeAvatarFilterComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inbox">
      <header class="work-page-header inbox__page-header">
        <div class="inbox__header-row">
          <app-breadcrumb-header parentLabel="Inbox" [currentLabel]="currentTabLabel()" icon="inbox" />
          <div class="inbox__header-tools">
            @if (state().tab !== 'history') {
              @if (searchExpanded() || search()) {
                <label class="inbox__search">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                  <input type="search" placeholder="Search requests and alerts…" aria-label="Search the inbox" data-testid="inbox-search" autofocus
                    [value]="search()" (input)="onSearch($any($event.target).value)" />
                  <button type="button" class="inbox__search-close" aria-label="Close search" title="Close search"
                    data-testid="inbox-search-close" (click)="closeSearch()">&times;</button>
                </label>
              } @else {
                <button type="button" class="inbox__icon-btn" aria-label="Search the inbox" title="Search"
                  data-testid="inbox-search-toggle" (click)="searchExpanded.set(true)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                </button>
              }
              <app-task-assignee-avatar-filter [members]="people()" [currentEmployeeId]="myEmployeeId()"
                [selected]="state().filters['requestedBy'] ?? []" (selectionChanged)="onFilterChanged({ key: 'requestedBy', values: $event })" />
            }
            <app-filter-bar [fields]="filterFields()" [values]="filterValues()" panelAlign="right" (fieldChanged)="onFilterChanged($event)" />
            @if (state().tab === 'alert') {
              <button type="button" class="inbox__tool-btn" data-testid="inbox-group-toggle" [attr.aria-pressed]="grouped()"
                (click)="grouped.set(!grouped())">{{ grouped() ? 'Ungroup' : 'Group by employee' }}</button>
            }
            @if (canDelegate) {
              <button type="button" class="inbox__tool-btn" data-testid="inbox-delegate" (click)="delegateOpen.set(true)">Delegate my approvals</button>
            }
          </div>
        </div>
      </header>

      <div class="inbox__workspace" data-testid="inbox-workspace"
        [class.inbox__workspace--open]="store.selectedRef() !== null"
        [class.inbox__workspace--details]="detailsShown()"
        [class.inbox__workspace--drawer]="narrow() && detailsShown()">
        <section class="inbox__panel inbox__list" aria-label="Tickets">
          <app-tabs class="inbox__tabs" ariaLabel="Category" [tabs]="tabs()" [value]="state().tab" (valueChange)="onTab($event)" />
          @if (state().tab !== 'history') {
            <div class="inbox__list-tools">
              <div class="inbox__segment" role="radiogroup" aria-label="Direction">
                @for (option of directionOptions; track option.value) {
                  <button type="button" role="radio" class="inbox__segment-btn" [class.inbox__segment-btn--active]="state().direction === option.value"
                    [attr.aria-checked]="state().direction === option.value" [attr.data-testid]="'inbox-direction-' + option.value"
                    (click)="onDirection(option.value)">{{ option.label }}</button>
                }
              </div>
              <app-dropdown-menu [items]="sortMenu()" ariaLabel="Sort tickets" (selected)="onSort($event)">
                <button menu-trigger type="button" class="inbox__sort" data-testid="inbox-sort">
                  Sort: <strong>{{ sortLabel() }}</strong>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </app-dropdown-menu>
            </div>
          }

          <div class="inbox__list-body">
            @if (state().tab === 'history') {
              @if (store.historyLoading() && store.history().length === 0) {
                <p class="inbox__state" aria-live="polite">Loading your history…</p>
              } @else if (store.historyError()) {
                <div class="inbox__state inbox__state--error" role="alert">
                  <span>{{ store.historyError() }}</span>
                  <button type="button" (click)="store.loadHistory()">Try again</button>
                </div>
              } @else if (store.history().length === 0) {
                <p class="inbox__state">Decisions you take show up here.</p>
              } @else {
                <ul class="inbox__history" data-testid="inbox-history">
                  @for (entry of store.history(); track entry.journalId) {
                    <li class="inbox__history-row" data-testid="inbox-history-row">
                      <button type="button" class="inbox__history-main" [disabled]="!entry.item" (click)="openHistory(entry)">
                        <span class="inbox__title"><span class="inbox__ellipsis">{{ entry.title }}</span></span>
                        <span class="inbox__secondary">Decided {{ entry.actionLabel }} · {{ entry.decidedAt | date: 'MMM d, y h:mm a' }}</span>
                        @if (entry.comment) { <span class="inbox__secondary inbox__ellipsis">“{{ entry.comment }}”</span> }
                      </button>
                      @if (entry.isReverted) {
                        <span class="inbox__pill inbox__pill--neutral">Undone</span>
                      } @else if (canUndo(entry)) {
                        <button type="button" class="inbox__chip" data-testid="inbox-history-revert" [disabled]="store.busy()"
                          (click)="undoFromHistory(entry)">Undo · until {{ entry.revertableUntil | date: 'h:mm a' }}</button>
                      }
                    </li>
                  }
                </ul>
                @if (historyPageCount() > 1) {
                  <nav class="inbox__pager" aria-label="History pages">
                    <button type="button" [disabled]="historyPage() <= 1" (click)="store.loadHistory({ page: historyPage() - 1 })">Previous</button>
                    <span>Page {{ historyPage() }} of {{ historyPageCount() }}</span>
                    <button type="button" [disabled]="historyPage() >= historyPageCount()" (click)="store.loadHistory({ page: historyPage() + 1 })">Next</button>
                  </nav>
                }
              }
            } @else if (store.loading() && store.items().length === 0) {
              <p class="inbox__state" aria-live="polite" data-testid="inbox-loading">Loading your inbox…</p>
            } @else if (store.error() && store.items().length === 0) {
              <div class="inbox__state inbox__state--error" role="alert" data-testid="inbox-error">
                <span>{{ store.error() }}</span>
                <button type="button" (click)="store.load()">Try again</button>
              </div>
            } @else if (state().tab === 'alert' && grouped()) {
              @if (groups().length === 0) { <p class="inbox__state">{{ emptyMessage() }}</p> }
              @for (group of groups(); track group.key) {
                <section class="inbox__group" data-testid="inbox-group">
                  <button type="button" class="inbox__group-header" data-testid="inbox-group-header"
                    [attr.aria-expanded]="!collapsed().has(group.key)" (click)="toggleGroup(group.key)">
                    <span class="inbox__group-caret" aria-hidden="true">{{ collapsed().has(group.key) ? '▸' : '▾' }}</span>
                    <app-avatar [userName]="group.name" size="xs" />
                    <span>{{ group.name }} · {{ group.items.length }}</span>
                  </button>
                  @if (!collapsed().has(group.key)) {
                    <ul class="inbox__group-list">
                      @for (row of group.items; track trackItem(row)) {
                        <li>
                          <button type="button" class="inbox__group-row" data-testid="inbox-row" [class.inbox__group-row--active]="activeRowId() === trackItem(row)"
                            (click)="open(refOf(row))">
                            <app-inbox-type-icon [icon]="meta(row).icon" [tone]="meta(row).tone" />
                            <span class="inbox__ticket-text">
                              <span class="inbox__ellipsis inbox__title">{{ title(row) }}</span>
                              <span class="inbox__secondary inbox__ellipsis">{{ subtitle(row) }}</span>
                            </span>
                            <span data-testid="inbox-status" [class]="'inbox__pill inbox__pill--' + tone(row)">{{ status(row) }}</span>
                          </button>
                        </li>
                      }
                    </ul>
                  }
                </section>
              }
            } @else {
              @if (selectedItems().length > 0) {
                <app-bulk-action-bar [count]="selectedItems().length" noun="item" [actions]="bulkBarActions()"
                  (action)="onBulkAction($event)" (cleared)="selectedIds.set(emptySelection)" />
              }
              <app-data-table
                data-testid="inbox-table"
                [columns]="columns()"
                [rows]="store.items()"
                [trackBy]="trackItem"
                [rowTestId]="rowTestId"
                [activeRowId]="activeRowId()"
                [busyRowId]="busyRowId()"
                [rowFocusable]="true"
                [emptyMessage]="emptyMessage()"
                [selectable]="selectable()"
                [selectedIds]="selectedIds()"
                [isRowSelectable]="isSelectable"
                (rowSelectionChanged)="onRowSelection($event)"
                (selectAllChanged)="onSelectAll($event)"
                (rowClicked)="open(refOf($event))"
              >
                <ng-template appDataTableCell="ticket" let-item>
                  <div class="inbox__ticket">
                    <app-inbox-type-icon [icon]="meta(item).icon" [tone]="meta(item).tone" />
                    <div class="inbox__ticket-text">
                      <span class="inbox__title">
                        <span class="inbox__ellipsis">{{ title(item) }}</span>
                        @if (item.unreadMessages > 0) {
                          <span class="inbox__unread" data-testid="inbox-row-unread" [attr.aria-label]="item.unreadMessages + ' unread messages'"></span>
                        }
                      </span>
                      @if (subtitle(item)) { <span class="inbox__secondary inbox__ellipsis">{{ subtitle(item) }}</span> }
                      <span class="inbox__chips">
                        <span [class]="'inbox__pill inbox__pill--sm inbox__pill--' + meta(item).tone">{{ meta(item).label }}</span>
                        <span class="inbox__source">{{ sourceLabel(item) }}</span>
                      </span>
                    </div>
                  </div>
                </ng-template>
                <ng-template appDataTableCell="person" let-item>
                  <span class="inbox__person">
                    @if (item.requestedBy) { <app-avatar [userName]="item.requestedBy.name" size="sm" /> }
                    <span class="inbox__person-text">
                      <span class="inbox__ellipsis">{{ item.requestedBy?.name ?? '—' }}</span>
                      <span class="inbox__secondary inbox__ellipsis">{{ item.createdAt | date: 'MMM d, y' }}</span>
                    </span>
                  </span>
                </ng-template>
                <ng-template appDataTableCell="status" let-item>
                  <span data-testid="inbox-status" [class]="'inbox__pill inbox__pill--' + tone(item)">{{ status(item) }}</span>
                </ng-template>
                <ng-template appDataTableCell="actions" let-item>
                  <app-dropdown-menu [items]="menuFor(item)" ariaLabel="Item actions" (selected)="onRowMenu(item, $event)">
                    <button menu-trigger type="button" class="inbox__kebab" data-testid="inbox-row-menu" aria-label="Item actions">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01" /></svg>
                    </button>
                  </app-dropdown-menu>
                </ng-template>
              </app-data-table>

              @if (pageCount() > 1) {
                <nav class="inbox__pager" aria-label="Pages">
                  <button type="button" data-testid="inbox-prev" [disabled]="page() <= 1" (click)="store.setPage(page() - 1)">Previous</button>
                  <span>Page {{ page() }} of {{ pageCount() }}</span>
                  <button type="button" data-testid="inbox-next" [disabled]="page() >= pageCount()" (click)="store.setPage(page() + 1)">Next</button>
                </nav>
              }
            }
          </div>
        </section>

        <section class="inbox__panel inbox__chat" aria-label="Ticket conversation">
          @if (store.selectedRef(); as ref) {
            <app-conversation-panel
              [itemRef]="ref"
              [item]="selectedItem()"
              [descriptor]="selectedItem() ? kinds.descriptor(selectedItem()!.source, selectedItem()!.kind) : null"
              [detailsVisible]="detailsShown()"
              [actions]="store.detail()?.item?.availableActions ?? []"
              [requesterId]="store.detail()?.item?.requestedBy?.id ?? null"
              (action)="card()?.runAction($event)"
              (toggleDetails)="toggleDetails()"
              (back)="close()"
            />
          } @else {
            <div class="inbox__chat-empty" data-testid="inbox-chat-empty">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z" /></svg>
              <p class="inbox__chat-empty-title">Select a ticket</p>
              <p>Its conversation and details open here.</p>
            </div>
          }
        </section>

        @if (store.selectedRef() !== null) {
          <div class="inbox__scrim" aria-hidden="true" (click)="toggleDetails()"></div>
          <aside class="inbox__panel inbox__details">
            <app-inbox-item-card
              #card
              [detail]="store.detail()"
              [loading]="store.detailLoading()"
              [error]="store.detailError()"
              [busy]="store.busy()"
              [actionError]="store.actionError()"
              [actionErrorInline]="store.actionErrorInline()"
              [descriptor]="store.detail() ? kinds.descriptor(store.detail()!.item.source, store.detail()!.item.kind) : null"
              (hide)="toggleDetails()"
              (action)="onCardAction($event)"
              (openTarget)="openTarget($event)"
            />
          </aside>
        }
      </div>
    </div>

    <!-- Overlays sit outside the flex column so they add no gap below the workspace. -->
    <app-inbox-comment-dialog
      [open]="bulkPending()?.needsComment === true && bulkPending()?.key !== 'resolve'"
      [title]="(bulkPending()?.label ?? '') + ' ' + selectedItems().length + ' items?'"
      [confirmLabel]="bulkPending()?.label ?? ''"
      (confirmed)="runBulk(bulkPending()!.key, $event, null)"
      (closed)="bulkPending.set(null)"
    />
    <app-inbox-outcome-dialog
      [open]="bulkPending()?.key === 'resolve'"
      [title]="'Resolve ' + selectedItems().length + ' alerts'"
      [outcomes]="bulkPending()?.outcomes ?? []"
      (confirmed)="onBulkOutcome($event)"
      (closed)="bulkPending.set(null)"
    />
    <app-bulk-action-result-modal [result]="bulkResult()" [names]="bulkNames()" noun="item" [showApprovals]="false"
      (closed)="bulkResult.set(null)" />
    <app-approval-delegate-modal [open]="delegateOpen()" (closed)="delegateOpen.set(false)" />
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    .inbox { display: flex; height: 100%; min-height: 0; flex-direction: column; gap: 12px; }
    /* Same sticky header as Work (global .work-page-header). */
    .inbox__page-header { margin-bottom: 0 !important; }
    .inbox__header-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; min-height: 36px; }
    .inbox__header-row app-breadcrumb-header { display: inline-flex; flex-shrink: 0; align-items: center; }
    .inbox__header-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .inbox__icon-btn { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; }
    .inbox__icon-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .inbox__icon-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .inbox__icon-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .inbox__search-close { display: inline-flex; width: 20px; height: 20px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 4px; background: none; color: var(--color-text-secondary); font: inherit; font-size: 16px; line-height: 1; cursor: pointer; }
    .inbox__search-close:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .inbox__search { display: inline-flex; width: 320px; max-width: 100%; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .inbox__search:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .inbox__search svg { width: 15px; height: 15px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 2; stroke-linecap: round; }
    .inbox__search input { width: 100%; min-width: 0; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; outline: none; }
    .inbox__tool-btn { height: 30px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .inbox__tool-btn:hover { border-color: var(--color-accent); }
    .inbox__tool-btn[aria-pressed="true"] { border-color: var(--color-accent); color: var(--color-accent); }
    .inbox__tool-btn:focus-visible, .inbox__chip:focus-visible, .inbox__group-header:focus-visible, .inbox__sort:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }

    /* The workspace: ticket list | conversation | ticket details, filling the rest of the page. */
    .inbox__workspace { display: grid; flex: 1; min-height: 0; grid-template-columns: minmax(400px, 40fr) minmax(0, 60fr); gap: 12px; }
    .inbox__workspace--details { grid-template-columns: minmax(400px, 40fr) minmax(320px, 36fr) minmax(300px, 24fr); }
    .inbox__panel { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); }
    .inbox__details { display: none; }
    .inbox__workspace--details .inbox__details { display: flex; }
    .inbox__scrim { display: none; }

    .inbox__tabs { padding: 6px 12px 0; }
    .inbox__list-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 12px 4px; }
    .inbox__segment { display: inline-flex; box-sizing: border-box; height: 30px; align-items: center; padding: 2px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-secondary); }
    .inbox__segment-btn { height: 24px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .inbox__segment-btn--active { background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
    .inbox__segment-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .inbox__sort { display: inline-flex; height: 30px; align-items: center; gap: 4px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12px; cursor: pointer; }
    .inbox__sort strong { color: var(--color-text-primary); font-weight: 600; }
    .inbox__sort:hover { background: var(--color-surface-secondary); }
    .inbox__sort svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .inbox__list-body { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 8px; overflow-y: auto; padding: 4px 8px 8px; }
    /* Compact cells for the narrow list (beats the table's own encapsulated padding). */
    .inbox__list-body ::ng-deep table.data-table th { padding: 8px; }
    .inbox__list-body ::ng-deep table.data-table td { padding: 8px; }

    .inbox__state { display: flex; align-items: center; gap: 8px; margin: 0; padding: 24px 8px; color: var(--color-text-secondary); font-size: 13px; }
    .inbox__state--error { color: var(--color-danger); }
    .inbox__state button { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-weight: 650; text-decoration: underline; cursor: pointer; }
    .inbox__ticket { display: flex; min-width: 0; align-items: flex-start; gap: 10px; }
    .inbox__ticket-text, .inbox__person-text { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
    .inbox__title { display: flex; min-width: 0; align-items: center; gap: 8px; font-weight: 600; }
    .inbox__unread { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 999px; background: var(--color-accent); }
    .inbox__ellipsis { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .inbox__secondary { color: var(--color-text-secondary); font-size: 12px; }
    .inbox__chips { display: flex; min-width: 0; align-items: center; gap: 6px; margin-top: 2px; }
    .inbox__source { overflow: hidden; color: var(--color-text-secondary); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .inbox__person { display: flex; min-width: 0; align-items: center; gap: 8px; }
    .inbox__person app-avatar { flex: 0 0 auto; }
    .inbox__pill { --tone: var(--color-accent); display: inline-block; max-width: 100%; overflow: hidden; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .inbox__pill--sm { padding: 1px 8px; font-size: 11px; }
    .inbox__pill--neutral { --tone: var(--color-text-secondary); }
    .inbox__pill--warning { --tone: var(--color-warning, #d97706); }
    .inbox__pill--danger { --tone: var(--color-danger); }
    .inbox__kebab { display: inline-flex; width: 28px; height: 28px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .inbox__kebab:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .inbox__kebab svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .inbox__pager { display: flex; align-items: center; justify-content: flex-end; gap: 12px; color: var(--color-text-secondary); font-size: 12px; }
    .inbox__pager button { padding: 5px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; cursor: pointer; }
    .inbox__pager button:disabled { opacity: .5; cursor: default; }
    .inbox__history { display: flex; flex-direction: column; margin: 0; padding: 0; border: 1px solid var(--color-border); border-radius: 12px; list-style: none; }
    .inbox__history-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--color-border); }
    .inbox__history-row:last-child { border-bottom: 0; }
    .inbox__history-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; padding: 0; border: 0; background: none; color: var(--color-text-primary); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    .inbox__history-main:disabled { cursor: default; }
    .inbox__chip { flex: 0 0 auto; padding: 4px 10px; border: 1px solid var(--color-accent); border-radius: 999px; background: var(--color-surface); color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .inbox__chip:disabled { opacity: .55; cursor: default; }
    .inbox__group { border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; }
    .inbox__group-header { display: flex; width: 100%; align-items: center; gap: 8px; padding: 10px 14px; border: 0; background: var(--color-surface-secondary); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 650; text-align: left; cursor: pointer; }
    .inbox__group-caret { width: 12px; color: var(--color-text-secondary); }
    .inbox__group-list { margin: 0; padding: 0; list-style: none; }
    .inbox__group-row { display: flex; width: 100%; min-width: 0; align-items: center; gap: 11px; padding: 9px 14px; border: 0; border-top: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; text-align: left; cursor: pointer; }
    .inbox__group-row:hover { background: var(--color-surface-secondary); }
    .inbox__group-row--active { background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); }

    .inbox__chat-empty { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 24px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .inbox__chat-empty svg { width: 36px; height: 36px; margin-bottom: 6px; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .inbox__chat-empty p { margin: 0; }
    .inbox__chat-empty-title { color: var(--color-text-primary); font-size: 14px; font-weight: 650; }

    /* Narrow screens, messenger-style: the list, then the chat (with a back button), then the details as a drawer. */
    @media (max-width: 1023px) {
      .inbox__workspace, .inbox__workspace--details { grid-template-columns: minmax(0, 1fr); }
      .inbox__chat { display: none; }
      .inbox__workspace--open .inbox__list { display: none; }
      .inbox__workspace--open .inbox__chat { display: flex; }
      .inbox__workspace--details .inbox__details { display: none; }
      .inbox__workspace--drawer .inbox__scrim { position: fixed; inset: 0; z-index: 1000; display: block; background: color-mix(in srgb, var(--color-text-primary) 35%, transparent); }
      .inbox__workspace--drawer .inbox__details { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1001; display: flex; width: min(420px, 100vw); border-radius: 0; }
    }
  `]
})
export class InboxPageComponent implements OnInit {
  protected readonly store = inject(InboxStore);
  protected readonly kinds = inject(InboxKindsStore);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly card = viewChild<InboxItemCardComponent>('card');

  protected readonly columns = computed<DataTableColumn[]>(() => [
    { key: 'ticket', label: `Tickets (${this.store.total()})` },
    { key: 'person', label: 'Requested by', width: '120px', hideLabel: true },
    { key: 'status', label: 'Status', width: '92px', hideLabel: true },
    { key: 'actions', label: 'Actions', width: '36px', interactive: true, align: 'end', hideLabel: true }
  ]);
  protected readonly directionOptions = DIRECTION_OPTIONS;
  protected readonly trackItem = (item: InboxItemDto): string => `${item.source}:${item.kind}:${item.id}`;
  protected readonly rowTestId = (): string => 'inbox-row';
  /** Only kinds that declare Bulk can be bulk-selected. */
  protected readonly isSelectable = (item: InboxItemDto): boolean => this.kinds.has(item.source, item.kind, InboxCapability.Bulk);
  protected readonly emptySelection: ReadonlySet<string> = new Set<string>();
  protected readonly canDelegate = inject(PermissionService).hasPermission(LEAVE_APPROVE);

  /** Tab, direction, search and filters - mirrored in the URL query string. */
  protected readonly state = signal<InboxPageState>({ tab: 'all', direction: 'all', search: '', sort: 'latest', filters: {} });
  protected readonly search = signal('');
  protected readonly searchExpanded = signal(false);
  protected readonly myEmployeeId = computed(() => this.auth.employeeId?.() ?? '');
  /** Everyone the inbox can be narrowed to (Work's requestedBy + other sources' employee facets), for the avatar stack. */
  protected readonly people = computed<TaskAssigneeAvatarMember[]>(() => {
    const byId = new Map<string, TaskAssigneeAvatarMember>();
    for (const field of this.store.filterFields())
      if (field.key === 'requestedBy' || field.key === 'employee')
        for (const o of field.options) if (!byId.has(o.value)) byId.set(o.value, { employeeId: o.value, name: o.label });
    return [...byId.values()];
  });
  protected readonly busyRowId = signal<string | null>(null);
  protected readonly grouped = signal(false);
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly bulkPending = signal<InboxBulkActionChoice | null>(null);
  protected readonly bulkResult = signal<BulkResultSummary | null>(null);
  protected readonly bulkNames = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly delegateOpen = signal(false);
  private readonly media = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null;
  /** Below 1024px the workspace is one screen at a time (list, chat, details drawer). */
  protected readonly narrow = signal(this.media?.matches ?? false);
  protected readonly detailsHidden = signal(readDetailsHidden());
  protected readonly drawerOpen = signal(false);
  protected readonly detailsShown = computed(() =>
    this.store.selectedRef() !== null && (this.narrow() ? this.drawerOpen() : !this.detailsHidden()));
  /** The open ticket for the chat header: the loaded detail when it is this ticket, else its list row. */
  protected readonly selectedItem = computed(() => {
    const ref = this.store.selectedRef();
    if (!ref) return null;
    const detail = this.store.detail()?.item;
    return detail && sameRef(detail, ref) ? detail : this.store.items().find((i) => sameRef(i, ref)) ?? null;
  });
  private readonly sourceLabels = computed(() =>
    new Map((this.store.filterFields().find((f) => f.key === 'source')?.options ?? []).map((o) => [o.value, o.label])));
  protected readonly sortMenu = computed<MenuItem[]>(() =>
    SORT_OPTIONS.map((o) => ({ id: o.id, label: o.label, iconPath: o.id === this.state().sort ? CHECK_ICON : undefined })));
  protected readonly sortLabel = computed(() => SORT_OPTIONS.find((o) => o.id === this.state().sort)?.short ?? 'Latest');
  private readonly searchChanges = new Subject<string>();

  protected readonly filterValues = computed(() => ({ requestedOn: ['any'], ...this.state().filters }));
  protected readonly filterFields = computed<FilterFieldConfig[]>(() => {
    const fields = toFilterFields(this.store.filterFields());
    if (fields.some((f) => f.key === 'kind')) return fields;
    // The kind filter comes from the registry; same-named kinds of different sources share one option.
    const options = new Map<string, string>();
    for (const k of this.kinds.kinds()) if (!options.has(k.kind)) options.set(k.kind, k.label);
    if (options.size === 0) return fields;
    const kind: FilterFieldConfig = { key: 'kind', label: 'Kind', icon: 'type', kind: 'multi', options: [...options].map(([value, label]) => ({ value, label })) };
    return [...fields.slice(0, -1), kind, fields[fields.length - 1]];
  });
  protected readonly tabs = computed<TabOption[]>(() => {
    const n = tabCounts(this.store.counts(), this.kinds.kinds());
    return [
      { value: 'all', label: withCount('All', n.all) },
      { value: 'request', label: withCount('Requests', n.request) },
      { value: 'alert', label: withCount('Alerts', n.alert) },
      { value: 'history', label: 'History' }
    ];
  });
  protected readonly currentTabLabel = computed(() => TAB_LABELS[this.state().tab]);
  protected readonly activeRowId = computed(() => {
    const ref = this.store.selectedRef();
    return ref ? `${ref.source}:${ref.kind}:${ref.id}` : null;
  });
  protected readonly page = computed(() => this.store.query().page ?? 1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.store.total() / (this.store.query().pageSize ?? 25))));
  protected readonly historyPage = computed(() => this.store.historyQuery().page ?? 1);
  protected readonly historyPageCount = computed(() =>
    Math.max(1, Math.ceil(this.store.historyTotal() / (this.store.historyQuery().pageSize ?? 25))));
  protected readonly emptyMessage = computed(() => this.isFiltered()
    ? 'Nothing matches these filters.'
    : 'Nothing here yet. Requests and alerts that involve you will show up here.');
  protected readonly groups = computed(() => groupByEmployee(this.store.items()));
  protected readonly selectable = computed(() => this.store.items().some(this.isSelectable));
  /** Selected rows still on the page (a refresh drops the ones that left). */
  protected readonly selectedItems = computed(() => this.store.items().filter((i) => this.selectedIds().has(this.trackItem(i))));
  private readonly bulkChoices = computed(() => bulkActionsFor(this.selectedItems(), (s, k) => this.kinds.descriptor(s, k)));
  protected readonly bulkBarActions = computed<BulkAction[]>(() => {
    const choices = this.bulkChoices();
    if (choices.length === 0)
      return [{ id: 'none', label: 'No common action', placement: 'primary', disabled: true, disabledReason: 'The selected items share no action.' }];
    return choices.map((c) => ({ id: c.key, label: c.label, placement: 'primary', danger: c.key === 'reject' }));
  });

  ngOnInit(): void {
    const params: Record<string, string> = {};
    const snapshot = this.route.snapshot?.queryParamMap;
    for (const key of snapshot?.keys ?? []) params[key] = snapshot!.get(key) ?? '';
    // A browser refresh (the app's first navigation) always opens the first tab; in-app links (bell, renderers) keep theirs.
    const nav = this.router.currentNavigation?.() ?? this.router.lastSuccessfulNavigation?.();
    const isPageLoad = !!nav && !nav.previousNavigation;
    if (isPageLoad && params['tab']) delete params['tab'];
    const initial = pageStateFromParams(params);
    this.state.set(initial);
    if (isPageLoad && snapshot?.has('tab'))
      void this.router.navigate([], { relativeTo: this.route, queryParams: pageStateToParams(initial), replaceUrl: true });
    this.search.set(initial.search);
    void this.loadForState();
    void this.store.loadFilters();
    void this.store.loadCounts();
    void this.kinds.ensureLoaded();
    const onMedia = (event: MediaQueryListEvent) => this.narrow.set(event.matches);
    this.media?.addEventListener?.('change', onMedia);
    this.destroyRef.onDestroy(() => this.media?.removeEventListener?.('change', onMedia));

    this.searchChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => this.applyState({ search }));

    // The component is reused across /inbox navigations (nav item, bell, renderer links), so follow the query string
    // whenever it no longer matches the page state; the page's own URL writes echo back equal and are ignored.
    // skip(1): the first emission is the snapshot read above.
    this.route.queryParamMap?.pipe(skip(1), takeUntilDestroyed(this.destroyRef)).subscribe((map) => {
      const params: Record<string, string> = {};
      for (const key of map.keys) params[key] = map.get(key) ?? '';
      const next = pageStateFromParams(params);
      if (sameParams(pageStateToParams(next), pageStateToParams(this.state()))) return;
      this.selectedIds.set(this.emptySelection);
      this.state.set(next);
      this.search.set(next.search);
      void this.loadForState();
    });

    // The URL is the source of truth for the selection, so back/forward and deep links work.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const source = params.get('source');
      const kind = params.get('kind');
      const id = params.get('id');
      const ref = source && kind && id ? { source, kind, id } : null;
      const current = this.store.selectedRef();
      if (ref ? !sameRef(ref, current) : current !== null) void this.store.select(ref);
    });
  }

  protected refOf(item: InboxItemDto): InboxItemRef {
    return { source: item.source, kind: item.kind, id: item.id };
  }

  protected meta(item: InboxItemDto) { return inboxTypeMeta(item, this.kinds.descriptor(item.source, item.kind)); }
  protected title(item: InboxItemDto): string { return inboxTitle(item); }
  protected subtitle(item: InboxItemDto): string { return inboxSubtitle(item); }
  protected status(item: InboxItemDto): string { return inboxStatusLabel(item); }
  protected tone(item: InboxItemDto): string { return inboxStatusTone(item); }
  protected sourceLabel(item: InboxItemDto): string {
    return this.sourceLabels().get(item.source) ?? item.source.charAt(0).toUpperCase() + item.source.slice(1);
  }

  protected menuFor(item: InboxItemDto): MenuItem[] {
    const detail = this.store.detail();
    return inboxMenuItems(item, !!detail?.target && sameRef(detail.item, item));
  }

  /** Opening or closing an item keeps the list's tab and filters (query string). */
  open(ref: InboxItemRef): void {
    void this.router.navigate(['/inbox', ref.source, ref.kind, ref.id], { queryParamsHandling: 'preserve' });
  }

  close(): void {
    this.drawerOpen.set(false);
    void this.router.navigate(['/inbox'], { queryParamsHandling: 'preserve' });
  }

  /** Hide/show the ticket details: a remembered preference on wide screens, a drawer on narrow ones. */
  protected toggleDetails(): void {
    if (this.narrow()) {
      this.drawerOpen.update((open) => !open);
      return;
    }
    const hidden = !this.detailsHidden();
    this.detailsHidden.set(hidden);
    try {
      localStorage.setItem(DETAILS_HIDDEN_KEY, hidden ? '1' : '0');
    } catch {
      // Storage can be unavailable (private mode); the panel still toggles for this visit.
    }
  }

  protected onSort(id: string): void {
    this.applyState({ sort: id as InboxSort });
  }

  protected onTab(value: string): void {
    this.selectedIds.set(this.emptySelection);
    this.applyState({ tab: value as InboxTab });
  }

  protected onDirection(value: string): void {
    this.applyState({ direction: value as InboxDirectionChoice });
  }

  protected closeSearch(): void {
    this.searchExpanded.set(false);
    if (this.search()) this.onSearch('');
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.searchChanges.next(value);
  }

  protected onFilterChanged(event: { key: string; values: string[] }): void {
    this.applyState({ filters: { ...this.state().filters, [event.key]: event.values } });
  }

  /** Updates the state, mirrors it in the URL (replacing the entry) and reloads what the tab shows. */
  private applyState(patch: Partial<InboxPageState>): void {
    this.state.update((s) => ({ ...s, ...patch }));
    void this.router.navigate([], { relativeTo: this.route, queryParams: pageStateToParams(this.state()), replaceUrl: true });
    void this.loadForState();
  }

  private loadForState(): Promise<void> {
    const state = this.state();
    if (state.tab === 'history') {
      return this.store.loadHistory({
        source: state.filters['source']?.[0] ?? null,
        kind: state.filters['kind']?.[0] ?? null,
        from: requestedOnFrom(state.filters['requestedOn']?.[0])
      });
    }
    return this.store.applyFilter(pageStateToQuery(state, this.auth.employeeId?.() ?? null));
  }

  // ---- History -----------------------------------------------------------------------------------

  protected canUndo(entry: InboxHistoryEntryDto): boolean {
    return entry.canRevert && !!entry.revertableUntil && new Date(entry.revertableUntil).getTime() > Date.now();
  }

  protected async undoFromHistory(entry: InboxHistoryEntryDto): Promise<void> {
    if (await this.store.revertFromHistory(entry)) this.notifications.success('Undone');
    else this.notifications.error(this.store.actionError() ?? 'The decision could not be undone.');
  }

  protected openHistory(entry: InboxHistoryEntryDto): void {
    if (entry.item) this.open({ source: entry.source, kind: entry.kind, id: entry.itemId });
  }

  // ---- Group by employee --------------------------------------------------------------------------

  protected toggleGroup(key: string): void {
    const next = new Set(this.collapsed());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.collapsed.set(next);
  }

  // ---- Bulk ---------------------------------------------------------------------------------------

  protected onRowSelection(event: { row: InboxItemDto; selected: boolean }): void {
    if (!this.isSelectable(event.row)) return;
    const next = new Set(this.selectedIds());
    if (event.selected) next.add(this.trackItem(event.row));
    else next.delete(this.trackItem(event.row));
    this.selectedIds.set(next);
  }

  protected onSelectAll(selected: boolean): void {
    this.selectedIds.set(selected ? new Set(this.store.items().filter(this.isSelectable).map(this.trackItem)) : this.emptySelection);
  }

  protected onBulkAction(key: string): void {
    const choice = this.bulkChoices().find((c) => c.key === key);
    if (!choice) return;
    if (choice.needsComment || choice.key === 'resolve') this.bulkPending.set(choice);
    else void this.runBulk(choice.key, null, null);
  }

  protected onBulkOutcome(choice: InboxOutcomeChoice): void {
    void this.runBulk('resolve', choice.comment, choice.outcome);
  }

  protected async runBulk(action: string, comment: string | null, outcome: string | null): Promise<void> {
    this.bulkPending.set(null);
    const items = this.selectedItems();
    const result = await this.store.runBulk({ action, items: items.map((i) => this.refOf(i)), comment, outcome });
    if (!result) {
      this.notifications.error(this.store.actionError() ?? 'The bulk action failed.');
      return;
    }
    this.selectedIds.set(this.emptySelection);
    if (result.failed.length === 0) {
      this.notifications.success(`${result.succeeded.length} done`);
      return;
    }
    const id = (ref: InboxItemRef) => `${ref.source}:${ref.kind}:${ref.id}`;
    this.bulkNames.set(new Map(items.map((i) => [this.trackItem(i), inboxTitle(i)])));
    this.bulkResult.set({
      items: [
        ...result.succeeded.map((ref) => ({ id: id(ref), outcome: 'succeeded' as const, reason: null })),
        ...result.failed.map((f) => ({ id: id(f.ref), outcome: 'failed' as const, reason: f.message }))
      ],
      succeeded: result.succeeded.length,
      pendingApproval: 0,
      failed: result.failed.length
    });
  }

  private isFiltered(): boolean {
    const q = this.store.query();
    const lists = [q.category, q.direction, q.project, q.source, q.type, q.status, q.requestedBy];
    return lists.some((l) => (l?.length ?? 0) > 0) || !!q.search?.trim() || !!q.from
      || Object.values(q.facets ?? {}).some((v) => v.length > 0);
  }

  protected onRowMenu(item: InboxItemDto, id: string): void {
    const ref = this.refOf(item);
    if (id === 'view') this.open(ref);
    else if (id === 'open' && this.store.detail()?.target) this.openTarget(this.store.detail()!.target!);
    else if (id === 'copy') void this.copyLink(ref);
    else if (id.startsWith('action:')) void this.runAction(ref, id.slice('action:'.length), {});
  }

  protected onCardAction(event: InboxCardAction): void {
    const ref = this.store.selectedRef();
    if (ref) void this.runAction(ref, event.key, event.body);
  }

  async runAction(ref: InboxItemRef, key: string, body: InboxCardAction['body']): Promise<boolean> {
    this.busyRowId.set(`${ref.source}:${ref.kind}:${ref.id}`);
    const ok = await this.store.runAction(ref, key, body);
    this.busyRowId.set(null);
    if (ok) this.notifications.success('Done');
    else this.notifications.error(this.store.actionError() ?? 'The action failed.');
    return ok;
  }

  openTarget(target: InboxTargetDto): void {
    void this.router.navigate(target.route, { queryParams: target.queryParams ?? undefined });
  }

  private async copyLink(ref: InboxItemRef): Promise<void> {
    const url = `${location.origin}/inbox/${ref.source}/${ref.kind}/${ref.id}`;
    try {
      await navigator.clipboard.writeText(url);
      this.notifications.success('Link copied');
    } catch {
      this.notifications.error('Could not copy the link.');
    }
  }
}
