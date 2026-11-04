import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { CoverageCardVisual, PeopleChartTreeNode } from '../../models/position.model';

/** Beside the card first (right, then left), then below/above - like a contact hover card. */
const HOVER_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top', offsetX: 10 },
  { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top', offsetX: -10 },
  { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 }
];

const OPEN_DELAY_MS = 300;
const CLOSE_DELAY_MS = 150;

export interface PeopleCardSelectionEvent {
  readonly node: PeopleChartTreeNode;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  /** Clicked on the checkbox itself: toggles this person (and their reports) in the selection. */
  readonly fromCheckbox?: boolean;
}

export interface PeopleCardDragEvent {
  readonly node: PeopleChartTreeNode;
  readonly event: DragEvent;
}

/** Card size the People chart lays out with (app-tidy-tree slots). */
export const PEOPLE_CARD_WIDTH = 250;
export const PEOPLE_CARD_HEIGHT = 64;

/**
 * One card of the Positions "People" view. Placement and connectors come from app-tidy-tree; a
 * one-off manager (reportingLine "custom") gets a dashed amber line there and an amber border here.
 * The card stays compact - contact and reporting details show in a hover card (rendered in the CDK
 * overlay, so it keeps its normal size whatever the chart's zoom).
 */
@Component({
  selector: 'app-people-chart-node',
  standalone: true,
  imports: [RouterLink, OverlayModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pcn-branch">
      @if (node().kind === 'vacant') {
        <div
          class="pcn-card pcn-card--vacant"
          [class.pcn-card--coverage-resolved]="coverageVisual().state === 'resolved'"
          [class.pcn-card--coverage-unresolved]="coverageVisual().state === 'unresolved'"
          [class.pcn-card--coverage-outside]="coverageVisual().state === 'outside'"
        >
          <span class="pcn-avatar pcn-avatar--vacant" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </span>
          <span class="pcn-body">
            <span class="pcn-name">{{ node().positionName }}</span>
            <span class="pcn-meta">{{ node().departmentName || 'No department' }}</span>
          </span>
          <span class="pcn-chip pcn-chip--vacant">Vacant</span>
          @if (coverageVisual().levels.length > 0) {
            <span class="pcn-coverage-levels">
              @for (levelLabel of coverageVisual().levels; track levelLabel) {
                <span class="pcn-coverage-level">{{ levelLabel }}</span>
              }
            </span>
          }
        </div>
      } @else {
        <div
          class="pcn-card"
          cdkOverlayOrigin
          #cardOrigin="cdkOverlayOrigin"
          role="treeitem"
          tabindex="0"
          [attr.aria-selected]="selectedEmployeeIds().has(node().employeeId!)"
          [attr.aria-label]="fullName() + ', ' + node().positionName"
          [class.pcn-card--custom]="node().reportingLine === 'custom'"
          [class.pcn-card--pending]="node().isPending"
          [class.pcn-card--selected]="selectedEmployeeIds().has(node().employeeId!)"
          [class.pcn-card--coverage-selected]="coverageVisual().state === 'selected'"
          [class.pcn-card--coverage-resolved]="coverageVisual().state === 'resolved'"
          [class.pcn-card--coverage-unresolved]="coverageVisual().state === 'unresolved'"
          [class.pcn-card--coverage-outside]="coverageVisual().state === 'outside'"
          [class.pcn-card--staying]="stayingEmployeeIds().has(node().employeeId!)"
          [class.pcn-card--dragging]="dragging() && selectedEmployeeIds().has(node().employeeId!)"
          [class.pcn-card--drop-valid]="targetMode() && !blockedTargetEmployeeIds().has(node().employeeId!)"
          [class.pcn-card--drop-invalid]="targetMode() && blockedTargetEmployeeIds().has(node().employeeId!)"
          [attr.draggable]="canManage() && !node().isPending ? 'true' : null"
          (click)="onCardClick($event)"
          (dblclick)="openProfile($event)"
          (keydown)="onCardKeydown($event)"
          (dragstart)="onDragStart($event)"
          (dragend)="dragEnded.emit()"
          (dragover)="onDragOver($event)"
          (drop)="onDrop($event)"
          (mouseenter)="scheduleOpen()"
          (mouseleave)="scheduleClose()"
          (focus)="scheduleOpen()"
          (blur)="scheduleClose()"
        >
          <span
            class="pcn-check"
            [class.pcn-check--visible]="selectionActive() || selectedEmployeeIds().has(node().employeeId!)"
            aria-hidden="true"
          >
            @if (selectedEmployeeIds().has(node().employeeId!)) {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m3 8 3 3 7-7"/></svg>
            }
          </span>
          <span class="pcn-avatar" aria-hidden="true">
            @if (node().avatarFileId && !avatarFailed()) {
              <img [src]="avatarUrl()" alt="" (error)="avatarFailed.set(true)" />
            } @else {
              {{ initials() }}
            }
          </span>
          <span class="pcn-body">
            <span class="pcn-name">{{ fullName() }}</span>
            <span class="pcn-meta">{{ node().positionName }}</span>
          </span>
          @if (node().isPending) {
            <span class="pcn-chip pcn-chip--pending">Invited</span>
          } @else if (stayingEmployeeIds().has(node().employeeId!)) {
            <span class="pcn-chip pcn-chip--staying">Stays</span>
          }
          @if (dragging() && selectedEmployeeIds().has(node().employeeId!) && selectedCount() > 1) {
            <span class="pcn-drag-count">{{ selectedCount() }}</span>
          }
          @if (coverageVisual().levels.length > 0) {
            <span class="pcn-coverage-levels" aria-label="Coverage responsibility levels">
              @for (levelLabel of coverageVisual().levels; track levelLabel) {
                <span class="pcn-coverage-level">{{ levelLabel }}</span>
              }
            </span>
          }
          @if (coverageVisual().state === 'unresolved') {
            <span class="pcn-coverage-warning" title="This coverage needs attention" aria-label="Coverage needs attention">!</span>
          }
        </div>

        <ng-template
          cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="cardOrigin"
          [cdkConnectedOverlayOpen]="hoverOpen()"
          [cdkConnectedOverlayPositions]="hoverPositions"
          [cdkConnectedOverlayPush]="true"
          [cdkConnectedOverlayViewportMargin]="8"
        >
          <div class="pcn-hover" role="tooltip" (mouseenter)="cancelClose()" (mouseleave)="scheduleClose()">
            <div class="pcn-hover__head">
              <div class="min-w-0">
                <p class="pcn-hover__name">{{ fullName() }}</p>
                <p class="pcn-hover__role">{{ node().positionName }}</p>
              </div>
              <span class="pcn-hover__avatar" aria-hidden="true">
                @if (node().avatarFileId && !avatarFailed()) {
                  <img [src]="avatarUrl()" alt="" />
                } @else {
                  {{ initials() }}
                }
              </span>
            </div>

            <ul class="pcn-hover__rows">
              @if (node().departmentName) {
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/></svg>
                  <span>{{ node().departmentName }}</span>
                </li>
              }
              @if (node().workEmail) {
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                  <span class="truncate">{{ node().workEmail }}</span>
                </li>
              }
              <li>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v6M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM12 15v6"/></svg>
                <span>
                  @if (managerName()) {
                    Reports to <strong>{{ managerName() }}</strong>
                  } @else {
                    Top of the organisation
                  }
                </span>
              </li>
              @if (lineNote(); as note) {
                <li class="pcn-hover__note">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
                  <span>{{ note }}</span>
                </li>
              }
              @if (node().holderCount > 1) {
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21 19"/></svg>
                  <span>{{ node().holderCount }} people hold this position</span>
                </li>
              }
            </ul>

            <div class="pcn-hover__actions">
              <a class="pcn-hover__btn" [routerLink]="['/people/employees', node().employeeId]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                View profile
              </a>
            </div>
          </div>
        </ng-template>
      }
    </div>
  `,
  styles: [`
    .pcn-branch { display: flex; flex-direction: column; align-items: center; position: relative; }

    .pcn-card {
      position: relative;
      display: flex; align-items: center; gap: 0.75rem;
      width: 250px; height: 64px; padding: 0.625rem 0.875rem;
      border-radius: 10px; background: var(--color-surface);
      border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
      box-shadow: var(--shadow-popover);
      color: inherit; text-decoration: none; user-select: none; cursor: pointer;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .pcn-card:hover { border-color: var(--color-sidebar-active-bg, #2563eb); box-shadow: var(--shadow-popover); }
    .pcn-card:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--color-focus-ring); }
    .pcn-card--selected { border-color: var(--color-accent) !important; background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 24%, transparent); }
    .pcn-card--coverage-selected { border: 2px solid #2563eb !important; background: color-mix(in srgb, #2563eb 7%, var(--color-surface)); box-shadow: 0 0 0 3px color-mix(in srgb, #2563eb 18%, transparent), 0 8px 22px rgba(37, 99, 235, 0.14); }
    .pcn-card--coverage-resolved { border-color: #10b981 !important; background: color-mix(in srgb, #10b981 10%, var(--color-surface)); box-shadow: 0 0 0 3px color-mix(in srgb, #10b981 16%, transparent), 0 8px 22px rgba(16, 185, 129, 0.14); }
    .pcn-card--coverage-unresolved { border-color: #f59e0b !important; background: color-mix(in srgb, #f59e0b 12%, var(--color-surface)); box-shadow: 0 0 0 3px color-mix(in srgb, #f59e0b 18%, transparent), 0 8px 22px rgba(245, 158, 11, 0.16); }
    .pcn-card--coverage-outside { opacity: 0.44; filter: grayscale(0.35); box-shadow: none; }
    .pcn-card--staying { border-style: dashed; border-color: color-mix(in srgb, var(--color-text-secondary) 45%, var(--color-border)); }
    .pcn-card--dragging { opacity: 0.66; }
    .pcn-card--drop-valid { border-color: #10b981 !important; box-shadow: 0 0 0 3px color-mix(in srgb, #10b981 22%, transparent); }
    .pcn-card--drop-invalid { cursor: not-allowed; opacity: 0.55; }
    .pcn-card--vacant { border-style: dashed; background: color-mix(in srgb, var(--color-surface-secondary) 60%, var(--color-surface)); }
    .pcn-card--custom { border-color: color-mix(in srgb, #f59e0b 55%, var(--color-surface)); }
    .pcn-card--pending { border-style: dashed; }

    .pcn-avatar {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 2.5rem; height: 2.5rem; border-radius: 999px; overflow: hidden;
      font-size: 0.8125rem; font-weight: 700;
      background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface)); color: var(--color-accent);
    }
    .pcn-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .pcn-avatar--vacant { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .pcn-avatar--vacant svg { width: 18px; height: 18px; }

    .pcn-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pcn-name { font-size: 0.8125rem; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pcn-meta { font-size: 0.6875rem; color: var(--color-text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .pcn-chip {
      flex: none; padding: 0.125rem 0.4375rem; border-radius: 999px;
      font-size: 0.625rem; font-weight: 600; line-height: 1.4;
      background: var(--color-surface-secondary); color: var(--color-text-secondary);
      border: 1px solid var(--color-border);
    }
    .pcn-chip--vacant { border-style: dashed; }
    .pcn-chip--pending {
      background: color-mix(in srgb, #f59e0b 12%, var(--color-surface)); color: #b45309;
      border-color: color-mix(in srgb, #f59e0b 35%, var(--color-surface));
    }
    .pcn-chip--staying { border-style: dashed; color: var(--color-text-secondary); background: var(--color-surface-secondary); }
    .pcn-check { position: absolute; top: -7px; left: -7px; width: 20px; height: 20px; display: grid; place-items: center; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface); color: var(--color-text-on-solid); opacity: 0; transform: scale(0.85); transition: 120ms ease; }
    .pcn-card:hover .pcn-check, .pcn-check--visible { opacity: 1; transform: scale(1); }
    .pcn-card--selected .pcn-check { border-color: var(--color-accent); background: var(--color-accent); }
    .pcn-check svg { width: 13px; height: 13px; }
    .pcn-drag-count { position: absolute; right: -8px; top: -9px; min-width: 22px; height: 22px; padding: 0 5px; display: grid; place-items: center; border: 2px solid var(--color-surface); border-radius: 999px; background: var(--color-accent); color: var(--color-text-on-solid); font-size: 0.625rem; font-weight: 700; }
    .pcn-coverage-levels { position: absolute; right: 7px; bottom: 5px; display: flex; gap: 3px; }
    .pcn-coverage-level { min-width: 1.25rem; padding: 1px 5px; border-radius: 999px; background: color-mix(in srgb, #059669 14%, var(--color-surface)); color: #047857; font-size: 0.6rem; font-weight: 800; line-height: 1.35; text-align: center; }
    .pcn-card--coverage-unresolved .pcn-coverage-level { background: color-mix(in srgb, #f59e0b 18%, var(--color-surface)); color: #92400e; }
    .pcn-coverage-warning { position: absolute; top: -8px; right: -8px; display: grid; place-items: center; width: 21px; height: 21px; border: 2px solid var(--color-surface); border-radius: 999px; background: #f59e0b; color: var(--color-text-on-solid); font-size: 0.7rem; font-weight: 900; }

    /* Hover card */
    .pcn-hover {
      width: 300px; border-radius: 14px; overflow: hidden;
      background: var(--color-surface); border: 1px solid var(--color-border);
      box-shadow: var(--shadow-modal);
      animation: pcnHoverIn 120ms ease-out;
    }
    .pcn-hover__head { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 1rem 1rem 0.875rem; }
    .pcn-hover__name { margin: 0; font-size: 1rem; font-weight: 700; color: var(--color-text-primary); }
    .pcn-hover__role { margin: 0.125rem 0 0; font-size: 0.75rem; color: var(--color-text-secondary); }
    .pcn-hover__avatar {
      flex: none; display: inline-flex; align-items: center; justify-content: center;
      width: 3.5rem; height: 3.5rem; border-radius: 999px; overflow: hidden;
      font-size: 1.125rem; font-weight: 700;
      background: color-mix(in srgb, var(--color-accent) 14%, var(--color-surface)); color: var(--color-accent);
    }
    .pcn-hover__avatar img { width: 100%; height: 100%; object-fit: cover; }
    .pcn-hover__rows {
      display: flex; flex-direction: column; gap: 0.5rem;
      margin: 0; padding: 0.875rem 1rem; list-style: none;
      border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border);
    }
    .pcn-hover__rows li { display: flex; align-items: center; gap: 0.625rem; min-width: 0; font-size: 0.8125rem; color: var(--color-text-primary); }
    .pcn-hover__rows svg { flex: none; width: 16px; height: 16px; color: var(--color-text-secondary); }
    .pcn-hover__note { align-items: flex-start !important; color: #b45309 !important; font-size: 0.75rem !important; }
    .pcn-hover__note svg { color: #b45309 !important; margin-top: 1px; }
    .pcn-hover__actions { display: flex; padding: 0.75rem 1rem; }
    .pcn-hover__btn {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
      height: 2.25rem; border-radius: 9px; border: 1px solid var(--color-border);
      font-size: 0.8125rem; font-weight: 600; color: var(--color-text-primary); text-decoration: none;
    }
    .pcn-hover__btn:hover { background: var(--color-surface-secondary); }
    .pcn-hover__btn svg { width: 15px; height: 15px; }
    @keyframes pcnHoverIn { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: none; } }
  `]
})
export class PeopleChartNodeComponent implements OnDestroy {
  private readonly router = inject(Router);
  readonly node = input.required<PeopleChartTreeNode>();
  /** Name of the card above (the person this one reports to); null at the top. */
  readonly managerName = input<string | null>(null);
  readonly canManage = input(false);
  readonly selectedEmployeeIds = input<ReadonlySet<string>>(new Set<string>());
  readonly stayingEmployeeIds = input<ReadonlySet<string>>(new Set<string>());
  readonly blockedTargetEmployeeIds = input<ReadonlySet<string>>(new Set<string>());
  readonly selectionActive = input(false);
  readonly dragging = input(false);
  readonly choosingManager = input(false);
  readonly selectedCount = input(0);
  readonly coverageVisual = input<CoverageCardVisual>({ state: 'default', levels: [], accessibleLabel: null });

  readonly personSelected = output<PeopleCardSelectionEvent>();
  readonly managerChosen = output<PeopleChartTreeNode>();
  readonly personDragStarted = output<PeopleCardDragEvent>();
  readonly personDropped = output<PeopleCardDragEvent>();
  readonly dragEnded = output<void>();

  readonly avatarFailed = signal(false);
  readonly hoverOpen = signal(false);
  readonly hoverPositions = HOVER_POSITIONS;
  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  targetMode(): boolean {
    return (this.dragging() || this.choosingManager()) && !this.node().isPending;
  }

  onCardClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.cancelClose();
    this.hoverOpen.set(false);
    if (this.node().isPending || !this.node().employeeId) return;
    if (this.choosingManager()) {
      this.managerChosen.emit(this.node());
      return;
    }
    this.personSelected.emit({
      node: this.node(),
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      fromCheckbox: !!(event.target as Element | null)?.closest?.('.pcn-check')
    });
  }

  onCardKeydown(event: KeyboardEvent): void {
    if (event.key === ' ') {
      event.preventDefault();
      this.personSelected.emit({
        node: this.node(), ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey
      });
    } else if (event.key === 'Enter' && this.node().employeeId) {
      event.preventDefault();
      void this.router.navigate(['/people/employees', this.node().employeeId]);
    }
  }

  openProfile(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.node().employeeId) void this.router.navigate(['/people/employees', this.node().employeeId]);
  }

  onDragStart(event: DragEvent): void {
    if (!this.canManage() || this.node().isPending || !this.node().employeeId) {
      event.preventDefault();
      return;
    }
    this.cancelClose();
    this.hoverOpen.set(false);
    this.personDragStarted.emit({ node: this.node(), event });
  }

  onDragOver(event: DragEvent): void {
    const employeeId = this.node().employeeId;
    if (!this.dragging() || this.node().isPending || !employeeId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = this.blockedTargetEmployeeIds().has(employeeId) ? 'none' : 'move';
    }
  }

  onDrop(event: DragEvent): void {
    if (!this.dragging() || this.node().isPending || !this.node().employeeId) return;
    event.preventDefault();
    event.stopPropagation();
    this.personDropped.emit({ node: this.node(), event });
  }

  scheduleOpen(): void {
    if (this.dragging() || this.choosingManager() || this.selectionActive()) return;
    this.cancelClose();
    if (this.hoverOpen() || this.openTimer) return;
    this.openTimer = setTimeout(() => {
      this.openTimer = null;
      this.hoverOpen.set(true);
    }, OPEN_DELAY_MS);
  }

  /** Small grace period so the pointer can travel from the card into the hover card. */
  scheduleClose(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (this.closeTimer) return;
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.hoverOpen.set(false);
    }, CLOSE_DELAY_MS);
  }

  cancelClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  ngOnDestroy(): void {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }

  avatarUrl(): string {
    return buildFileUrl(this.node().avatarFileId!);
  }

  fullName(): string {
    const n = this.node();
    return `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim();
  }

  initials(): string {
    const n = this.node();
    return `${(n.firstName ?? '').charAt(0)}${(n.lastName ?? '').charAt(0)}`.toUpperCase() || '?';
  }

  lineNote(): string | null {
    if (this.node().isPending) {
      return "Invited - this seat becomes active once they accept the invitation.";
    }
    switch (this.node().reportingLine) {
      case 'custom':
        return 'One-off manager: reports outside the position hierarchy (this person only).';
      case 'default':
        return 'Several people hold the position above and none was picked - shown under the first.';
      default:
        return null;
    }
  }
}
