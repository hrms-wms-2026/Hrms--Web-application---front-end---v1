import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import { ConnectionPositionPair, OverlayModule } from '@angular/cdk/overlay';
import { StopClickPropagationDirective } from '../../directives/stop-click-propagation.directive';
import { EntityIconComponent } from '../entity-icon/entity-icon.component';
import {
  ENTITY_ICON_COLORS,
  ENTITY_ICON_GROUPS,
  EntityIconGroup,
  emojiIconValue,
  lucideIconValue
} from '../entity-icon/entity-icon.registry';

const PANEL_POSITIONS: ConnectionPositionPair[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 }
];

/** Served from node_modules/emoji-picker-element-data by angular.json, so the picker makes no outside request. */
const EMOJI_DATA_URL = '/emoji/data.json';

/**
 * The shared icon/emoji chooser for projects, leave types and groups. The trigger is the current icon; the panel has an
 * Icons tab (curated Lucide set, search, colour swatches) and an Emoji tab (emoji-picker-element, loaded on first open).
 * The caller owns the values: it gets `iconChange` ("lucide:{name}", "emoji:{emoji}" or null) and `colorChange`.
 */
@Component({
  selector: 'app-icon-picker',
  standalone: true,
  imports: [OverlayModule, EntityIconComponent, StopClickPropagationDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-icon-picker' },
  template: `
    <button
      type="button"
      class="ip-trigger"
      [class.ip-trigger--link]="linkLabel()"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      data-testid="icon-picker-trigger"
      [disabled]="disabled()"
      [attr.aria-label]="linkLabel() ? null : ariaLabel()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      @if (linkLabel(); as label) {
        {{ label }}
      } @else {
        <app-entity-icon [icon]="icon() || defaultIcon()" [color]="color()" [name]="name()" />
        <span class="ip-trigger__badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9" /><path d="M16.4 3.6a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </span>
      }
    </button>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="8"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      (backdropClick)="close()"
      (detach)="close()"
      (overlayKeydown)="onOverlayKeydown($event)"
    >
      <div class="ip-panel" role="dialog" aria-label="Choose an icon" data-testid="icon-picker-panel" appStopClickPropagation>
        <div class="ip-head">
          <div class="ip-tabs" role="tablist" aria-label="Icon type">
            <button type="button" role="tab" class="ip-tab" [class.ip-tab--on]="tab() === 'icons'" [attr.aria-selected]="tab() === 'icons'"
                    data-testid="icon-picker-tab-icons" (click)="tab.set('icons')">Icons</button>
            <button type="button" role="tab" class="ip-tab" [class.ip-tab--on]="tab() === 'emoji'" [attr.aria-selected]="tab() === 'emoji'"
                    data-testid="icon-picker-tab-emoji" (click)="showEmoji()">Emoji</button>
          </div>
          @if (icon()) {
            <button type="button" class="ip-remove" data-testid="icon-picker-remove" (click)="pick(null)">Remove</button>
          }
        </div>

        @if (tab() === 'icons') {
          <div class="ip-search">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            <input type="text" autocomplete="off" placeholder="Search icons" aria-label="Search icons" data-testid="icon-picker-search"
                   [value]="query()" (input)="query.set($any($event.target).value)" />
          </div>
          @if (showColors()) {
            <div class="ip-colors" role="group" aria-label="Colour">
              @for (swatch of colors; track swatch) {
                <button type="button" class="ip-swatch" [class.ip-swatch--on]="isColor(swatch)" [style.--swatch]="swatch"
                        [attr.aria-label]="'Colour ' + swatch" [attr.aria-pressed]="isColor(swatch)" data-testid="icon-picker-color"
                        (click)="colorChange.emit(swatch)"></button>
              }
            </div>
          }
          <div class="ip-grid-wrap scroll-fade">
            @for (group of groups(); track group.label) {
              <div class="ip-group-label">{{ group.label }}</div>
              <div class="ip-grid">
                @for (option of group.icons; track option.name) {
                  <button type="button" class="ip-cell" [class.ip-cell--on]="icon() === value(option.name)" [title]="option.name"
                          [attr.aria-label]="option.name" data-testid="icon-picker-icon" (click)="pick(value(option.name))">
                    <app-entity-icon [icon]="value(option.name)" [color]="color()" />
                  </button>
                }
              </div>
            } @empty {
              <p class="ip-empty">No icons match "{{ query() }}".</p>
            }
          </div>
        } @else {
          @if (emojiReady()) {
            <emoji-picker class="ip-emoji" [attr.data-source]="emojiDataUrl" (emoji-click)="onEmojiClick($event)"></emoji-picker>
          } @else {
            <p class="ip-empty">Loading emoji…</p>
          }
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: inline-flex; }
    .ip-trigger {
      position: relative; display: inline-flex; padding: 0; border: 0; background: none; cursor: pointer; border-radius: 0.75rem;
      --entity-icon-size: var(--icon-picker-size, 2.75rem);
    }
    .ip-trigger:disabled { cursor: not-allowed; opacity: 0.6; }
    .ip-trigger--link { padding: 0.125rem 0.25rem; border-radius: 0.375rem; font-size: 0.8125rem; font-weight: 500; color: var(--color-accent); }
    .ip-trigger--link:hover { text-decoration: underline; }
    .ip-trigger:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
    .ip-trigger__badge {
      position: absolute; right: -0.25rem; bottom: -0.25rem; width: 1.125rem; height: 1.125rem; border-radius: 999px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--color-surface); color: var(--color-text-secondary); border: 1px solid var(--color-border);
      transition: color 120ms, border-color 120ms;
    }
    .ip-trigger:hover .ip-trigger__badge, .ip-trigger:focus-visible .ip-trigger__badge, .ip-trigger[aria-expanded='true'] .ip-trigger__badge { color: var(--color-accent); border-color: var(--color-accent); }
    .ip-trigger__badge svg { width: 0.625rem; height: 0.625rem; }

    .ip-panel {
      width: 22rem; max-width: calc(100vw - 1rem); display: flex; flex-direction: column;
      border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface);
      box-shadow: var(--shadow-modal); overflow: hidden;
    }
    .ip-head { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.625rem 0; }
    .ip-tabs { display: inline-flex; gap: 0.25rem; }
    .ip-tab {
      border: 0; background: none; padding: 0.375rem 0.625rem; border-radius: 0.5rem; cursor: pointer;
      font-size: 0.8125rem; font-weight: 500; color: var(--color-text-secondary);
    }
    .ip-tab:hover { color: var(--color-text-primary); background: var(--color-surface-secondary); }
    .ip-tab--on { color: var(--color-text-primary); background: var(--color-surface-secondary); }
    .ip-remove { border: 0; background: none; cursor: pointer; font-size: 0.8125rem; color: var(--color-text-secondary); padding: 0.375rem 0.5rem; border-radius: 0.5rem; }
    .ip-remove:hover { color: var(--color-danger, #dc2626); background: var(--color-surface-secondary); }

    .ip-search {
      display: flex; align-items: center; gap: 0.375rem; margin: 0.5rem 0.625rem 0; padding: 0.375rem 0.625rem;
      border: 1px solid var(--color-border); border-radius: 0.5rem; color: var(--color-text-secondary);
    }
    .ip-search:focus-within { border-color: var(--color-accent); }
    .ip-search svg { width: 0.875rem; height: 0.875rem; flex-shrink: 0; }
    .ip-search input { width: 100%; border: 0; outline: none; background: transparent; font-size: 0.8125rem; color: var(--color-text-primary); }

    .ip-colors { display: flex; flex-wrap: wrap; gap: 0.375rem; padding: 0.625rem 0.625rem 0; }
    .ip-swatch {
      width: 1.25rem; height: 1.25rem; border-radius: 999px; border: 0; cursor: pointer; background: var(--swatch);
      box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 2px transparent; transition: box-shadow 120ms;
    }
    .ip-swatch--on, .ip-swatch:focus-visible { box-shadow: 0 0 0 2px var(--color-surface), 0 0 0 4px var(--swatch); outline: none; }

    .ip-grid-wrap { max-height: 16.5rem; overflow-y: auto; padding: 0.25rem 0.5rem 0.625rem; }
    .ip-group-label {
      padding: 0.625rem 0.25rem 0.25rem; font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--color-text-secondary);
    }
    .ip-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 0.125rem; }
    .ip-cell {
      display: inline-flex; align-items: center; justify-content: center; aspect-ratio: 1; padding: 0; border: 0;
      border-radius: 0.5rem; background: none; cursor: pointer; --entity-icon-size: 2rem;
    }
    .ip-cell:hover, .ip-cell:focus-visible { background: var(--color-surface-secondary); outline: none; }
    .ip-cell--on { box-shadow: inset 0 0 0 2px var(--color-accent); }
    .ip-empty { padding: 1.5rem 0.75rem; text-align: center; font-size: 0.8125rem; color: var(--color-text-secondary); }

    .ip-emoji {
      width: 100%; height: 22rem; margin-top: 0.5rem;
      --border-size: 0; --border-radius: 0; --background: var(--color-surface); --input-border-color: var(--color-border);
      --input-font-color: var(--color-text-primary); --input-placeholder-color: var(--color-text-secondary);
      --category-font-color: var(--color-text-secondary); --indicator-color: var(--color-accent);
      --button-hover-background: var(--color-surface-secondary); --button-active-background: var(--color-surface-secondary);
      --outline-color: var(--color-accent); --emoji-size: 1.375rem; --num-columns: 8;
    }
  `]
})
export class IconPickerComponent {
  readonly icon = input<string | null | undefined>(null);
  readonly color = input<string | null | undefined>(null);
  /** For the initials shown when there is no icon. */
  readonly name = input('');
  /** Shown on the trigger while nothing is picked (e.g. a leave type's guessed picture); never emitted. */
  readonly defaultIcon = input<string | null>(null);
  /** Hide the swatches when the host form already has its own colour field. */
  readonly showColors = input(true);
  readonly disabled = input(false);
  readonly ariaLabel = input('Change icon');
  /** Renders the trigger as a text link with this label instead of the icon (for hosts that show the icon themselves). */
  readonly linkLabel = input('');

  readonly iconChange = output<string | null>();
  readonly colorChange = output<string>();

  protected readonly open = signal(false);
  protected readonly tab = signal<'icons' | 'emoji'>('icons');
  protected readonly query = signal('');
  protected readonly emojiReady = signal(false);
  protected readonly positions = PANEL_POSITIONS;
  protected readonly colors = ENTITY_ICON_COLORS;
  protected readonly emojiDataUrl = EMOJI_DATA_URL;

  protected readonly groups = computed<readonly EntityIconGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return ENTITY_ICON_GROUPS;
    return ENTITY_ICON_GROUPS
      .map(g => ({ label: g.label, icons: g.icons.filter(i => i.name.includes(q) || i.keywords.includes(q)) }))
      .filter(g => g.icons.length > 0);
  });

  protected value(name: string): string {
    return lucideIconValue(name);
  }

  protected isColor(swatch: string): boolean {
    return (this.color() ?? '').toUpperCase() === swatch.toUpperCase();
  }

  protected toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.tab.set(this.icon()?.startsWith('emoji:') ? 'emoji' : 'icons');
    this.open.set(true);
    if (this.tab() === 'emoji') void this.loadEmoji();
  }

  protected close(): void {
    this.open.set(false);
    this.query.set('');
  }

  protected showEmoji(): void {
    this.tab.set('emoji');
    void this.loadEmoji();
  }

  protected pick(value: string | null): void {
    this.iconChange.emit(value);
    this.close();
  }

  protected onEmojiClick(event: Event): void {
    const unicode = (event as CustomEvent<{ unicode?: string }>).detail.unicode;
    if (unicode) this.pick(emojiIconValue(unicode));
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  /** The emoji web component (and its ~40KB) loads only when someone opens the Emoji tab. */
  private async loadEmoji(): Promise<void> {
    if (this.emojiReady()) return;
    await import('emoji-picker-element');
    this.emojiReady.set(true);
  }
}
