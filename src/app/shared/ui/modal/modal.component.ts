import { Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';
import { KeyboardClickDirective } from '../../directives/keyboard-click.directive';

export type ModalSize = 'md' | 'lg' | 'xl' | '2xl';

/** Glyphs available for the header icon tile (styled by .ui-popup-icon in styles.css). */
export type PopupIcon =
  | 'calendar' | 'user' | 'user-plus' | 'users' | 'clock' | 'sun' | 'shield' | 'building' | 'trash'
  | 'archive' | 'alert' | 'layers' | 'flag' | 'folder' | 'map-pin' | 'device' | 'message'
  | 'save' | 'settings' | 'checklist' | 'hierarchy' | 'briefcase' | 'edit' | 'info';

/** Title keywords -> icon, first match wins. Keeps every titled modal iconned without per-call config. */
const TITLE_ICON_RULES: readonly (readonly [RegExp, PopupIcon])[] = [
  [/\b(delete|remove)\b/, 'trash'],
  [/\barchive/, 'archive'],
  [/\b(deactivate|reject|escalate|alert|discard|cancel)/, 'alert'],
  [/save draft/, 'save'],
  [/\b(event|calendar|holiday)|^\d{4}-\d{2}-\d{2}/, 'calendar'],
  [/\b(leave|entitlement|time off)/, 'sun'],
  [/\b(approval|approve|review|role|permission|access)/, 'shield'],
  [/\b(attendance|correction|clock)/, 'clock'],
  [/\b(work-area|location)/, 'map-pin'],
  [/\bdevice/, 'device'],
  [/\b(reporting|hierarchy)/, 'hierarchy'],
  [/\b(offboarding|employment|position)/, 'briefcase'],
  [/\b(employee|person|people|member)/, 'users'],
  [/\b(company|department|organi[sz]ation)/, 'building'],
  [/\b(sprint|milestone)/, 'flag'],
  [/\bproject/, 'folder'],
  [/\b(settings|preferences)/, 'settings'],
  [/\b(task|work item|module|categor|status|subtask|duplicate)/, 'layers'],
  [/\b(reply|comment|message)/, 'message'],
  [/\b(checklist|complete|result)/, 'checklist'],
  [/\b(adjust|edit|rename)/, 'edit'],
];

@Component({
  selector: 'app-modal',
  imports: [KeyboardClickDirective],
  host: { '[animate.leave]': "open() ? 'ui-popup-leave' : ''" },
  standalone: true,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[1200] flex items-center justify-center p-4" animate.leave="ui-popup-leave">
        <div role="button" tabindex="0" appKeyboardClick [class]="dimBackdrop() ? 'ui-fade-in absolute inset-0 bg-black/50' : 'absolute inset-0'" (click)="onBackdropClick()"></div>
        <div
          #dialog
          [class]="dialogClass()"
          [style.--popup-pad]="paddingOverride()"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-labelledby]="title() ? titleId : null"
          (keydown.escape)="closed.emit()"
        >
          <div [class]="title() ? 'ui-popup-header app-modal__header flex items-start justify-between gap-4' : 'mb-4 flex items-start justify-between gap-4'">
            @if (title()) {
              <span class="ui-popup-icon" [attr.data-icon]="resolvedIcon()" aria-hidden="true"></span>
              <div class="min-w-0">
                <h2 [id]="titleId" class="text-lg font-semibold text-[var(--color-text-primary)]">{{ title() }}</h2>
                @if (subtitle()) {
                  <p class="mt-0.5 text-sm text-[var(--color-text-secondary)]">{{ subtitle() }}</p>
                }
              </div>
            }
            <button
              type="button"
              class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-border)]/20 hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              aria-label="Close"
              (click)="closed.emit()"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <ng-content />
        </div>
      </div>
    }
  `,
  styles: `
    .modal-dialog--constrained {
      max-height: 85vh;
      overflow-y: auto;
    }

    /* --popup-pad mirrors the panel's padding so the curved header can bleed to the panel edges. */
    .app-modal--pad-6 { --popup-pad: 1.5rem; }
    .app-modal--pad-8 { --popup-pad: 2rem; }

    .app-modal__header {
      margin: calc(-1 * var(--popup-pad)) calc(-1 * var(--popup-pad)) 1.25rem;
    }

    /* Keep the header pinned while a tall modal's body scrolls under it. */
    .modal-dialog--constrained > .app-modal__header {
      position: sticky;
      top: calc(-1 * var(--popup-pad));
    }
  `
})
export class ModalComponent {
  open = input(false);
  title = input<string>('');
  /** Header icon tile glyph; when empty one is picked from the title's keywords. */
  icon = input<PopupIcon | ''>('');
  /** Optional one-line explanation shown under the title in the header. */
  subtitle = input<string>('');
  size = input<ModalSize>('md');
  customMaxWidth = input<string>('');
  panelClass = input<string>('');
  closeOnBackdropClick = input(true);
  /** Entrance animation: 'scroll' (unrolls downward from the top edge, the default for every pop-up)
   * or 'pop' (scale up). */
  animation = input<'pop' | 'scroll'>('scroll');
  /** false keeps the page behind fully visible (no dark overlay); clicking outside still closes. */
  dimBackdrop = input(true);
  closed = output<void>();

  readonly dialogClass = computed(() => {
    const sizeMap: Record<ModalSize, string> = {
      md: 'ui-pop-in relative z-10 w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 app-modal--pad-6 shadow-lg outline-none',
      lg: 'ui-pop-in relative z-10 w-full max-w-xl rounded-2xl bg-[var(--color-surface)] p-6 app-modal--pad-6 shadow-lg outline-none modal-dialog--constrained',
      xl: 'ui-pop-in relative z-10 w-full max-w-5xl rounded-2xl bg-[var(--color-surface)] p-8 app-modal--pad-8 shadow-lg outline-none modal-dialog--constrained',
      '2xl': 'ui-pop-in relative z-10 w-full max-w-6xl rounded-2xl bg-[var(--color-surface)] p-8 app-modal--pad-8 shadow-lg outline-none modal-dialog--constrained',
    };
    let cls = sizeMap[this.size()];
    if (this.animation() === 'scroll') {
      cls = cls.replace('ui-pop-in', 'ui-scroll-open');
    }
    const custom = this.customMaxWidth().trim();
    if (custom) {
      cls = cls.replace(/max-w-[a-z0-9]+/, custom);
    }
    const extra = this.panelClass().trim();
    return extra ? `${cls} ${extra}` : cls;
  });

  readonly resolvedIcon = computed<PopupIcon>(() => {
    const explicit = this.icon();
    if (explicit) return explicit;
    const title = this.title().toLowerCase();
    return TITLE_ICON_RULES.find(([pattern]) => pattern.test(title))?.[1] ?? 'info';
  });

  /** A panelClass padding override like "!p-5" also has to move the curved header's bleed. */
  readonly paddingOverride = computed(() => {
    const match = /(?:^|\s)!p-(\d+(?:\.\d+)?)(?:\s|$)/.exec(this.panelClass());
    return match ? `${Number(match[1]) * 0.25}rem` : null;
  });

  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('dialog');
  readonly titleId = nextUniqueId('app-modal-title');
  private previouslyFocused: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.previouslyFocused = document.activeElement as HTMLElement;
        this.dialogRef()?.nativeElement.focus();
      } else if (this.previouslyFocused) {
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    });
  }

  onBackdropClick(): void {
    if (this.closeOnBackdropClick()) {
      this.closed.emit();
    }
  }
}
