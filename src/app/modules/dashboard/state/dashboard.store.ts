import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { DashboardLayoutApiService } from '../data-access/dashboard-layout-api.service';
import { autoPlace, clampSize, compact, moveTo, resizeTo } from '../grid/grid-math';
import {
  AvailableWidget,
  BootstrapWidget,
  Breakpoint,
  DashboardBootstrap,
  DashboardKey,
  GridRect,
  readLayoutProblem
} from '../models/dashboard-layout.model';

const CONFLICT_MESSAGE = 'Your dashboard changed in another tab or device — reloaded.';
const NEW_PREFIX = 'new:';

interface Item {
  id: string;
  rect: GridRect;
  widget: BootstrapWidget;
}

const toItems = (widgets: BootstrapWidget[]): Item[] => widgets.map(w => ({ id: w.instanceId, rect: w.layout, widget: w }));
const fromItems = (items: Item[]): BootstrapWidget[] => items.map(i => ({ ...i.widget, layout: i.rect }));
const sameRect = (a: GridRect, b: GridRect): boolean => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

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

  readonly bootstrap = signal<DashboardBootstrap | null>(null);
  readonly editing = signal(false);
  readonly draft = signal<BootstrapWidget[]>([]);
  readonly serverAvailable = signal<AvailableWidget[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** The draft while editing, otherwise the saved widgets. */
  readonly widgets = computed<BootstrapWidget[]>(() => (this.editing() ? this.draft() : (this.bootstrap()?.widgets ?? [])));

  /** Catalog entries not currently on the board (placed ones removed in the draft count as available again). */
  readonly available = computed<AvailableWidget[]>(() => {
    const onBoard = new Set(this.widgets().map(w => w.widgetKey));
    return this.serverAvailable().filter(a => !onBoard.has(a.key));
  });

  async load(key: DashboardKey): Promise<void> {
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
    if (!this.bootstrap()) return;
    this.draft.set(this.bootstrap()!.widgets.map(w => ({ ...w, layout: { ...w.layout } })));
    this.error.set(null);
    this.editing.set(true);
  }

  async cancel(): Promise<void> {
    this.exitEditing();
    await this.reloadIfBreakpointStale();
  }

  add(key: string): void {
    const def = this.serverAvailable().find(a => a.key === key);
    const boot = this.bootstrap();
    if (!this.editing() || !def || !boot || this.draft().some(w => w.widgetKey === key)) return;
    const cols = boot.grid.columns;
    const base = clampSize({ x: 0, y: 0, w: def.defaultW, h: def.defaultH }, def.size, cols);
    const rect = autoPlace(this.draft().map(w => w.layout), base.w, base.h, cols);
    const added: BootstrapWidget = {
      instanceId: NEW_PREFIX + key,
      widgetKey: key,
      title: def.title,
      layout: rect,
      size: def.size,
      dataState: { status: 'client', fetchedAt: null, error: null },
      data: null
    };
    this.draft.set(fromItems(compact(toItems([...this.draft(), added]))));
  }

  remove(instanceId: string): void {
    if (!this.editing()) return;
    this.draft.set(fromItems(compact(toItems(this.draft().filter(w => w.instanceId !== instanceId)))));
  }

  move(instanceId: string, x: number, y: number): void {
    const boot = this.bootstrap();
    if (!this.editing() || !boot) return;
    this.draft.set(fromItems(moveTo(toItems(this.draft()), instanceId, x, y, boot.grid.columns)));
  }

  resize(instanceId: string, w: number, h: number): void {
    const boot = this.bootstrap();
    const target = this.draft().find(d => d.instanceId === instanceId);
    if (!this.editing() || !boot || !target) return;
    this.draft.set(fromItems(resizeTo(toItems(this.draft()), instanceId, w, h, target.size, boot.grid.columns)));
  }

  async save(): Promise<void> {
    const boot = this.bootstrap();
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
      if (this.isConflict(err)) {
        this.notifications.warning(CONFLICT_MESSAGE);
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

  private exitEditing(): void {
    this.editing.set(false);
    this.draft.set([]);
  }

  private async reloadIfBreakpointStale(): Promise<void> {
    if (this.dashboardId && this.bootstrap()?.grid.breakpoint !== this.currentBreakpoint) {
      await this.safeRefresh();
    }
  }

  private isConflict(err: unknown): boolean {
    return err instanceof HttpErrorResponse && readLayoutProblem(err).status === 409;
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
      throw err;
    }
    if (token !== this.refreshSeq) return;
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

  private messageOf(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { detail?: unknown; title?: unknown } | null;
      if (body && typeof body === 'object') {
        if (typeof body.detail === 'string') return body.detail;
        if (typeof body.title === 'string') return body.title;
      }
    }
    return fallback;
  }
}
