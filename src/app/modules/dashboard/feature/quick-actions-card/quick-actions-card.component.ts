import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  afterNextRender,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { canAccessNavItem } from '../../../../layouts/main-layout/nav/nav-access';
import { NAV_ITEMS } from '../../../../layouts/main-layout/nav/nav-items.config';
import { TimeTrackingStore } from '../../../attendance/state/time-tracking.store';
import { NewLeaveRequestHostComponent } from '../../../leave/ui/new-leave-request-host/new-leave-request-host.component';
import { PinnedSize } from '../../ui/dashboard-grid/dashboard-grid.component';

/** Icon tint of a tile (the CSS maps each tone to its accent colour). */
export type QuickActionTone = 'emerald' | 'blue' | 'slate';

/**
 * One tile. The card builds its list from these, in display order, so a later customization step can
 * filter or reorder them without touching the template. Each tile is a router link or a button.
 */
export interface QuickAction {
  id: string;
  label: string;
  /** SVG path data on a 24x24 stroked icon. */
  iconPaths: readonly string[];
  tone: QuickActionTone;
  route?: string;
  run?: () => void;
  disabled?: boolean;
  busy?: boolean;
  /** Label shown while busy. */
  busyLabel?: string;
}

const ICONS = {
  breakCup: ['M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3'],
  home: ['M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10'],
  team: [
    'M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
  ],
  timeOff: ['M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v6M3 6a2 2 0 012-2M3 6v13a2 2 0 002 2h7', 'M18 15v6M15 18h6']
} as const;

/**
 * The Quick Actions card, shared by My Work and My Team. The dashboard grid pins it to its top-right corner
 * (never dragged, resized or removed) and sizes that corner from naturalSize: as wide as the tiles in one
 * row, as tall as the content. The tiles then stretch to fill the corner exactly. Where the grid is too narrow the tiles wrap and the corner grows taller.
 */
@Component({
  selector: 'app-quick-actions-card',
  standalone: true,
  imports: [RouterLink, NgTemplateOutlet, NewLeaveRequestHostComponent],
  host: { class: 'block h-full' },
  templateUrl: './quick-actions-card.component.html',
  styleUrl: './quick-actions-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionsCardComponent implements OnInit {
  private readonly store = inject(TimeTrackingStore);
  private readonly permissions = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');
  private readonly list = viewChild.required<ElementRef<HTMLElement>>('list');

  /** Which dashboard the card sits on: the second action links to the other one - My Team on the
   * personal dashboard, My Work on the My Team dashboard. */
  readonly onTeamDashboard = input(false);

  /** The card's natural size, re-measured whenever its content or width changes. */
  readonly naturalSize = output<PinnedSize>();

  protected readonly today = this.store.today;
  protected readonly actionLoading = this.store.actionLoading;
  protected readonly activeAction = this.store.activeAction;

  /** Request Time Off shows to viewers who can open Time Off, by the same rule as the sidebar (nav-items.config):
   * the leave module is on and they can read their own leave. Unlike Settings, that is every ordinary employee. */
  protected readonly canRequestTimeOff = computed(() => this.canOpen('time-off'));

  /** The New Leave Request popup, opened from the tile in place. */
  protected readonly leaveRequestOpen = signal(false);

  protected readonly onBreak = computed(() => this.today()?.canEndBreak ?? false);
  protected readonly breakDisabled = computed(() => {
    const today = this.today();
    if (!today) return true;
    return !today.canStartBreak && !today.canEndBreak;
  });

  protected readonly breakLabel = computed(() => (this.onBreak() ? 'End Break' : 'Start Break'));
  protected readonly breakBusy = computed(
    () => this.actionLoading() && (this.activeAction() === 'startBreak' || this.activeAction() === 'endBreak')
  );

  /** The tiles to show, in order: Break, the switch to the other dashboard, then Request Time Off. */
  protected readonly actions = computed<QuickAction[]>(() => {
    const team = this.onTeamDashboard();
    const actions: QuickAction[] = [
      {
        id: 'break',
        label: this.breakLabel(),
        iconPaths: ICONS.breakCup,
        tone: 'emerald',
        run: () => this.toggleBreak(),
        disabled: this.breakDisabled(),
        busy: this.breakBusy(),
        busyLabel: 'Working…'
      },
      team
        ? { id: 'my-work', label: 'My Work', iconPaths: ICONS.home, tone: 'blue', route: '/dashboard' }
        : { id: 'my-team', label: 'My Team', iconPaths: ICONS.team, tone: 'blue', route: '/dashboard/my-team' }
    ];
    if (this.canRequestTimeOff()) {
      actions.push({
        id: 'time-off',
        label: 'Time Off',
        iconPaths: ICONS.timeOff,
        tone: 'slate',
        run: () => this.leaveRequestOpen.set(true)
      });
    }
    return actions;
  });

  constructor() {
    // Re-measure when the tiles change (permissions, break state) and when the card's width changes (wrapping).
    afterRenderEffect(() => {
      this.actions();
      untracked(() => this.measure());
    });
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.measure());
      observer.observe(this.content().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  ngOnInit(): void {
    void this.store.loadToday();
  }

  /**
   * Width: padding plus every tile at its minimum width in one row (tiles stretch to fill the corner, so their
   * drawn width can't be used). Height: padding plus the content at the current width.
   */
  private measure(): void {
    const card = this.card().nativeElement;
    const style = getComputedStyle(card);
    const px = (v: string) => parseFloat(v) || 0;
    const frameX = px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth);
    const frameY = px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth);
    const list = this.list().nativeElement;
    const tiles = Array.from(list.children) as HTMLElement[];
    const gap = px(getComputedStyle(list).columnGap);
    const row = tiles.reduce((sum, t) => sum + px(getComputedStyle(t).minWidth), 0) + gap * Math.max(0, tiles.length - 1);
    const width = Math.ceil(frameX + row);
    const height = Math.ceil(frameY + this.content().nativeElement.offsetHeight);
    if (width > 0 && height > 0) this.naturalSize.emit({ width, height });
  }

  private canOpen(navId: string): boolean {
    const item = NAV_ITEMS.find((nav) => nav.id === navId);
    return !!item && canAccessNavItem(item, this.permissions);
  }

  protected toggleBreak(): void {
    if (this.actionLoading()) return;
    if (this.onBreak()) {
      void this.store.endBreak();
    } else if (this.today()?.canStartBreak) {
      void this.store.startBreak();
    }
  }
}
