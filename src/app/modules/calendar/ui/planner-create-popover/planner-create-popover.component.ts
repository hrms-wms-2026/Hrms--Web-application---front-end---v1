import { ChangeDetectionStrategy, Component, HostListener, computed, effect, input, output, signal, untracked } from '@angular/core';
import { CREATE_TAB_LABELS, CREATE_TAB_ORDER, CreateSlot, CreateTab, SharedCreateDraft } from './planner-create-draft';

/**
 * The Planner create popover (2026-11-03 design): one surface for a picked time, with Event, Meeting, Work item and
 * Time off tabs. The shell owns the tab bar, the shared draft (title, all-day) and closing; the page projects each
 * opened tab's content (kept, hidden, while another is active), so each tab stays a small component over the
 * existing stores and APIs.
 */
@Component({
  selector: 'app-planner-create-popover',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="presentation" class="pcp-backdrop" data-testid="create-popover-backdrop" (click)="closed.emit()"></div>
    <section class="pcp-panel" [class.pcp-panel--wide]="active() === 'meeting' || active() === 'workItem'" data-testid="create-popover-panel" role="dialog" aria-label="Create" (click)="$event.stopPropagation()" (keyup)="$event.stopPropagation()">
      <header class="pcp-tabs">
        <div role="tablist" class="pcp-tablist">
          @for (tab of visibleTabs(); track tab) {
            <button type="button" role="tab" class="pcp-tab" [class.pcp-tab--on]="tab === active()"
              [attr.aria-selected]="tab === active()" [attr.data-testid]="'create-tab-' + tab" (click)="select(tab)">
              {{ labels[tab] }}
            </button>
          }
        </div>
        <button type="button" class="pcp-close" data-testid="create-popover-close" aria-label="Close" (click)="closed.emit()">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div class="pcp-body" role="tabpanel">
        <ng-content />
      </div>
    </section>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 60; }
    .pcp-backdrop { position: absolute; inset: 0; background: transparent; }
    .pcp-panel {
      position: absolute; left: 50%; top: 12vh; transform: translateX(-50%); width: min(560px, calc(100vw - 32px));
      max-height: 76vh; overflow: auto; border: 1px solid var(--color-border); border-radius: 14px;
      background: var(--color-surface); box-shadow: var(--shadow-modal);
    }
    .pcp-tabs { display: flex; align-items: center; gap: 4px; padding: 10px 12px; border-bottom: 1px solid var(--color-border); }
    .pcp-tablist { display: flex; gap: 2px; flex-wrap: wrap; }
    .pcp-tab { padding: 6px 14px; border-radius: 10px; border: 0; font-size: 15px; font-weight: 500; color: var(--color-text-secondary);
      background: transparent; }
    .pcp-tab--on { font-weight: 600; color: var(--color-text-primary); background: var(--color-surface-secondary); }
    .pcp-close { display: inline-flex; align-items: center; justify-content: center; margin-left: auto; width: 30px; height: 30px; border-radius: 50%;
      border: 0; color: var(--color-text-primary); background: transparent; }
    .pcp-body { padding: 12px 14px; }
    /* The Meeting tab's date row and the Work item tab's chips need the room. */
    .pcp-panel--wide { top: 7vh; width: min(820px, calc(100vw - 32px)); max-height: 86vh; border-radius: 18px; }
    .pcp-panel--wide .pcp-tabs { padding: 10px 24px; }
    .pcp-panel--wide .pcp-tablist { margin-left: -14px; }
    .pcp-panel--wide .pcp-body { padding: 14px 24px 18px; }
    @media (max-width: 767px) {
      .pcp-panel { left: 0; right: 0; top: auto; bottom: 0; transform: none; width: 100%; max-height: 88vh;
        border-radius: 14px 14px 0 0; }
    }
  `],
})
export class PlannerCreatePopoverComponent {
  readonly slot = input.required<CreateSlot>();
  readonly tabs = input.required<readonly CreateTab[]>();
  readonly closed = output<void>();

  readonly labels = CREATE_TAB_LABELS;
  readonly visibleTabs = computed(() => CREATE_TAB_ORDER.filter((tab) => this.tabs().includes(tab)));
  readonly active = signal<CreateTab>('event');
  /** Tabs opened so far: the page keeps them rendered (hidden when not active), so switching keeps what was typed. */
  readonly visited = signal<ReadonlySet<CreateTab>>(new Set<CreateTab>(['event']));
  readonly shared: SharedCreateDraft = { title: signal(''), isAllDay: signal(false) };

  constructor() {
    // A hidden tab can't stay active: fall back to the first one shown.
    effect(() => {
      const shown = this.visibleTabs();
      untracked(() => { if (!shown.includes(this.active()) && shown.length > 0) this.select(shown[0]); });
    });
  }

  select(tab: CreateTab): void {
    this.active.set(tab);
    this.visited.update((tabs) => (tabs.has(tab) ? tabs : new Set([...tabs, tab])));
  }

  /** Rendered: opened at least once. Shown: the active one. */
  isRendered(tab: CreateTab): boolean {
    return this.visited().has(tab);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }
}
