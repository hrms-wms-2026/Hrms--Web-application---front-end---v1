import { Component, computed, effect, input, output, signal } from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';

/** Someone the case may be handed to instead (action Meta "escalateCandidates", JSON). */
export interface InboxEscalateCandidate {
  employeeId: string;
  name: string;
  position?: string | null;
  avatarFileId?: string | null;
  isDefault: boolean;
}

export interface InboxEscalateChoice {
  comment: string | null;
  /** Null = the provider's own pick. */
  targetEmployeeId: string | null;
}

/** The ticket being escalated, shown beside the picker. */
export interface InboxEscalateContext {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export const ESCALATE_NOTE_MAX = 500;

/** "Escalate": who it goes to plus a note. `escalateTo` (action Meta): a name, "" = no one above (logged only),
 *  null = the provider does not preview the target. With `candidates` the caller picks the person. */
@Component({
  selector: 'app-inbox-escalate-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, AvatarComponent],
  template: `
    <app-modal [open]="open()" title="Escalate Ticket" icon="alert" customMaxWidth="max-w-4xl"
      subtitle="Transfer this conversation to someone who can take it over." (closed)="closed.emit()">
      <div class="esc" data-testid="inbox-escalate-dialog">
        <section class="esc__left">
          <header class="esc__head">
            <span class="esc__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </span>
            <span class="esc__heading">
              <strong>Select a person</strong>
              <small>Choose who will take over this conversation</small>
            </span>
            @if (candidates().length > 0) {
              <label class="esc__search ui-field ui-field--sm">
                <span class="ui-field__addon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
                <input class="ui-field__control" type="text" data-testid="inbox-escalate-search" placeholder="Search people..." aria-label="Search people"
                  [value]="query()" (input)="query.set($any($event.target).value)" />
              </label>
            }
          </header>

          @if (candidates().length > 0) {
            <div class="esc__list scroll-fade" role="radiogroup" aria-label="Send to" data-testid="inbox-escalate-person">
              @for (c of visible(); track c.employeeId) {
                <button type="button" class="esc__row" role="radio" data-testid="inbox-escalate-option"
                  [attr.aria-checked]="target() === c.employeeId" (click)="toggle(c.employeeId)">
                  <app-avatar size="md" [userName]="c.name" [avatarUrl]="avatarUrl(c)" />
                  <span class="esc__who">
                    <span class="esc__name">{{ c.name }}</span>
                    @if (detail(c)) { <span class="esc__detail">{{ detail(c) }}</span> }
                  </span>
                  <span class="esc__radio" aria-hidden="true">
                    @if (target() === c.employeeId) {
                      <svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8" /></svg>
                    }
                  </span>
                </button>
              } @empty {
                <p class="esc__empty">No one matches "{{ query() }}".</p>
              }
            </div>
          }

          <p class="esc__target" data-testid="inbox-escalate-target">
            @if (picked(); as p) {
              Goes to <strong>{{ p.name }}</strong>{{ p.position ? ' (' + p.position + ')' : '' }}, who joins the conversation and takes it over.
            } @else if (mustPick()) {
              Pick who to send it to.
            } @else if (escalateTo() === null) {
              It goes to the next person up the chain, who joins the conversation. At the top it is logged.
            } @else if (escalateTo()) {
              Goes to <strong>{{ escalateTo() }}</strong>, who joins the conversation.
            } @else {
              No one above – this will be logged.
            }
          </p>
        </section>

        <section class="esc__right">
          @if (context(); as ctx) {
            <div class="esc__context" data-testid="inbox-escalate-context">
              <div class="esc__subhead">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
                <strong>Ticket context</strong>
              </div>
              <div class="esc__ticket">
                <span class="esc__ticket-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m9 12 2 2 4-4" /></svg>
                </span>
                <span class="esc__ticket-text">
                  @if (ctx.eyebrow) { <span class="esc__eyebrow">{{ ctx.eyebrow }}</span> }
                  <span class="esc__ticket-title">{{ ctx.title }}</span>
                  @if (ctx.subtitle) { <span class="esc__ticket-sub">{{ ctx.subtitle }}</span> }
                </span>
              </div>
            </div>
          }

          <div class="esc__reason">
            <div class="esc__subhead esc__subhead--top">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></svg>
              <span>
                <strong>Reason for escalation</strong> <em>(optional)</em>
                <small>Add a note to help the assignee understand the context.</small>
              </span>
            </div>
            <textarea class="ui-input" data-testid="inbox-escalate-note" rows="5" [attr.maxlength]="noteMax"
              placeholder="E.g. Need higher level approval, policy clarification..."
              [value]="note()" (input)="note.set($any($event.target).value)"></textarea>
            <span class="esc__count">{{ note().length }}/{{ noteMax }}</span>
          </div>
        </section>
      </div>

      <div class="esc__actions">
        <app-button variant="secondary" data-testid="inbox-escalate-cancel" (pressed)="closed.emit()">Cancel</app-button>
        <app-button variant="primary" data-testid="inbox-escalate-confirm" [disabled]="mustPick()" (pressed)="confirm()">
          <span class="esc__send">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></svg>
            Escalate
          </span>
        </app-button>
      </div>
    </app-modal>
  `,
  styles: [`
    :host { display: contents; }
    svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .esc { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 24px; margin-top: 8px; }
    @media (max-width: 720px) { .esc { grid-template-columns: minmax(0, 1fr); } }
    .esc__left, .esc__right { display: flex; min-width: 0; flex-direction: column; gap: 12px; }

    .esc__head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
    .esc__icon { display: inline-flex; width: 36px; height: 36px; flex: none; align-items: center; justify-content: center; border-radius: 10px;
      background: color-mix(in srgb, var(--color-accent) 10%, var(--color-surface)); color: var(--color-accent); }
    .esc__icon svg { width: 20px; height: 20px; }
    .esc__heading { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
    .esc__heading strong { font-size: 15px; font-weight: 650; color: var(--color-text-primary); }
    .esc__heading small, .esc__subhead small { color: var(--color-text-secondary); font-size: 12px; }
    .esc__search { flex: 0 1 220px; }

    .esc__list { display: flex; max-height: 360px; flex-direction: column; overflow-y: auto; padding: 4px; border: 1px solid var(--color-border); border-radius: 12px; }
    .esc__row { display: flex; width: 100%; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid transparent; border-radius: 10px;
      background: transparent; color: var(--color-text-primary); font: inherit; text-align: left; cursor: pointer; }
    .esc__row + .esc__row { border-top-color: var(--color-border); border-top-left-radius: 0; border-top-right-radius: 0; }
    .esc__row:hover { background: var(--color-surface-secondary); }
    .esc__row[aria-checked="true"] { border-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
      background: color-mix(in srgb, var(--color-accent) 8%, var(--color-surface)); border-radius: 10px; }
    .esc__row[aria-checked="true"] + .esc__row { border-top-color: transparent; }
    .esc__row:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 1px; }
    .esc__who { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 2px; }
    .esc__name { overflow: hidden; font-size: 14px; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
    .esc__detail { overflow: hidden; color: var(--color-text-secondary); font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }
    .esc__radio { display: inline-flex; width: 22px; height: 22px; flex: none; align-items: center; justify-content: center;
      border: 1.5px solid var(--color-border); border-radius: 50%; color: #fff; }
    .esc__row[aria-checked="true"] .esc__radio { border-color: var(--color-accent); background: var(--color-accent); }
    .esc__radio svg { width: 14px; height: 14px; stroke-width: 2.6; }
    .esc__empty { margin: 0; padding: 20px 12px; color: var(--color-text-secondary); font-size: 13px; text-align: center; }
    .esc__target { margin: 0; color: var(--color-text-secondary); font-size: 13px; line-height: 1.5; }
    .esc__target strong { color: var(--color-text-primary); }

    .esc__context { display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px;
      background: color-mix(in srgb, var(--color-surface-secondary) 70%, var(--color-surface)); }
    .esc__subhead { display: flex; align-items: center; gap: 10px; color: var(--color-text-primary); font-size: 14px; }
    .esc__subhead--top { align-items: flex-start; }
    .esc__subhead > svg { width: 20px; height: 20px; flex: none; color: var(--color-accent); }
    .esc__subhead span { display: flex; flex-direction: column; gap: 2px; }
    .esc__subhead strong { font-weight: 650; }
    .esc__subhead em { color: var(--color-text-secondary); font-size: 12px; font-style: normal; font-weight: 400; }
    .esc__ticket { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 12px; background: var(--color-surface-secondary); }
    .esc__ticket-icon { display: inline-flex; width: 36px; height: 36px; flex: none; align-items: center; justify-content: center; border-radius: 10px;
      background: var(--color-surface); color: var(--color-text-secondary); }
    .esc__ticket-icon svg { width: 18px; height: 18px; }
    .esc__ticket-text { display: flex; min-width: 0; flex-direction: column; gap: 2px; }
    .esc__eyebrow { color: var(--color-text-secondary); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .esc__ticket-title { color: var(--color-text-primary); font-size: 15px; font-weight: 650; }
    .esc__ticket-sub { color: var(--color-text-secondary); font-size: 12.5px; }

    .esc__reason { display: flex; flex-direction: column; gap: 10px; }

    .esc__count { align-self: flex-end; color: var(--color-text-secondary); font-size: 12px; }

    .esc__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .esc__send { display: inline-flex; align-items: center; gap: 8px; }
    .esc__send svg { width: 16px; height: 16px; }
  `]
})
export class InboxEscalateDialogComponent {
  open = input(false);
  escalateTo = input<string | null>(null);
  candidates = input<readonly InboxEscalateCandidate[]>([]);
  context = input<InboxEscalateContext | null>(null);

  confirmed = output<InboxEscalateChoice>();
  closed = output<void>();

  protected readonly noteMax = ESCALATE_NOTE_MAX;
  protected readonly note = signal('');
  protected readonly query = signal('');
  /** The picked employee id; "" = the suggested target. */
  protected readonly target = signal('');

  /** One suggested person is preselected; a suggested group (e.g. all of HR) is "nobody picked". */
  private readonly singleDefault = computed(() => {
    const defaults = this.candidates().filter((c) => c.isDefault);
    return defaults.length === 1 ? defaults[0] : null;
  });
  protected readonly visible = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.candidates().filter((c) => !query || c.name.toLowerCase().includes(query) || (c.position ?? '').toLowerCase().includes(query));
  });
  protected readonly picked = computed(() => this.candidates().find((c) => c.employeeId === this.target()) ?? null);
  /** No preview at all (escalateTo null): there is no fallback target, so someone must be picked. */
  protected readonly mustPick = computed(() => this.candidates().length > 0 && this.escalateTo() === null && !this.picked());

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.note.set('');
      this.query.set('');
      this.target.set(this.singleDefault()?.employeeId ?? '');
    });
  }

  protected detail(c: InboxEscalateCandidate): string {
    return [c.position, c.isDefault ? 'Suggested' : null].filter(Boolean).join(' · ');
  }

  protected avatarUrl(c: InboxEscalateCandidate): string | null {
    return c.avatarFileId ? buildFileUrl(c.avatarFileId) : null;
  }

  /** Single choice: picking the picked person again goes back to the suggestion. */
  protected toggle(employeeId: string): void {
    this.target.set(this.target() === employeeId ? '' : employeeId);
  }

  protected confirm(): void {
    if (this.mustPick()) return;
    const note = this.note().trim().slice(0, ESCALATE_NOTE_MAX);
    const picked = this.picked();
    this.confirmed.emit({ comment: note || null, targetEmployeeId: picked && !picked.isDefault ? picked.employeeId : null });
  }
}
