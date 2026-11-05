import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { getInitials } from '../../../../shared/utils/avatar.utils';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

export interface TaskAssigneeAvatarMember {
  employeeId: string;
  name: string;
  avatarUrl?: string | null;
}

const MAX_VISIBLE_AVATARS = 5;

/**
 * Jira-style assignee filter: an overlapping avatar stack (current user first) that opens a
 * checkbox dropdown for picking any combination of project members, instead of a single
 * "only my tasks" toggle.
 */
@Component({
  selector: 'app-task-assignee-avatar-filter',
  standalone: true,
  imports: [StopClickPropagationDirective, AvatarComponent],
  template: `
    <div class="taaf" appStopClickPropagation>
      <div class="taaf__stack">
        @for (member of visibleMembers(); track member.employeeId) {
          <button
            type="button"
            class="taaf__avatar"
            [class.taaf__avatar--selected]="isSelected(member.employeeId)"
            [class.taaf__avatar--dimmed]="selected().length > 0 && !isSelected(member.employeeId)"
            [attr.aria-pressed]="isSelected(member.employeeId)"
            [title]="member.name + (member.employeeId === currentEmployeeId() ? ' (You)' : '')"
            (click)="toggleMember(member.employeeId)"
          >
            <app-avatar
              [avatarUrl]="member.avatarUrl"
              [userName]="member.name"
              size="sm"
              shape="circle"
              imageClass="taaf__img"
            />
          </button>
        }
        @if (overflowCount() > 0) {
          <button
            type="button"
            class="taaf__avatar taaf__avatar--overflow"
            [attr.aria-expanded]="open()"
            title="Show more people"
            (click)="toggleOpen()"
          >+{{ overflowCount() }}</button>
        }
      </div>

      @if (open()) {
        <div class="taaf__panel" role="dialog" aria-label="Filter by assignee">
          <div class="taaf__panel-head">
            <span>Filter by assignee</span>
            @if (selected().length > 0) {
              <button type="button" class="taaf__clear" (click)="clear()">Clear</button>
            }
          </div>
          @if (orderedMembers().length > 6) {
            <div class="taaf__search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input
                type="text"
                placeholder="Search people…"
                [value]="search()"
                (input)="search.set($any($event.target).value)"
              />
            </div>
          }
          <div class="taaf__list scroll-fade">
            @for (member of filteredMembers(); track member.employeeId) {
              <button type="button" class="taaf__option" (click)="toggleMember(member.employeeId)">
                <span class="taaf__checkbox" [class.taaf__checkbox--on]="isSelected(member.employeeId)" aria-hidden="true">
                  @if (isSelected(member.employeeId)) { <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 7" /></svg> }
                </span>
                <span class="taaf__option-avatar">
                  <app-avatar
                    [avatarUrl]="member.avatarUrl"
                    [userName]="member.name"
                    size="xs"
                    shape="circle"
                    imageClass="taaf__img"
                  />
                </span>
                <span class="taaf__option-name">{{ member.name }}@if (member.employeeId === currentEmployeeId()) { <span class="taaf__you"> (You)</span> }</span>
              </button>
            } @empty {
              <p class="taaf__empty">No matching people</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .taaf { position: relative; display: inline-block; }
    .taaf__stack { display: inline-flex; align-items: center; height: 30px; }
    .taaf__avatar { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex: 0 0 auto; border-radius: 999px; margin-left: -5px; padding: 0; border: 2px solid var(--color-surface); background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; transition: transform 120ms ease, opacity 120ms ease, box-shadow 120ms ease; overflow: hidden; }
    .taaf__avatar:first-child { margin-left: 0; }
    .taaf__avatar:hover { transform: translateY(-2px); z-index: 1; position: relative; }
    .taaf__avatar--selected { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }
    .taaf__avatar--dimmed { opacity: .45; }
    .taaf__avatar--dimmed:hover { opacity: 1; }
    .taaf__avatar--overflow { background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .taaf__avatar app-avatar { display: contents; }
    .taaf__avatar .avatar { width: 100%; height: 100%; border: none; }
    .taaf__img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 999px; }
    .taaf__panel { position: absolute; top: calc(100% + 7px); right: 0; z-index: 80; width: 260px; max-width: 90vw; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-surface); box-shadow: var(--shadow-modal); padding: 12px; animation: taaf-panel-in 130ms ease-out; }
    .taaf__panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 700; color: var(--color-text-primary); }
    .taaf__clear { border: 0; background: transparent; color: var(--color-accent); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
    .taaf__clear:hover { text-decoration: underline; }
    .taaf__search { display: flex; align-items: center; gap: 6px; height: 32px; border: 1px solid var(--color-border); border-radius: 8px; padding: 0 9px; margin-bottom: 8px; }
    .taaf__search svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: var(--color-text-secondary); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .taaf__search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; outline: none; }
    .taaf__list { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
    .taaf__option { display: flex; width: 100%; min-height: 36px; align-items: center; gap: 9px; border: 0; border-radius: 7px; padding: 6px 8px; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 500; text-align: left; cursor: pointer; }
    .taaf__option:hover { background: var(--color-surface-secondary); }
    .taaf__checkbox { display: inline-flex; width: 15px; height: 15px; flex: 0 0 auto; box-sizing: border-box; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: 4px; background: var(--color-surface); }
    .taaf__checkbox--on { border-color: var(--color-accent); background: var(--color-accent); }
    .taaf__checkbox svg { width: 11px; height: 11px; fill: none; stroke: var(--color-accent-contrast); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .taaf__option-avatar { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: 0 0 auto; border-radius: 999px; background: color-mix(in srgb, var(--color-accent) 18%, transparent); color: var(--color-accent); font-size: 9px; font-weight: 700; overflow: hidden; }
    .taaf__option-avatar app-avatar { display: contents; }
    .taaf__option-avatar .avatar { width: 100%; height: 100%; border: none; }
    .taaf__option-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .taaf__you { color: var(--color-text-secondary); font-weight: 400; }
    .taaf__empty { margin: 6px 0 2px; color: var(--color-text-secondary); font-size: 12.5px; text-align: center; }
    @keyframes taaf-panel-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .taaf__panel { animation: none; } }
  `]
})
export class TaskAssigneeAvatarFilterComponent {
  members = input<readonly TaskAssigneeAvatarMember[]>([]);
  currentEmployeeId = input<string>('');
  selected = input<readonly string[]>([]);
  selectionChanged = output<string[]>();

  protected readonly open = signal(false);
  protected readonly search = signal('');
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly orderedMembers = computed(() => {
    const me = this.currentEmployeeId();
    const members = this.members();
    const mine = members.find((m) => m.employeeId === me);
    const rest = members.filter((m) => m.employeeId !== me);
    return mine ? [mine, ...rest] : members;
  });

  protected readonly visibleMembers = computed(() => this.orderedMembers().slice(0, MAX_VISIBLE_AVATARS));
  protected readonly overflowCount = computed(() => Math.max(0, this.orderedMembers().length - MAX_VISIBLE_AVATARS));

  protected readonly filteredMembers = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.orderedMembers();
    return this.orderedMembers().filter((m) => m.name.toLowerCase().includes(q));
  });

  protected initials(name: string): string {
    return getInitials(name);
  }

  isSelected(employeeId: string): boolean {
    return this.selected().includes(employeeId);
  }

  toggleOpen(): void {
    this.open.update((v) => !v);
    this.search.set('');
  }

  toggleMember(employeeId: string): void {
    const current = this.selected();
    const next = current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId];
    this.selectionChanged.emit(next);
  }

  clear(): void {
    this.selectionChanged.emit([]);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}
