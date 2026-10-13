import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { FilterBarComponent } from '../../../../shared/ui/filter-bar/filter-bar.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { TabOption, TabsComponent } from '../../../../shared/ui/tabs/tabs.component';
import { InboxCategory, InboxDirection, InboxItemDto, InboxItemRef, InboxQuery, InboxTargetDto, sameRef } from '../../models/inbox.dto';
import { InboxStore } from '../../state/inbox.store';
import { ConversationPanelComponent } from '../../ui/conversation-panel/conversation-panel.component';
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

const COLUMNS: readonly DataTableColumn[] = [
  { key: 'title', label: 'Title' },
  { key: 'project', label: 'Project', width: '15%' },
  { key: 'type', label: 'Type', width: '140px' },
  { key: 'requestedBy', label: 'Requested by', width: '17%' },
  { key: 'requestedTo', label: 'Requested to', width: '15%' },
  { key: 'status', label: 'Status', width: '104px' },
  { key: 'actions', label: 'Actions', width: '52px', interactive: true, align: 'end', hideLabel: true }
];

const CATEGORY_TABS: readonly TabOption[] = [
  { value: 'all', label: 'All' }, { value: 'request', label: 'Requests' }, { value: 'alert', label: 'Alerts' }
];

const DIRECTION_OPTIONS: readonly TabOption[] = [
  { value: 'all', label: 'All' }, { value: 'received', label: 'Received' }, { value: 'sent', label: 'Sent' }
];

/** Filter-bar keys that map straight onto InboxQuery fields; anything else is a source-specific facet. */
const QUERY_KEYS = new Set(['project', 'source', 'type', 'status', 'requestedBy']);

/** Every request and alert involving the user, across projects and modules, with the selected item's card. */
@Component({
  selector: 'app-inbox-page',
  standalone: true,
  imports: [
    DatePipe, AvatarComponent, DataTableComponent, DataTableCellDirective, DropdownMenuComponent, FilterBarComponent,
    PageHeaderComponent, TabsComponent, ConversationPanelComponent, InboxItemCardComponent, InboxTypeIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inbox">
      <app-page-header title="Inbox" subtitle="Requests and alerts that involve you, across every project." />

      <div class="inbox__toolbar">
        <app-tabs class="inbox__tabs" ariaLabel="Category" [tabs]="categoryTabs" [value]="category()" (valueChange)="onCategory($event)" />
        <div class="inbox__toolbar-row">
          <div class="inbox__segment" role="radiogroup" aria-label="Direction">
            @for (option of directionOptions; track option.value) {
              <button type="button" role="radio" class="inbox__segment-btn" [class.inbox__segment-btn--active]="direction() === option.value"
                [attr.aria-checked]="direction() === option.value" [attr.data-testid]="'inbox-direction-' + option.value"
                (click)="onDirection(option.value)">{{ option.label }}</button>
            }
          </div>
          <app-filter-bar [fields]="filterFields()" [values]="filterValues()" (fieldChanged)="onFilterChanged($event)" />
          <label class="inbox__search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Search" aria-label="Search the inbox" data-testid="inbox-search"
              [value]="search()" (input)="onSearch($any($event.target).value)" />
          </label>
        </div>
      </div>

      <div class="inbox__body" [class.inbox__body--with-card]="store.selectedRef() !== null">
        <div class="inbox__main">
          @if (store.loading() && store.items().length === 0) {
            <p class="inbox__state" aria-live="polite" data-testid="inbox-loading">Loading your inbox…</p>
          } @else if (store.error() && store.items().length === 0) {
            <div class="inbox__state inbox__state--error" role="alert" data-testid="inbox-error">
              <span>{{ store.error() }}</span>
              <button type="button" (click)="store.load()">Try again</button>
            </div>
          } @else {
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
                  (action)="card.runAction($event)"
                />
              }
            </app-inbox-item-card>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .inbox { display: flex; flex-direction: column; gap: 12px; }
    .inbox__toolbar { display: flex; flex-direction: column; gap: 12px; }
    .inbox__toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .inbox__segment { display: inline-flex; padding: 2px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface-secondary); }
    .inbox__segment-btn { padding: 5px 12px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .inbox__segment-btn--active { background: var(--color-surface); color: var(--color-text-primary); box-shadow: 0 1px 2px rgb(0 0 0 / .08); }
    .inbox__segment-btn:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .inbox__search { display: inline-flex; flex: 1 1 200px; max-width: 320px; margin-left: auto; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); }
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
    :host ::ng-deep tr.data-table__row--active-solid .inbox__secondary { color: color-mix(in srgb, var(--color-accent-contrast, #fff) 80%, transparent); }
    :host ::ng-deep tr.data-table__row--active-solid .inbox__pill { background: color-mix(in srgb, var(--color-accent-contrast, #fff) 20%, transparent); color: var(--color-accent-contrast, #fff); }
    :host ::ng-deep tr.data-table__row--active-solid .inbox__unread { background: var(--color-accent-contrast, #fff); }
    :host ::ng-deep tr.data-table__row--active-solid .inbox__kebab { color: var(--color-accent-contrast, #fff); }
    /* Narrow screens: the card covers the page, with a close (back) button in its header. */
    @media (max-width: 1023px) {
      .inbox__body--with-card { grid-template-columns: minmax(0, 1fr); }
      .inbox__scrim { position: fixed; inset: 0; z-index: 1000; display: block; background: color-mix(in srgb, var(--color-text-primary) 35%, transparent); }
      .inbox__card { position: fixed; inset: 0; z-index: 1001; width: 100vw; height: auto; min-height: 0; padding: 8px; }
      .inbox__search { max-width: none; margin-left: 0; }
    }
  `]
})
export class InboxPageComponent implements OnInit {
  protected readonly store = inject(InboxStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly card = viewChild<InboxItemCardComponent>('card');

  protected readonly columns = COLUMNS;
  protected readonly categoryTabs = CATEGORY_TABS;
  protected readonly directionOptions = DIRECTION_OPTIONS;
  protected readonly trackItem = (item: InboxItemDto): string => `${item.source}:${item.kind}:${item.id}`;
  protected readonly rowTestId = (): string => 'inbox-row';

  protected readonly category = signal<'all' | InboxCategory>('all');
  protected readonly direction = signal<'all' | InboxDirection>('all');
  protected readonly filterValues = signal<Record<string, string[]>>({ requestedOn: ['any'] });
  protected readonly search = signal('');
  protected readonly busyRowId = signal<string | null>(null);
  private readonly searchChanges = new Subject<string>();

  protected readonly filterFields = computed(() => toFilterFields(this.store.filterFields()));
  protected readonly activeRowId = computed(() => {
    const ref = this.store.selectedRef();
    return ref ? `${ref.source}:${ref.kind}:${ref.id}` : null;
  });
  protected readonly page = computed(() => this.store.query().page ?? 1);
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.store.total() / (this.store.query().pageSize ?? 25))));
  protected readonly emptyMessage = computed(() => this.isFiltered()
    ? 'Nothing matches these filters.'
    : 'Nothing here yet. Requests and alerts that involve you will show up here.');

  ngOnInit(): void {
    void this.store.load();
    void this.store.loadFilters();
    void this.store.loadCounts();

    this.searchChanges.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe((search) => void this.store.applyFilter({ search }));

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

  protected meta(item: InboxItemDto) { return inboxTypeMeta(item); }
  protected title(item: InboxItemDto): string { return inboxTitle(item); }
  protected subtitle(item: InboxItemDto): string { return inboxSubtitle(item); }
  protected status(item: InboxItemDto): string { return inboxStatusLabel(item); }
  protected tone(item: InboxItemDto): string { return inboxStatusTone(item); }

  protected menuFor(item: InboxItemDto): MenuItem[] {
    const detail = this.store.detail();
    return inboxMenuItems(item, !!detail?.target && sameRef(detail.item, item));
  }

  open(ref: InboxItemRef): void {
    void this.router.navigate(['/inbox', ref.source, ref.kind, ref.id]);
  }

  close(): void {
    void this.router.navigate(['/inbox']);
  }

  protected onCategory(value: string): void {
    this.category.set(value as 'all' | InboxCategory);
    void this.store.applyFilter({ category: value === 'all' ? [] : [value as InboxCategory] });
  }

  protected onDirection(value: string): void {
    this.direction.set(value as 'all' | InboxDirection);
    void this.store.applyFilter({ direction: value === 'all' ? [] : [value as InboxDirection] });
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.searchChanges.next(value);
  }

  protected onFilterChanged(event: { key: string; values: string[] }): void {
    this.filterValues.update((v) => ({ ...v, [event.key]: event.values }));
    void this.store.applyFilter(this.toQuery(this.filterValues()));
  }

  /** Filter-bar values → the query: known keys map to fields, "Requested on" to a date, the rest to facets. */
  private toQuery(values: Record<string, string[]>): Partial<InboxQuery> {
    const query: Partial<InboxQuery> = { project: [], source: [], type: [], status: [], requestedBy: [] };
    const facets: Record<string, string[]> = {};
    for (const [key, selected] of Object.entries(values)) {
      if (key === 'requestedOn') continue;
      if (QUERY_KEYS.has(key)) (query as Record<string, string[]>)[key] = selected;
      else if (selected.length > 0) facets[key] = selected;
    }
    return { ...query, facets, from: requestedOnFrom(values['requestedOn']?.[0]) };
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
