import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardLayoutApiService } from '../data-access/dashboard-layout-api.service';
import { clampSize, pack, readingOrder } from '../grid/grid-math';
import {
  AvailableWidget,
  BootstrapWidget,
  Breakpoint,
  DashboardBootstrap,
  DashboardKey,
  GridRect,
  readLayoutProblem
} from '../models/dashboard-layout.model';
import { HIDDEN_WIDGET_KEYS } from '../widgets/widget-registry';

const CONFLICT_MESSAGE = 'Your dashboard changed in another tab or device — reloaded.';
const SET_MISMATCH_MESSAGE = 'Your available widgets changed — reloaded.';
const LAYOUT_SET_MISMATCH = 'LAYOUT_SET_MISMATCH';

/** Plain-language reasons for the backend's machine-readable layout error codes. */
const CODE_REASONS: Record<string, string | undefined> = {
  OVERLAP: 'some widgets overlap',
  SIZE_NOT_ALLOWED: "a widget has a size that isn't allowed",
  OUT_OF_BOUNDS: 'a widget is outside the grid',
  UNKNOWN_WIDGET: 'a widget is no longer available',
  DUPLICATE_WIDGET: 'a widget appears more than once',
  WIDGET_ALREADY_PLACED: 'that widget is already on your dashboard'
};
const NEW_PREFIX = 'new:';

interface Item {
  id: string;
  rect: GridRect;
  widget: BootstrapWidget;
}

const toItems = (widgets: BootstrapWidget[]): Item[] => widgets.map(w => ({ id: w.instanceId, rect: w.layout, widget: w }));
const fromItems = (items: Item[]): BootstrapWidget[] => items.map(i => ({ ...i.widget, layout: i.rect }));
const sameRect = (a: GridRect, b: GridRect): boolean => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
const isHidden = (i: Item): boolean => HIDDEN_WIDGET_KEYS.has(i.widget.widgetKey);

/**
 * The draft's packing order: the widgets the grid shows in reading order, then the hidden ones, so an index the grid
 * reports among its visible widgets is the same index here.
 */
const packingOrder = (items: Item[]): Item[] => [...readingOrder(items.filter(i => !isHidden(i))), ...readingOrder(items.filter(isHidden))];

/** Packs in the given order (home-screen style) and returns the items in the draft's original order. */
function packKeepingOrder(draftOrder: Item[], order: Item[], cols: number): Item[] {
  const byId = new Map(pack(order, cols).map(i => [i.id, i]));
  return draftOrder.map(i => byId.get(i.id) as Item);
}

/**
 * State for one dashboard page. Edits happen on a local draft (no API calls); Save replays the difference against the
 * server (deletes, adds, one layout PUT) and re-bootstraps. Provide it on the page component, not in root.
 */
@Injectable()
export class DashboardStore {
  private readonly api = inject(DashboardLayoutApiService);
  private readonly notifications = inject(NotificationService);

  private dashboardId: string | null = null;
  private currentBreakpoint: Breakpoint = 'desktop';
  private refreshSeq = 0;
  /** The bootstrap the current draft was started from (breakpoint, base version, saved set); null when not editing. */
  private editBase: DashboardBootstrap | null = null;
  /** A refresh was skipped (or its result discarded) while editing; re-bootstrap once editing ends. */
  private staleWhileEditing = false;

  readonly bootstrap = signal<DashboardBootstrap | null>(null);
  readonly editing = signal(false);
  readonly draft = signal<BootstrapWidget[]>([]);
  readonly serverAvailable = signal<AvailableWidget[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** The draft while editing, otherwise the saved widgets. */
  readonly widgets = computed<BootstrapWidget[]>(() => (this.editing() ? this.draft() : (this.bootstrap()?.widgets ?? [])));

  /** The widgets the grid renders: hidden catalog widgets are left out. */
  readonly visibleWidgets = computed<BootstrapWidget[]>(() => this.widgets().filter(w => !HIDDEN_WIDGET_KEYS.has(w.widgetKey)));

  /** Catalog entries not currently on the board (placed ones removed in the draft count as available again). */
  readonly available = computed<AvailableWidget[]>(() => {
    const onBoard = new Set(this.widgets().map(w => w.widgetKey));
    return this.serverAvailable().filter(a => !onBoard.has(a.key) && !HIDDEN_WIDGET_KEYS.has(a.key));
  });

  async load(key: DashboardKey): Promise<void> {
    if (this.editing()) {
      // Never replace the bootstrap a draft is based on; reload once editing ends.
      this.staleWhileEditing = true;
      return;
    }
    this.error.set(null);
    try {
      const summaries = await firstValueFrom(this.api.listMine());
      const found = summaries.find(s => s.key === key);
      if (!found) {
        throw new Error(`Dashboard '${key}' not found.`);
      }
      this.dashboardId = found.id;
      await this.refresh();
    } catch (err) {
      this.fail(err, 'Could not load the dashboard.');
    }
  }

  /** Fed by the shell. Re-bootstraps when not editing; while editing the current draft is kept. */
  async setBreakpoint(bp: Breakpoint): Promise<void> {
    if (bp === this.currentBreakpoint) {
      return;
    }
    this.currentBreakpoint = bp;
    if (this.dashboardId && !this.editing()) {
      try {
        await this.refresh();
      } catch (err) {
        this.fail(err, 'Could not load the dashboard.');
      }
    }
  }

  startEditing(): void {
    const boot = this.bootstrap();
    if (!boot || this.editing()) return;
    this.editBase = boot;
    // Customizing works like a phone's home screen: the widgets settle into packed order straight away.
    const items = toItems(boot.widgets.map(w => ({ ...w, layout: { ...w.layout } })));
    this.draft.set(fromItems(packKeepingOrder(items, packingOrder(items), boot.grid.columns)));
    this.error.set(null);
    this.editing.set(true);
  }

  async cancel(): Promise<void> {
    this.exitEditing();
    await this.reloadIfBreakpointStale();
  }

  add(key: string): void {
    const def = this.serverAvailable().find(a => a.key === key);
    const boot = this.editBase;
    if (!this.editing() || this.saving() || !def || !boot || this.draft().some(w => w.widgetKey === key)) return;
    const cols = boot.grid.columns;
    const base = clampSize({ x: 0, y: 0, w: def.defaultW, h: def.defaultH }, def.size, cols);
    const added: BootstrapWidget = {
      instanceId: NEW_PREFIX + key,
      widgetKey: key,
      title: def.title,
      layout: base,
      size: def.size,
      dataState: { status: 'client', fetchedAt: null, error: null },
      data: null
    };
    // A new widget joins the end of the order, after every widget already shown.
    const items = toItems(this.draft());
    const order = packingOrder(items);
    const firstHidden = order.findIndex(isHidden);
    const addedItem = toItems([added])[0];
    order.splice(firstHidden < 0 ? order.length : firstHidden, 0, addedItem);
    this.draft.set(fromItems(packKeepingOrder([...items, addedItem], order, cols)));
  }

  remove(instanceId: string): void {
    if (!this.editing() || this.saving()) return;
    const boot = this.editBase;
    const items = toItems(this.draft().filter(w => w.instanceId !== instanceId));
    // The rest close the gap, in order.
    this.draft.set(fromItems(boot ? packKeepingOrder(items, packingOrder(items), boot.grid.columns) : items));
  }

  /** Moves a widget to position `index` among the shown widgets (reading order); the others make room. */
  reorder(instanceId: string, index: number): void {
    const boot = this.editBase;
    if (!this.editing() || this.saving() || !boot) return;
    const items = toItems(this.draft());
    const order = packingOrder(items);
    const from = order.findIndex(i => i.id === instanceId);
    if (from < 0 || isHidden(order[from])) return;
    const shown = order.filter(i => !isHidden(i)).length;
    const [moving] = order.splice(from, 1);
    order.splice(Math.min(Math.max(0, Math.round(index)), shown - 1), 0, moving);
    this.draft.set(fromItems(packKeepingOrder(items, order, boot.grid.columns)));
  }

  /** Resizes a widget within its limits; the widgets after it re-pack around the new size. */
  resize(instanceId: string, w: number, h: number): void {
    const boot = this.editBase;
    const target = this.draft().find(d => d.instanceId === instanceId);
    if (!this.editing() || this.saving() || !boot || !target) return;
    const rect = clampSize({ ...target.layout, w, h }, target.size, boot.grid.columns);
    const items = toItems(this.draft().map(d => (d.instanceId === instanceId ? { ...d, layout: rect } : d)));
    this.draft.set(fromItems(packKeepingOrder(items, packingOrder(items), boot.grid.columns)));
  }

  async save(): Promise<void> {
    // Always the bootstrap the draft started from, so the PUT targets that breakpoint and version.
    const boot = this.editBase;
    if (!this.editing() || !boot || !this.dashboardId || this.saving()) return;
    const id = this.dashboardId;
    const saved = boot.widgets;
    const draft = this.draft();
    const removed = saved.filter(s => !draft.some(d => d.instanceId === s.instanceId));
    const added = draft.filter(d => d.instanceId.startsWith(NEW_PREFIX));
    const moved = draft.some(d => {
      const s = saved.find(x => x.instanceId === d.instanceId);
      return s && !sameRect(s.layout, d.layout);
    });
    if (!removed.length && !added.length && !moved) {
      this.exitEditing();
      await this.reloadIfBreakpointStale();
      return;
    }

    const bp = boot.grid.breakpoint;
    this.saving.set(true);
    this.error.set(null);
    let mutated = false;
    try {
      let version = boot.layoutVersion;
      for (const r of removed) {
        version = (await firstValueFrom(this.api.removeWidget(id, r.instanceId, version))).layoutVersion;
        mutated = true;
      }
      const realIds = new Map<string, string>();
      for (const a of added) {
        const res = await firstValueFrom(this.api.addWidget(id, a.widgetKey, version, bp === 'desktop' ? a.layout : undefined));
        version = res.layoutVersion;
        realIds.set(a.instanceId, res.instanceId);
        mutated = true;
      }
      const items = draft.map(d => ({ instanceId: realIds.get(d.instanceId) ?? d.instanceId, ...d.layout }));
      const put = await firstValueFrom(this.api.saveLayout(id, bp, version, items));
      // Show the saved layout right away; the reload below only refreshes data and server-side details.
      const committed = draft.map(d => ({ ...d, instanceId: realIds.get(d.instanceId) ?? d.instanceId }));
      this.bootstrap.update(b => (b ? { ...b, layoutVersion: put.layoutVersion, widgets: committed } : b));
      this.exitEditing();
      await this.reloadAfterSuccess('Saved, but could not reload the dashboard.');
    } catch (err) {
      if (this.isConflict(err) || this.isSetMismatch(err)) {
        // A set mismatch means the allowed widgets changed during the edit (e.g. a capability flicker).
        this.notifications.warning(this.isConflict(err) ? CONFLICT_MESSAGE : SET_MISMATCH_MESSAGE);
        this.exitEditing();
        await this.safeRefresh();
      } else {
        const message = this.messageOf(err, 'Could not save the dashboard.');
        this.error.set(message);
        this.notifications.error(message);
        if (mutated) {
          // Some changes already reached the server, so the draft can no longer be replayed safely.
          this.exitEditing();
          await this.safeRefresh();
        }
      }
    } finally {
      this.saving.set(false);
    }
  }

  async resetToDefault(): Promise<void> {
    const boot = this.bootstrap();
    if (!boot || !this.dashboardId || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.reset(this.dashboardId, boot.layoutVersion));
      this.exitEditing();
      await this.reloadAfterSuccess('Reset, but could not reload the dashboard.');
    } catch (err) {
      if (this.isConflict(err)) {
        this.notifications.warning(CONFLICT_MESSAGE);
        this.exitEditing();
        await this.safeRefresh();
      } else {
        const message = this.messageOf(err, 'Could not reset the dashboard.');
        this.error.set(message);
        this.notifications.error(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  /** Leaves editing without reloading anything (for page teardown); in-flight refreshes are discarded. */
  dispose(): void {
    this.refreshSeq++;
    this.exitEditing();
  }

  private exitEditing(): void {
    this.editing.set(false);
    this.draft.set([]);
    this.editBase = null;
  }

  /** After leaving editing without saving: catch up on a breakpoint change or a refresh skipped while editing. */
  private async reloadIfBreakpointStale(): Promise<void> {
    const stale = this.staleWhileEditing || this.bootstrap()?.grid.breakpoint !== this.currentBreakpoint;
    if (this.dashboardId && stale) {
      await this.safeRefresh();
    }
  }

  private isConflict(err: unknown): boolean {
    return err instanceof HttpErrorResponse && readLayoutProblem(err).status === 409;
  }

  private isSetMismatch(err: unknown): boolean {
    return err instanceof HttpErrorResponse && readLayoutProblem(err).codes.includes(LAYOUT_SET_MISMATCH);
  }

  /** The server change already succeeded; a reload failure is reported on its own, not as a save failure. */
  private async reloadAfterSuccess(message: string): Promise<void> {
    try {
      await this.refresh();
    } catch {
      this.error.set(message);
      this.notifications.error(message);
    }
  }

  /** Only the most recently started refresh may apply its result; older, slower ones are discarded. */
  private async refresh(): Promise<void> {
    const token = ++this.refreshSeq;
    const id = this.dashboardId!;
    const bp = this.currentBreakpoint;
    let boot: DashboardBootstrap;
    let available: AvailableWidget[];
    try {
      [boot, available] = await Promise.all([
        firstValueFrom(this.api.bootstrap(id, bp)),
        firstValueFrom(this.api.available(id, bp))
      ]);
    } catch (err) {
      if (token !== this.refreshSeq) return; // a newer refresh superseded this one; its failure is irrelevant
      if (this.editing()) {
        this.staleWhileEditing = true; // retried when editing ends
        return;
      }
      throw err;
    }
    if (token !== this.refreshSeq) return;
    if (this.editing()) {
      // Landed after editing started: keep the bootstrap the draft is based on and re-bootstrap after exit.
      this.staleWhileEditing = true;
      return;
    }
    this.staleWhileEditing = false;
    this.bootstrap.set(boot);
    this.serverAvailable.set(available);
  }

  private async safeRefresh(): Promise<void> {
    try {
      await this.refresh();
    } catch (err) {
      this.fail(err, 'Could not reload the dashboard.');
    }
  }

  private fail(err: unknown, fallback: string): void {
    this.error.set(this.messageOf(err, fallback));
  }

  /**
   * A message fit for a toast. Machine-readable codes are mapped to plain reasons (unknown codes fall back);
   * a plain-sentence detail is passed through; bare status titles ("Forbidden") are never shown.
   */
  private messageOf(err: unknown, fallback: string): string {
    if (!(err instanceof HttpErrorResponse)) return fallback;
    const problem = readLayoutProblem(err);
    const codes = problem.codes.length ? problem.codes : problem.code ? [problem.code] : [];
    if (codes.length) {
      const reasons = codes.map(c => CODE_REASONS[c]);
      if (reasons.some(r => r === undefined)) return fallback;
      return `${fallback.replace(/\.$/, '')}: ${reasons.join(', ')}.`;
    }
    const body = err.error as { detail?: unknown } | null;
    const detail = body && typeof body === 'object' ? body.detail : null;
    // Plain-language detail (e.g. "Dashboard not found."), never a code-shaped string.
    if (typeof detail === 'string' && detail.trim() && !/^[A-Z][A-Z_,]*$/.test(detail.trim())) return detail;
    return fallback;
  }
}
