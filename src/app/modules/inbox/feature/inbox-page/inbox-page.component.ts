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
import { TabOption } from '../../../../shared/ui/tabs/tabs.component';
import { TaskAssigneeAvatarFilterComponent, TaskAssigneeAvatarMember } from '../../../work/ui/task-assignee-avatar-filter/task-assignee-avatar-filter.component';
import { InboxCapability, InboxHistoryEntryDto, InboxItemDto, InboxItemRef, InboxTargetDto, sameRef } from '../../models/inbox.dto';
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

const COLUMNS: readonly DataTableColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'project', label: 'Project', width: '15%' },
  { key: 'type', label: 'Type', width: '140px' },
  { key: 'requestedBy', label: 'Requested by', width: '17%' },
  { key: 'requestedTo', label: 'Requested to', width: '15%' },
  { key: 'status', label: 'Status', width: '104px' },
  { key: 'actions', label: 'Actions', width: '52px', interactive: true, align: 'end', hideLabel: true }
];

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

/** Every request and alert involving the user, across projects and modules, with the selected item's card. */
@Component({
  selector: 'app-inbox-page',
  standalone: true,
  imports: [
    DatePipe, AvatarComponent, BulkActionBarComponent, BulkActionResultModalComponent, DataTableComponent, DataTableCellDirective,
    DropdownMenuComponent, FilterBarComponent, BreadcrumbHeaderComponent, ApprovalDelegateModalComponent, ConversationPanelComponent,
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
        <nav class="inbox__tabs" role="tablist" aria-label="Category">
          @for (tab of tabs(); track tab.value) {
            <button type="button" role="tab" class="inbox__tab" [class.inbox__tab--active]="tab.value === state().tab"
              [attr.aria-selected]="tab.value === state().tab" [attr.data-testid]="'inbox-tab-' + tab.value" (click)="onTab(tab.value)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                @switch (tab.value) {
                  @case ('all') { <path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /> }
                  @case ('request') { <rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><path d="m9 14 2 2 4-4" /> }
                  @case ('alert') { <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /> }
                  @case ('history') { <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /> }
                }
              </svg>
              {{ tab.label }}
            </button>
          }
        </nav>
      </header>

      @if (state().tab !== 'history') {
        <div class="inbox__toolbar-row">
          <div class="inbox__segment" role="radiogroup" aria-label="Direction">
            @for (option of directionOptions; track option.value) {
              <button type="button" role="radio" class="inbox__segment-btn" [class.inbox__segment-btn--active]="state().direction === option.value"
                [attr.aria-checked]="state().direction === option.value" [attr.data-testid]="'inbox-direction-' + option.value"
                (click)="onDirection(option.value)">{{ option.label }}</button>
            }
          </div>
        </div>
      }

      <div class="inbox__body" [class.inbox__body--with-card]="store.selectedRef() !== null">
        <div class="inbox__main">
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
                          <span class="inbox__title-text">
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
              [columns]="columns"
              [rows]="store.items()"
              [trackBy]="trackItem"
              [rowTestId]="rowTestId"
              [activeRowId]="activeRowId()"
              [activeRowAppearance]="'solid'"
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
              <ng-template appDataTableCell="title" let-item>
                <div class="inbox__title-cell">
                  <app-inbox-type-icon [icon]="meta(item).icon" [tone]="meta(item).tone" />
                  <div class="inbox__title-text">
                    <span class="inbox__title">
                      <span class="inbox__ellipsis">{{ title(item) }}</span>
                      @if (item.unreadMessages > 0) {
                        <span class="inbox__unread" data-testid="inbox-row-unread" [attr.aria-label]="item.unreadMessages + ' unread messages'"></span>
                      }
                    </span>
                    <span class="inbox__secondary inbox__ellipsis">{{ subtitle(item) }}</span>
                  </div>
                </div>
              </ng-template>
              <ng-template appDataTableCell="project" let-item>
                <span class="inbox__ellipsis">{{ item.contextName ?? '—' }}</span>
              </ng-template>
              <ng-template appDataTableCell="type" let-item>
                <span [class]="'inbox__pill inbox__pill--' + meta(item).tone">{{ meta(item).label }}</span>
              </ng-template>
              <ng-template appDataTableCell="requestedBy" let-item>
                @if (item.requestedBy) {
                  <span class="inbox__person">
                    <app-avatar [userName]="item.requestedBy.name" size="sm" />
                    <span class="inbox__person-text">
                      <span class="inbox__ellipsis">{{ item.requestedBy.name }}</span>
                      <span class="inbox__secondary inbox__ellipsis">{{ item.createdAt | date: 'MMM d, y · h:mm a' }}</span>
                    </span>
                  </span>
                } @else {
                  <span class="inbox__secondary">{{ item.createdAt | date: 'MMM d, y · h:mm a' }}</span>
                }
              </ng-template>
              <ng-template appDataTableCell="requestedTo" let-item>
                @if (item.requestedTo) {
                  <span class="inbox__person">
                    <app-avatar [userName]="item.requestedTo.name" size="sm" />
                    <span class="inbox__ellipsis">{{ item.requestedTo.name }}</span>
                  </span>
                } @else {
                  <span class="inbox__secondary">—</span>
                }
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

        @if (store.selectedRef() !== null) {
          <div class="inbox__scrim" aria-hidden="true" (click)="close()"></div>
          <div class="inbox__card">
            <app-inbox-item-card
              #card
              [detail]="store.detail()"
              [loading]="store.detailLoading()"
              [error]="store.detailError()"
              [busy]="store.busy()"
              [actionError]="store.actionError()"
              [actionErrorInline]="store.actionErrorInline()"
              [descriptor]="store.detail() ? kinds.descriptor(store.detail()!.item.source, store.detail()!.item.kind) : null"
              (closed)="close()"
              (action)="onCardAction($event)"
              (openTarget)="openTarget($event)"
            >
              <!-- Shown even when the detail fails: the chat has its own access check and error. -->
              @if (!store.detailLoading() || store.detail()) {
                <app-conversation-panel
                  inboxConversation
                  [itemRef]="store.selectedRef()!"
                  [actions]="store.detail()?.item?.availableActions ?? []"
                  [requesterId]="store.detail()?.item?.requestedBy?.id ?? null"
                  (action)="card.runAction($event)"
                />
              }
            </app-inbox-item-card>
          </div>
        }
      </div>

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
    </div>
  `,
  styles: [`
    :host { display: block; }
    .inbox { display: flex; flex-direction: column; gap: 8px; }
    /* Same sticky header as Work (global .work-page-header); the tab bar sits on its bottom border like the project sub-menu. */
    .inbox__page-header { padding-bottom: 0 !important; margin-bottom: 0 !important; }
    .inbox__header-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; width: 100%; min-height: 36px; margin-bottom: 0.375rem; }
    .inbox__header-row app-breadcrumb-header { display: inline-flex; flex-shrink: 0; align-items: center; }
    .inbox__tabs { display: flex; width: 100%; gap: 4px; overflow-x: auto; scrollbar-width: none; }
    .inbox__tabs::-webkit-scrollbar { display: none; }
    .inbox__tab { display: flex; align-items: center; gap: 6px; margin-bottom: -1px; padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--color-text-secondary); font: inherit; font-size: 14px; line-height: 20px; white-space: nowrap; cursor: pointer; transition: color 150ms ease; }
    .inbox__tab:hover { color: var(--color-text-primary); }
    .inbox__tab:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: -2px; }
    .inbox__tab--active { border-bottom-color: var(--color-focus-ring); color: var(--color-text-primary); font-weight: 600; }
    .inbox__header-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
    .inbox__icon-btn { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-secondary); cursor: pointer; }
    .inbox__icon-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
    .inbox__icon-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
    .inbox__icon-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .inbox__search-close { display: inline-flex; width: 20px; height: 20px; flex: 0 0 auto; align-items: center; justify-content: center; border: 0; border-radius: 4px; background: none; color: var(--color-text-secondary); font: inherit; font-size: 16px; line-height: 1; cursor: pointer; }
    .inbox__search-close:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .inbox__toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .inbox__segment { display: inline-flex; box-sizing: border-box; height: 30px; align-items: center; padding: 2px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-secondary); }
    .inbox__segment-btn { height: 24px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .inbox__segment-btn--active { background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
    .inbox__segment-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .inbox__search { display: inline-flex; width: 320px; max-width: 100%; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
    .inbox__search:focus-within { border-color: var(--color-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent) 18%, transparent); }
    .inbox__search svg { width: 15px; height: 15px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 2; stroke-linecap: round; }
    .inbox__search input { width: 100%; min-width: 0; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; outline: none; }
    .inbox__body { display: grid; grid-template-columns: minmax(0, 1fr); align-items: start; gap: 16px; }
    .inbox__body--with-card { grid-template-columns: minmax(0, 1fr) 26rem; }
    .inbox__main { display: flex; min-width: 0; flex-direction: column; gap: 12px; }
    .inbox__card { position: sticky; top: 16px; height: calc(100vh - 140px); min-height: 420px; min-width: 0; }
    .inbox__scrim { display: none; }
    .inbox__state { display: flex; align-items: center; gap: 8px; margin: 0; padding: 24px 0; color: var(--color-text-secondary); font-size: 13px; }
    .inbox__state--error { color: var(--color-danger); }
    .inbox__state button { padding: 0; border: 0; background: none; color: var(--color-accent); font: inherit; font-weight: 650; text-decoration: underline; cursor: pointer; }
    .inbox__title-cell { display: flex; min-width: 0; align-items: center; gap: 11px; }
    .inbox__title-text, .inbox__person-text { display: flex; min-width: 0; flex-direction: column; }
    .inbox__title { display: flex; min-width: 0; align-items: center; gap: 8px; font-weight: 600; }
    .inbox__unread { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 999px; background: var(--color-accent); }
    .inbox__ellipsis { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .inbox__secondary { color: var(--color-text-secondary); font-size: 12px; }
    .inbox__person { display: flex; min-width: 0; align-items: center; gap: 8px; }
    .inbox__person app-avatar { flex: 0 0 auto; }
    .inbox__pill { --tone: var(--color-accent); display: inline-block; max-width: 100%; overflow: hidden; padding: 3px 10px; border-radius: 999px; background: color-mix(in srgb, var(--tone) 12%, transparent); color: var(--tone); font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .inbox__pill--neutral { --tone: var(--color-text-secondary); }
    .inbox__pill--warning { --tone: var(--color-warning, #d97706); }
    .inbox__pill--danger { --tone: var(--color-danger); }
    .inbox__kebab { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 0; border-radius: 8px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
    .inbox__kebab:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .inbox__kebab svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .inbox__pager { display: flex; align-items: center; justify-content: flex-end; gap: 12px; color: var(--color-text-secondary); font-size: 12px; }
    .inbox__pager button { padding: 5px 10px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; cursor: pointer; }
    .inbox__pager button:disabled { opacity: .5; cursor: default; }
    .inbox__tool-btn { height: 30px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
    .inbox__tool-btn:hover { border-color: var(--color-accent); }
    .inbox__tool-btn[aria-pressed="true"] { border-color: var(--color-accent); color: var(--color-accent); }
    .inbox__tool-btn:focus-visible, .inbox__chip:focus-visible, .inbox__group-header:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; }
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
    .inbox__group-row .inbox__title-text { flex: 1; }
    :host ::ng-deep tr.data-table__row--active-solid .inbox__secondary { color: color-mix(in srgb, var(--color-accent-contrast, #fff) 80%, transparent); }
    :host ::ng-deep tr.data-table__row--active-solid .inbox__pill { background: color-mix(in srgb, var(--color-accent-contrast, #fff) 20%, transparent); color: var(--color-accent-contrast, #fff); }
    :host ::ng-deep tr.data-table__row--active-solid .inbox__unread { background: var(--color-accent-contrast, #fff); }
    :host ::ng-deep tr.data-table__row--active-solid .inbox__kebab { color: var(--color-accent-contrast, #fff); }
    /* Narrow screens: the card covers the page, with a close (back) button in its header. */
    @media (max-width: 1023px) {
      .inbox__body--with-card { grid-template-columns: minmax(0, 1fr); }
      .inbox__scrim { position: fixed; inset: 0; z-index: 1000; display: block; background: color-mix(in srgb, var(--color-text-primary) 35%, transparent); }
      .inbox__card { position: fixed; inset: 0; z-index: 1001; width: 100vw; height: auto; min-height: 0; padding: 8px; }
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

  protected readonly columns = COLUMNS;
  protected readonly directionOptions = DIRECTION_OPTIONS;
  protected readonly trackItem = (item: InboxItemDto): string => `${item.source}:${item.kind}:${item.id}`;
  protected readonly rowTestId = (): string => 'inbox-row';
  /** Only kinds that declare Bulk can be bulk-selected. */
  protected readonly isSelectable = (item: InboxItemDto): boolean => this.kinds.has(item.source, item.kind, InboxCapability.Bulk);
  protected readonly emptySelection: ReadonlySet<string> = new Set<string>();
  protected readonly canDelegate = inject(PermissionService).hasPermission(LEAVE_APPROVE);

  /** Tab, direction, search and filters - mirrored in the URL query string. */
  protected readonly state = signal<InboxPageState>({ tab: 'all', direction: 'all', search: '', filters: {} });
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

  protected menuFor(item: InboxItemDto): MenuItem[] {
    const detail = this.store.detail();
    return inboxMenuItems(item, !!detail?.target && sameRef(detail.item, item));
  }

  /** Opening or closing an item keeps the list's tab and filters (query string). */
  open(ref: InboxItemRef): void {
    void this.router.navigate(['/inbox', ref.source, ref.kind, ref.id], { queryParamsHandling: 'preserve' });
  }

  close(): void {
    void this.router.navigate(['/inbox'], { queryParamsHandling: 'preserve' });
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
